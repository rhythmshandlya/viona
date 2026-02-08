import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import { existsSync, mkdirSync } from 'fs';
import { pipeline } from 'stream/promises';
import { config } from './config.js';
import { ensureBuckets, getObjectStream, objectExists } from './services/minio.js';
import { projectRoutes } from './routes/projects.js';
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

  // Health check
  fastify.get('/health', async () => ({ status: 'ok' }));

  // Register routes
  await fastify.register(projectRoutes, { prefix: '/api' });

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
