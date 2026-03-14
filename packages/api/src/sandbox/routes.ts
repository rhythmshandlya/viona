import type { FastifyInstance } from 'fastify';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { sandboxSessions, projects, tracks, timelineItems } from '../db/index.js';
import { logger } from '../logger.js';
import { withProjectMutex } from './mutex.js';
import { proxyFileRequest, proxyPrompt, proxyManifestOp, proxyOps } from './proxy.js';
import { touchActivity, onSandboxIdle, removeActivity } from './health.js';
import { dbToManifest } from '@viona/shared';
import { syncManifestToDb } from './sync.js';
import { emitWorkspaceReady, emitBundleReady, emitWorkspaceTeardown, emitManifestUpdated } from '../workspace/workspace-ws.js';
import type { SandboxProvider } from './provider.js';
import { DockerSandboxProvider } from './docker.js';

// Initialize provider based on config — promise-based singleton prevents race
let providerPromise: Promise<SandboxProvider> | null = null;

function getProvider(): Promise<SandboxProvider> {
  if (!providerPromise) {
    providerPromise = (async () => {
      if (config.sandbox.provider === 'railway') {
        const { RailwaySandboxProvider } = await import('./railway.js');
        return new RailwaySandboxProvider();
      }
      return new DockerSandboxProvider();
    })();
  }
  return providerPromise;
}

// Debounce map: projectId → timer
const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();
const SYNC_DEBOUNCE_MS = 2000;

function debouncedSync(projectId: string, agentUrl: string, secret: string): void {
  const existing = syncTimers.get(projectId);
  if (existing) clearTimeout(existing);

  syncTimers.set(projectId, setTimeout(async () => {
    syncTimers.delete(projectId);
    try {
      const result = await proxyManifestOp(agentUrl, secret, 'GET');
      if (result.status === 200) {
        await syncManifestToDb(projectId, result.data);
        logger.debug({ projectId }, 'Manifest synced to DB');
      }
    } catch (err) {
      logger.error({ err, projectId }, 'Failed to sync manifest to DB');
    }
  }, SYNC_DEBOUNCE_MS));
}

export async function sandboxRoutes(fastify: FastifyInstance): Promise<void> {
  // Register idle suspension callback
  onSandboxIdle(async (projectId) => {
    await suspendSandbox(projectId);
  });

  // === Sandbox Lifecycle ===

  // POST /projects/:id/sandbox — Create or resume sandbox
  fastify.post('/projects/:id/sandbox', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id: projectId } = request.params as { id: string };
    const userId = request.user!.id;

    // Touch activity
    touchActivity(projectId);

    return withProjectMutex(projectId, async () => {
      // Check if sandbox already exists and is active
      const [existing] = await db.select().from(sandboxSessions)
        .where(and(eq(sandboxSessions.projectId, projectId), eq(sandboxSessions.status, 'ready')))
        .limit(1);

      if (existing) {
        return { status: 'ready', internalUrl: existing.internalUrl };
      }

      // Check global concurrent limit
      const [{ count: activeCount }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(sandboxSessions)
        .where(eq(sandboxSessions.status, 'ready'));
      if (activeCount >= config.sandbox.maxConcurrent) {
        return reply.status(503).send({ error: 'Maximum concurrent sandboxes reached' });
      }

      // Check per-user limit (1 active sandbox)
      const [activeForUser] = await db.select().from(sandboxSessions)
        .where(and(eq(sandboxSessions.userId, userId), eq(sandboxSessions.status, 'ready')))
        .limit(1);

      if (activeForUser && activeForUser.projectId !== projectId) {
        // Suspend the other sandbox first
        await suspendSandbox(activeForUser.projectId);
      }

      // Check for suspended session (has backup)
      const [suspended] = await db.select().from(sandboxSessions)
        .where(and(eq(sandboxSessions.projectId, projectId), eq(sandboxSessions.status, 'suspended')))
        .limit(1);

      // Get project data for manifest generation
      const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
      if (!project) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      // Build env vars for sandbox
      const env: Record<string, string> = {};
      if (process.env.ANTHROPIC_API_KEY) {
        env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
      }

      const p = await getProvider();

      // Create sandbox
      const sandbox = await p.create({
        projectId,
        userId,
        backupId: suspended?.backupId || undefined,
        env,
      });

      // Upsert DB record — persist internalUrl AND agentUrl
      const sessionData = {
        status: 'ready' as const,
        railwayServiceId: sandbox.id,
        railwayVolumeId: sandbox.volumeId,
        railwayVolumeInstanceId: sandbox.volumeInstanceId,
        sandboxSecret: sandbox.secret,
        internalUrl: sandbox.internalUrl,
        metadata: { agentUrl: sandbox.agentUrl },
        lastActivityAt: new Date(),
        suspendedAt: null,
      };

      if (suspended) {
        await db.update(sandboxSessions)
          .set(sessionData)
          .where(eq(sandboxSessions.id, suspended.id));
      } else {
        await db.insert(sandboxSessions).values({
          projectId,
          userId,
          provider: config.sandbox.provider,
          ...sessionData,
        });
      }

      // If first boot (no backup), send init data
      if (!suspended?.backupId) {
        try {
          const projectTracks = await db.select().from(tracks).where(eq(tracks.projectId, projectId));
          const trackIds = projectTracks.map(t => t.id);
          const allItems = trackIds.length > 0
            ? await db.select().from(timelineItems).where(inArray(timelineItems.trackId, trackIds))
            : [];

          const manifest = dbToManifest({
            project: {
              fps: project.fps || 30,
              durationMs: project.durationMs || 0,
              sourceWidth: project.sourceWidth || 1920,
              sourceHeight: project.sourceHeight || 1080,
              videoSettings: (project.videoSettings as Record<string, unknown>) || null,
            },
            tracks: projectTracks,
            items: allItems.map(item => ({
              ...item,
              data: (item.data as Record<string, unknown>) ?? {},
            })),
          });

          // Send init to sandbox
          const initRes = await fetch(`${sandbox.agentUrl}/init`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sandbox.secret}`,
            },
            body: JSON.stringify({
              videoUrl: project.videoKey ? `uploads/${project.videoKey}` : '',
              audioUrl: project.audioKey ? `uploads/${project.audioKey}` : undefined,
              manifest,
            }),
          });

          if (!initRes.ok) {
            logger.error({ status: initRes.status }, 'Sandbox init failed');
          }
        } catch (err) {
          logger.error({ err }, 'Failed to send init data to sandbox');
        }
      }

      return { status: 'ready', internalUrl: sandbox.internalUrl };
    });
  });

  // DELETE /projects/:id/sandbox — Suspend sandbox
  fastify.delete('/projects/:id/sandbox', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id: projectId } = request.params as { id: string };
    await suspendSandbox(projectId);
    return { status: 'suspended' };
  });

  // GET /projects/:id/sandbox/status
  fastify.get('/projects/:id/sandbox/status', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id: projectId } = request.params as { id: string };
    touchActivity(projectId);

    const [session] = await db.select().from(sandboxSessions)
      .where(eq(sandboxSessions.projectId, projectId))
      .limit(1);

    if (!session) {
      return { status: 'inactive' };
    }

    return {
      status: session.status,
      previewUrl: session.status === 'ready' ? `/api/projects/${projectId}/sandbox/bundle/player-composition.cjs.js` : null,
    };
  });

  // === Proxy Routes ===

  // GET /projects/:id/sandbox/bundle/* — Proxy bundle files
  fastify.get('/projects/:id/sandbox/bundle/*', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id: projectId } = request.params as { id: string };
    const path = (request.params as { '*': string })['*'];
    touchActivity(projectId);

    const session = await getActiveSession(projectId);
    if (!session) return reply.status(404).send({ error: 'No active sandbox' });

    await proxyFileRequest(session.internalUrl!, session.sandboxSecret, `/bundle/${path}`, request, reply);
  });

  // GET /projects/:id/sandbox/public/* — Proxy public files
  fastify.get('/projects/:id/sandbox/public/*', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id: projectId } = request.params as { id: string };
    const path = (request.params as { '*': string })['*'];
    touchActivity(projectId);

    const session = await getActiveSession(projectId);
    if (!session) return reply.status(404).send({ error: 'No active sandbox' });

    await proxyFileRequest(session.internalUrl!, session.sandboxSecret, `/public/${path}`, request, reply);
  });

  // POST /projects/:id/sandbox/prompt — Forward prompt to agent
  fastify.post('/projects/:id/sandbox/prompt', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id: projectId } = request.params as { id: string };
    touchActivity(projectId);

    const session = await getActiveSession(projectId);
    if (!session) return reply.status(404).send({ error: 'No active sandbox' });

    const agentUrl = (session.metadata as any)?.agentUrl;
    if (!agentUrl) return reply.status(500).send({ error: 'Agent URL not found in session' });

    await proxyPrompt(agentUrl, session.sandboxSecret, request.body as any, reply);
  });

  // GET /projects/:id/sandbox/manifest — Read manifest from sandbox
  fastify.get('/projects/:id/sandbox/manifest', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id: projectId } = request.params as { id: string };
    touchActivity(projectId);

    const session = await getActiveSession(projectId);
    if (!session) return reply.status(404).send({ error: 'No active sandbox' });

    const agentUrl = (session.metadata as any)?.agentUrl;
    if (!agentUrl) return reply.status(500).send({ error: 'Agent URL not found in session' });
    const result = await proxyManifestOp(agentUrl, session.sandboxSecret, 'GET');
    return reply.status(result.status).send(result.data);
  });

  // PATCH /projects/:id/sandbox/manifest — Write manifest op to sandbox
  fastify.patch('/projects/:id/sandbox/manifest', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id: projectId } = request.params as { id: string };
    touchActivity(projectId);

    const session = await getActiveSession(projectId);
    if (!session) return reply.status(404).send({ error: 'No active sandbox' });

    const agentUrl = (session.metadata as any)?.agentUrl;
    if (!agentUrl) return reply.status(500).send({ error: 'Agent URL not found in session' });
    const result = await proxyManifestOp(agentUrl, session.sandboxSecret, 'PATCH', request.body as object);
    return reply.status(result.status).send(result.data);
  });

  // POST /projects/:id/sandbox/ops — Granular manifest operations
  fastify.post('/projects/:id/sandbox/ops', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id: projectId } = request.params as { id: string };
    touchActivity(projectId);

    const session = await getActiveSession(projectId);
    if (!session) return reply.status(404).send({ error: 'No active sandbox' });

    const agentUrl = (session.metadata as any)?.agentUrl;
    if (!agentUrl) return reply.status(500).send({ error: 'Agent URL not found in session' });

    const result = await proxyOps(agentUrl, session.sandboxSecret, request.body as any);
    return reply.status(result.status).send(result.data);
  });

  // === Internal Callbacks (Sandbox → API) ===

  async function validateInternalCallback(request: any, reply: any): Promise<string | null> {
    const { id: projectId } = request.params as { id: string };
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      reply.status(401).send({ error: 'Missing authorization' });
      return null;
    }
    const token = authHeader.slice(7);
    const [session] = await db.select().from(sandboxSessions)
      .where(and(eq(sandboxSessions.projectId, projectId), eq(sandboxSessions.sandboxSecret, token)))
      .limit(1);
    if (!session) {
      reply.status(403).send({ error: 'Invalid secret' });
      return null;
    }
    return projectId;
  }

  // POST /internal/sandbox/:id/ready
  fastify.post('/internal/sandbox/:id/ready', async (request, reply) => {
    const projectId = await validateInternalCallback(request, reply);
    if (!projectId) return;
    logger.info({ projectId }, 'Sandbox reports ready');
    const bundleBaseUrl = `/api/projects/${projectId}/sandbox/bundle`;
    await emitWorkspaceReady(projectId, { bundleUrl: bundleBaseUrl });
    return { ok: true };
  });

  // POST /internal/sandbox/:id/bundle-ready
  fastify.post('/internal/sandbox/:id/bundle-ready', async (request, reply) => {
    const projectId = await validateInternalCallback(request, reply);
    if (!projectId) return;
    const { version } = request.body as { version: number };
    logger.info({ projectId, version }, 'Bundle ready');
    const bundleBaseUrl = `/api/projects/${projectId}/sandbox/bundle`;
    await emitBundleReady(projectId, { bundleUrl: bundleBaseUrl });
    return { ok: true };
  });

  // POST /internal/sandbox/:id/manifest-updated
  fastify.post('/internal/sandbox/:id/manifest-updated', async (request, reply) => {
    const projectId = await validateInternalCallback(request, reply);
    if (!projectId) return;
    await emitManifestUpdated(projectId, { source: 'ai' });

    // Debounced DB sync
    const session = await getActiveSession(projectId);
    if (session) {
      const agentUrl = (session.metadata as any)?.agentUrl;
      if (agentUrl) {
        debouncedSync(projectId, agentUrl, session.sandboxSecret);
      }
    }

    return { ok: true };
  });

  // POST /internal/sandbox/:id/checkpoint — Accept but don't persist to DB
  fastify.post('/internal/sandbox/:id/checkpoint', async (request, reply) => {
    const projectId = await validateInternalCallback(request, reply);
    if (!projectId) return;
    // Checkpoint data lives in sandbox volume only — no DB sync
    logger.debug({ projectId }, 'Checkpoint received (not persisted to DB)');
    return { ok: true };
  });
}

// Helper: get active sandbox session from DB
async function getActiveSession(projectId: string) {
  const [session] = await db.select().from(sandboxSessions)
    .where(and(eq(sandboxSessions.projectId, projectId), eq(sandboxSessions.status, 'ready')))
    .limit(1);
  return session;
}

// Suspend a sandbox: checkpoint, backup, destroy, update DB
async function suspendSandbox(projectId: string): Promise<void> {
  await withProjectMutex(projectId, async () => {
    const session = await getActiveSession(projectId);
    if (!session) return;

    const p = await getProvider();

    try {
      await db.update(sandboxSessions)
        .set({ status: 'suspending' })
        .where(eq(sandboxSessions.id, session.id));

      const sandboxMeta = {
        id: session.railwayServiceId!,
        projectId: session.projectId,
        volumeId: session.railwayVolumeId!,
        volumeInstanceId: session.railwayVolumeInstanceId!,
      };

      const backupId = await p.backup(sandboxMeta);
      await p.destroy(sandboxMeta);

      await db.update(sandboxSessions)
        .set({
          status: 'suspended',
          backupId,
          railwayServiceId: null,
          railwayVolumeId: null,
          railwayVolumeInstanceId: null,
          internalUrl: null,
          metadata: {},
          suspendedAt: new Date(),
        })
        .where(eq(sandboxSessions.id, session.id));

      removeActivity(projectId);

      await emitWorkspaceTeardown(projectId);

      logger.info({ projectId }, 'Sandbox suspended');
    } catch (err) {
      logger.error({ err, projectId }, 'Failed to suspend sandbox');
      throw err;
    }
  });
}

/**
 * On API restart, rehydrate sandbox state from DB.
 * Any sandbox marked 'ready' or 'creating' in DB needs to be:
 * - health-checked (if 'ready')
 * - cleaned up (if 'creating' — partial creation interrupted by crash)
 * - idle timers re-established
 */
export async function rehydrateActiveSandboxes(): Promise<void> {
  const activeSessions = await db.select().from(sandboxSessions)
    .where(inArray(sandboxSessions.status, ['ready', 'creating', 'suspending']));

  logger.info({ count: activeSessions.length }, 'Rehydrating sandbox sessions after restart');

  for (const session of activeSessions) {
    if (session.status === 'creating' || session.status === 'suspending') {
      // Partial operation interrupted by crash — mark as failed and clean up
      logger.warn({ projectId: session.projectId, status: session.status },
        'Found interrupted sandbox operation, cleaning up');
      await db.update(sandboxSessions)
        .set({ status: 'suspended', suspendedAt: new Date() })
        .where(eq(sandboxSessions.id, session.id));
      continue;
    }

    // Status is 'ready' — verify the sandbox is actually reachable
    if (session.internalUrl) {
      const p = await getProvider();
      const healthy = await p.isReady(session.internalUrl);

      if (healthy) {
        // Re-establish idle tracking
        touchActivity(session.projectId);
        logger.info({ projectId: session.projectId }, 'Sandbox still alive after restart');
      } else {
        // Sandbox died (container was removed, etc.) — mark suspended
        logger.warn({ projectId: session.projectId }, 'Sandbox unreachable after restart, marking suspended');
        await db.update(sandboxSessions)
          .set({ status: 'suspended', suspendedAt: new Date() })
          .where(eq(sandboxSessions.id, session.id));
      }
    }
  }
}

// Exported for crash recovery (Task 27)
export { getProvider, getActiveSession, suspendSandbox };
