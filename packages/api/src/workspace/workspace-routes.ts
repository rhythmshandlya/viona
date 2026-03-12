import { FastifyInstance } from 'fastify';
import { join } from 'path';
import { stat } from 'fs/promises';
import { createReadStream } from 'fs';
import { manifestOpSchema } from '@viona/shared';
import {
  spinUpWorkspace,
  tearDownWorkspace,
  readManifest,
  applyManifestOperation,
  isWorkspaceActive,
  touchActivity,
} from './workspace-service.js';
import { acquireLock, releaseLock, extendLock, getLockInfo } from './workspace-lock.js';
import { emitManifestUpdated, emitLockAcquired, emitLockReleased } from './workspace-ws.js';
import { bundlerService } from './bundler-service.js';
import { authMiddleware } from '../middleware/auth.js';

// MIME types for bundle file serving
const MIME_TYPES: Record<string, string> = {
  '.js': 'application/javascript',
  '.js.map': 'application/json',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

export async function workspaceRoutes(fastify: FastifyInstance): Promise<void> {

  // ---- Workspace lifecycle ----

  /** Spin up workspace for a project */
  fastify.post('/projects/:id/workspace', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // Check if already active
    if (await isWorkspaceActive(id)) {
      const manifest = await readManifest(id);
      touchActivity(id);
      return reply.send({ manifest, workspaceStatus: 'active', bundleUrl: null });
    }

    try {
      const result = await spinUpWorkspace(id);
      return reply.send({
        manifest: result.manifest,
        workspaceStatus: 'initializing',
        cachedBundleUrl: result.bundleUrl,
      });
    } catch (error: any) {
      return reply.status(500).send({ error: `Failed to spin up workspace: ${error.message}` });
    }
  });

  /** Tear down workspace */
  fastify.delete('/projects/:id/workspace', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!(await isWorkspaceActive(id))) {
      return reply.status(404).send({ error: 'No active workspace' });
    }

    await tearDownWorkspace(id);
    return reply.send({ status: 'torn_down' });
  });

  // ---- Manifest operations ----

  /** Read current manifest */
  fastify.get('/projects/:id/workspace/manifest', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!(await isWorkspaceActive(id))) {
      return reply.status(404).send({ error: 'No active workspace' });
    }

    touchActivity(id);
    const manifest = await readManifest(id);
    return reply.send(manifest);
  });

  /** Apply a manifest operation */
  fastify.patch('/projects/:id/workspace/manifest', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!(await isWorkspaceActive(id))) {
      return reply.status(404).send({ error: 'No active workspace' });
    }

    // Validate the operation
    const parseResult = manifestOpSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid operation', details: parseResult.error.issues });
    }

    try {
      const updated = await applyManifestOperation(id, parseResult.data);
      await emitManifestUpdated(id, { source: 'user', ops: [parseResult.data] });
      return reply.send(updated);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // ---- Edit lock ----

  /** Acquire edit lock */
  fastify.post('/projects/:id/workspace/lock', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { holder?: string } | undefined;
    const holder = (body?.holder === 'ai' ? 'ai' : 'user') as 'user' | 'ai';

    if (!(await isWorkspaceActive(id))) {
      return reply.status(404).send({ error: 'No active workspace' });
    }

    const acquired = await acquireLock(id, holder);
    if (!acquired) {
      const current = await getLockInfo(id);
      return reply.status(409).send({ error: 'Lock held', holder: current?.holder });
    }

    await emitLockAcquired(id, { holder });
    return reply.send({ acquired: true, holder });
  });

  /** Release edit lock */
  fastify.delete('/projects/:id/workspace/lock', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { holder?: string } | undefined;
    const holder = (body?.holder === 'ai' ? 'ai' : 'user') as 'user' | 'ai';

    const released = await releaseLock(id, holder);
    if (!released) {
      return reply.status(409).send({ error: 'Lock held by other party' });
    }

    await emitLockReleased(id, { holder });
    return reply.send({ released: true });
  });

  /** Extend lock TTL (heartbeat) */
  fastify.post('/projects/:id/workspace/lock/heartbeat', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { holder?: string } | undefined;
    const holder = (body?.holder === 'ai' ? 'ai' : 'user') as 'user' | 'ai';

    const extended = await extendLock(id, holder);
    if (!extended) {
      return reply.status(409).send({ error: 'Lock expired or held by other party' });
    }

    return reply.send({ extended: true });
  });

  /** Get lock status */
  fastify.get('/projects/:id/workspace/lock', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const info = await getLockInfo(id);
    return reply.send({ locked: !!info, info });
  });

  // ---- Bundle serving ----

  /** Serve bundle files from the workspace build output */
  fastify.get('/projects/:id/workspace/bundle/*', async (request, reply) => {
    const { id } = request.params as { id: string };
    const filePath = (request.params as any)['*'] || 'index.html';

    const bundlePath = bundlerService.getBundlePath(id);
    const fullPath = join(bundlePath, filePath);

    // Security: prevent path traversal
    if (!fullPath.startsWith(bundlePath)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    try {
      const fileStat = await stat(fullPath);
      if (!fileStat.isFile()) {
        return reply.status(404).send({ error: 'Not found' });
      }

      // Determine MIME type
      const ext = Object.keys(MIME_TYPES).find(e => fullPath.endsWith(e)) || '';
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'no-cache'); // Always fresh during development
      return reply.send(createReadStream(fullPath));
    } catch {
      return reply.status(404).send({ error: 'Not found' });
    }
  });
}
