import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { existsSync, mkdirSync } from 'fs';
import { config } from './config.js';
import { ensureBuckets } from './services/minio.js';
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
