import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import { existsSync, mkdirSync } from 'fs';
import { pipeline } from 'stream/promises';
import { config } from './config.js';
import { ensureBuckets, getObjectStream, objectExists, listObjects } from './services/minio.js';
import { projectRoutes } from './routes/projects.js';
import { userRoutes } from './routes/users.js';
import { agentRoutes } from './agent/agent-router.js';
import { setupWebSocket } from './ws/handler.js';

const isProduction = !!process.env.RAILWAY_ENVIRONMENT;

async function main() {
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
    origin: true, // Allow all origins in development
    credentials: true,
  });

  await fastify.register(cookie, {
    secret: process.env.COOKIE_SECRET || 'cllipify-dev-secret-change-in-production',
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

  // Production bundle serving from S3
  // Route: /api/bundles/:compositionId/*
  fastify.get('/api/bundles/:compositionId/*', async (request, reply) => {
    const { compositionId } = request.params as { compositionId: string };
    const filePath = (request.params as { '*': string })['*'] || 'index.html';

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
      reply.header('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

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
  fastify.get('/api/sources/:compositionId/*', async (request, reply) => {
    const { compositionId } = request.params as { compositionId: string };
    const filePath = (request.params as { '*': string })['*'] || 'index.tsx';

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
  fastify.get('/api/sources/:compositionId', async (request, reply) => {
    const { compositionId } = request.params as { compositionId: string };

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

  // Health check
  fastify.get('/health', async () => ({ status: 'ok' }));

  // Register routes
  await fastify.register(projectRoutes, { prefix: '/api' });
  await fastify.register(userRoutes, { prefix: '/api' });
  await fastify.register(agentRoutes, { prefix: '/api' });

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

  // Start server
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    fastify.log.info(`Server running at http://localhost:${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
