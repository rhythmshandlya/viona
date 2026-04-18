import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import { existsSync, mkdirSync, createReadStream } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { execSync } from 'child_process';
import { sql } from 'drizzle-orm';
import { config } from './config.js';
import { logger } from './logger.js';
import { runMigrations } from './db/migrate.js';
import { ensureBuckets, getObjectStream, objectExists, listObjects } from './services/minio.js';
import { projectRoutes } from './routes/projects.js';
import { userRoutes } from './routes/users.js';
import { agentRoutes } from './agent/agent-router.js';
import { waitlistRoutes } from './routes/waitlist.js';
import { youtubeClipRoutes } from './routes/youtube-clips.js';
import { jobRoutes } from './routes/jobs.js';
import { setupWebSocket } from './ws/handler.js';
import { authMiddleware } from './middleware/auth.js';
import { workspaceRoutes } from './workspace/workspace-routes.js';
import { createSandboxRoutes } from './sandbox/routes.js';
import { sandboxManager } from './sandbox/manager.js';
import { templateRoutes } from './routes/templates.js';
import { templateBundleRoutes } from './routes/template-bundle.js';

const isProduction = !!process.env.RAILWAY_ENVIRONMENT;

/** Reject path segments that escape the intended directory (e.g. `../`, `..\\`, null bytes) */
function sanitizeFilePath(raw: string): string | null {
  if (raw.includes('\0')) return null;
  const normalized = raw.replace(/\\/g, '/');
  if (normalized.includes('..') || normalized.startsWith('/')) return null;
  return normalized;
}

async function main() {
  // Run database migrations before starting the server
  try {
    await runMigrations();
  } catch (err) {
    logger.error({ err }, 'Migration failed');
    process.exit(1);
  }

  // COOKIE_SECRET validation is now handled by config.ts Zod schema

  const fastify = Fastify({
    logger: {
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // Register plugins
  await fastify.register(cors, {
    origin: isProduction
      ? (config.corsOrigin ? config.corsOrigin.split(',') : true)
      : true,
    credentials: true,
  });

  await fastify.register(rateLimit, {
    max: 5000,
    timeWindow: '1 minute',
  });

  await fastify.register(cookie, {
    secret: process.env.COOKIE_SECRET || 'viona-dev-secret-change-in-production',
  });

  await fastify.register(multipart, {
    limits: {
      fileSize: 500 * 1024 * 1024, // 500MB max file size
    },
  });

  await fastify.register(websocket);

  // Serve bundles statically (local development only)
  // In production (Railway), bundles are on separate worker containers
  if (!isProduction) {
    if (!existsSync(config.bundles.dir)) {
      mkdirSync(config.bundles.dir, { recursive: true });
    }
    await fastify.register(fastifyStatic, {
      root: config.bundles.dir,
      prefix: '/bundles/',
      decorateReply: false,
    });
    fastify.log.info(`Serving bundles from: ${config.bundles.dir}`);
  }

  // Bundle serving from S3 (production) or local filesystem (development fallback)
  // Route: /api/bundles/:compositionId/*
  // In production: auth required, streams from S3
  // In development: no auth, serves from local bundles dir (for DB rows with /api/bundles/ URLs)
  const bundlePreHandlers = isProduction ? [authMiddleware] : [];
  fastify.get('/api/bundles/:compositionId/*', { preHandler: bundlePreHandlers }, async (request, reply) => {
    const { compositionId: rawId } = request.params as { compositionId: string };
    const compositionId = sanitizeFilePath(rawId);
    if (!compositionId) return reply.code(400).send({ error: 'Invalid composition ID' });
    const rawPath = (request.params as { '*': string })['*'] || 'index.html';
    const filePath = sanitizeFilePath(rawPath);
    if (!filePath) return reply.code(400).send({ error: 'Invalid file path' });

    // In development, serve from local filesystem first
    if (!isProduction) {
      const localPath = join(config.bundles.dir, compositionId, filePath);
      if (existsSync(localPath)) {
        const ext = filePath.split('.').pop()?.toLowerCase() || '';
        const types: Record<string, string> = { js: 'application/javascript', cjs: 'application/javascript', html: 'text/html', css: 'text/css', json: 'application/json', png: 'image/png', svg: 'image/svg+xml' };
        reply.header('Content-Type', types[ext] || 'application/octet-stream');
        return reply.send(createReadStream(localPath));
      }
    }

    // Construct S3 key: outputs/bundles/{compositionId}/{filePath}
    const s3Key = `bundles/${compositionId}/${filePath}`;

    try {
      // Check if file exists
      const exists = await objectExists('outputs', s3Key);
      if (!exists) {
        return reply.code(404).send({ error: 'Bundle file not found' });
      }

      // Get content type based on file extension
      const ext = filePath.split('.').pop()?.toLowerCase() || '';
      const contentTypes: Record<string, string> = {
        'html': 'text/html',
        'js': 'application/javascript',
        'cjs': 'application/javascript',
        'mjs': 'application/javascript',
        'css': 'text/css',
        'json': 'application/json',
        'map': 'application/json',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'svg': 'image/svg+xml',
        'woff': 'font/woff',
        'woff2': 'font/woff2',
        'ttf': 'font/ttf',
      };

      const contentType = contentTypes[ext] || 'application/octet-stream';
      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'no-cache'); // Always revalidate — bundles change on regeneration

      // Stream file from S3
      const stream = await getObjectStream('outputs', s3Key);
      return reply.send(stream);
    } catch (err) {
      fastify.log.error({ err, compositionId, filePath }, 'Failed to serve bundle');
      return reply.code(500).send({ error: 'Failed to serve bundle' });
    }
  });

  // Production source files serving from S3
  // Route: /api/sources/:compositionId/*
  // These are the source project files (index.tsx, metadata.json, etc.) for AI context restoration
  fastify.get('/api/sources/:compositionId/*', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { compositionId: rawId } = request.params as { compositionId: string };
    const compositionId = sanitizeFilePath(rawId);
    if (!compositionId) return reply.code(400).send({ error: 'Invalid composition ID' });
    const rawPath = (request.params as { '*': string })['*'] || 'index.tsx';
    const filePath = sanitizeFilePath(rawPath);
    if (!filePath) return reply.code(400).send({ error: 'Invalid file path' });

    // Construct S3 key: outputs/sources/{compositionId}/{filePath}
    const s3Key = `sources/${compositionId}/${filePath}`;

    try {
      // Check if file exists
      const exists = await objectExists('outputs', s3Key);
      if (!exists) {
        return reply.code(404).send({ error: 'Source file not found' });
      }

      // Get content type based on file extension
      const ext = filePath.split('.').pop()?.toLowerCase() || '';
      const contentTypes: Record<string, string> = {
        'tsx': 'text/typescript',
        'ts': 'text/typescript',
        'jsx': 'text/javascript',
        'js': 'application/javascript',
        'json': 'application/json',
        'css': 'text/css',
      };

      const contentType = contentTypes[ext] || 'text/plain';
      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

      // Stream file from S3
      const stream = await getObjectStream('outputs', s3Key);
      return reply.send(stream);
    } catch (err) {
      fastify.log.error({ err, compositionId, filePath }, 'Failed to serve source file');
      return reply.code(500).send({ error: 'Failed to serve source file' });
    }
  });

  // List all source files for a composition (for restoring AI context)
  fastify.get('/api/sources/:compositionId', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { compositionId: rawId } = request.params as { compositionId: string };
    const compositionId = sanitizeFilePath(rawId);
    if (!compositionId) return reply.code(400).send({ error: 'Invalid composition ID' });

    try {
      // List all files in the source directory
      const rawFiles = await listObjects('outputs', `sources/${compositionId}/`);
      const files = rawFiles.map(f => f.replace(`sources/${compositionId}/`, ''));

      // Categorize files for AI context restoration
      const planFiles = files.filter(f => f.endsWith('.md') || f === 'scenes.json');
      const codeFiles = files.filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
      const configFiles = files.filter(f => f.endsWith('.json') && f !== 'scenes.json');

      return {
        compositionId,
        files,
        categories: {
          // AI planning context - Director's plan and implementation log
          planning: planFiles,
          // Source code - compositions, scenes, components
          code: codeFiles,
          // Configuration - metadata, etc.
          config: configFiles,
        },
        // Suggested restore order for AI context
        restoreOrder: [
          'SCENE_PLAN.md',           // Director's visual story plan
          'IMPLEMENTATION_LOG.md',   // Implementation decisions
          'scenes.json',             // Scene definitions
          'metadata.json',           // Composition metadata
          'constants.ts',            // Colors, timing configs
          'index.tsx',               // Main composition
          ...files.filter(f => f.startsWith('components/')),
          ...files.filter(f => f.startsWith('scenes/')),
        ].filter(f => files.includes(f)),
      };
    } catch (err) {
      fastify.log.error({ err, compositionId }, 'Failed to list source files');
      return reply.code(500).send({ error: 'Failed to list source files' });
    }
  });

  // Health check — probes DB and Redis so load balancers route to healthy instances
  fastify.get('/health', async (_request, reply) => {
    const checks: Record<string, 'ok' | 'fail'> = {};

    // Check database
    try {
      const { db } = await import('./db/index.js');
      await db.execute(sql`SELECT 1`);
      checks.database = 'ok';
    } catch {
      checks.database = 'fail';
    }

    // Check Redis
    let redis: import('ioredis').default | undefined;
    try {
      const { default: Redis } = await import('ioredis');
      redis = new Redis(config.redis.url, { lazyConnect: true, connectTimeout: 3000 });
      await redis.ping();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'fail';
    } finally {
      await redis?.quit().catch(() => {});
    }

    const healthy = Object.values(checks).every(v => v === 'ok');
    return reply.code(healthy ? 200 : 503).send({
      status: healthy ? 'ok' : 'degraded',
      checks,
    });
  });

  // Debug: test claude subprocess (dev-only — spawns Claude CLI with no auth)
  if (!isProduction) {
    fastify.get('/debug/claude-test', async (_request, reply) => {
      const { spawn } = await import('child_process');
      return new Promise((resolve) => {
        const proc = spawn('claude', ['-p', 'say hello in 5 words', '--output-format', 'text'], {
          env: { ...process.env, CLAUDECODE: undefined },
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
        proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
        proc.on('close', (code: number) => {
          reply.send({ code, stdout: stdout.slice(0, 500), stderr: stderr.slice(0, 500) });
          resolve(undefined);
        });
        setTimeout(() => { proc.kill(); reply.send({ error: 'timeout', stderr: stderr.slice(0, 500) }); resolve(undefined); }, 30000);
      });
    });
  }

  // Register routes
  await fastify.register(projectRoutes, { prefix: '/api' });
  await fastify.register(userRoutes, { prefix: '/api' });
  await fastify.register(agentRoutes, { prefix: '/api' });
  await fastify.register(waitlistRoutes, { prefix: '/api' });
  await fastify.register(youtubeClipRoutes, { prefix: '/api' });
  await fastify.register(jobRoutes, { prefix: '/api' });
  await fastify.register(workspaceRoutes, { prefix: '/api' });
  await fastify.register(createSandboxRoutes(sandboxManager), { prefix: '/api' });
  await fastify.register(templateRoutes, { prefix: '/api' });
  await fastify.register(templateBundleRoutes, { prefix: '/api' });

  // Setup WebSocket
  await setupWebSocket(fastify);

  // Ensure storage bucket exists
  try {
    await ensureBuckets();
    fastify.log.info('Storage bucket ready');
  } catch (err) {
    fastify.log.error(err, 'Failed to ensure storage bucket');
    // Continue anyway, bucket might already exist
  }

  // Verify Claude CLI is available for Agent SDK
  // Auth is handled automatically by the Agent SDK via the user's existing Claude Code
  // OAuth session (from `claude login`). No separate token env var is needed.
  try {
    const claudeVersion = execSync('claude --version 2>&1', { encoding: 'utf-8', timeout: 10000 }).trim();
    fastify.log.info(`Claude CLI available: ${claudeVersion}`);
  } catch (err: any) {
    fastify.log.error(`Claude CLI check failed: ${err.message}\nstdout: ${err.stdout}\nstderr: ${err.stderr}`);
  }

  // Start server
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    fastify.log.info(`Server running at http://localhost:${config.port}`);

    // Clean up orphaned workspaces from previous runs (fire-and-forget)
    import('./workspace/workspace-service.js').then(({ cleanupOrphanedWorkspaces }) => {
      cleanupOrphanedWorkspaces().catch((err) => {
        fastify.log.error(err, '[startup] Failed to clean up orphaned workspaces');
      });
    });

    // Start sandbox monitoring (health sweep, GC, idle suspension, rehydration)
    sandboxManager.startMonitoring();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  // Graceful shutdown — backup sandboxes, close server, finish in-flight requests
  const shutdown = async (signal: string) => {
    fastify.log.info({ signal }, 'Received shutdown signal, closing server...');

    const timeout = setTimeout(() => {
      fastify.log.error('Shutdown timeout exceeded (30s), forcing exit');
      process.exit(1);
    }, 30_000);

    try {
      await sandboxManager.stopMonitoring();
      await fastify.close();
      fastify.log.info('Server closed gracefully');
    } catch (err) {
      fastify.log.error({ err }, 'Error during shutdown');
    }
    clearTimeout(timeout);
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Safety net: log unhandled rejections instead of crashing the process.
  // The primary fix is in proxy.ts (catching AbortError from reader.read()),
  // but this prevents any stray rejection from killing the server.
  process.on('unhandledRejection', (reason, promise) => {
    // AbortErrors from fetch/stream cancellation are expected during client disconnect
    if (reason instanceof DOMException && reason.name === 'AbortError') {
      fastify.log.debug({ err: reason.message }, 'Suppressed AbortError (client disconnect)');
      return;
    }
    fastify.log.error({ err: reason }, 'Unhandled promise rejection');
  });
}

main();
