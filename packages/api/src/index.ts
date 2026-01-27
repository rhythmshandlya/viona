import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { config } from './config.js';
import { ensureBuckets } from './services/minio.js';
import { projectRoutes } from './routes/projects.js';
import { setupWebSocket } from './ws/handler.js';

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

  // Health check
  fastify.get('/health', async () => ({ status: 'ok' }));

  // Register routes
  await fastify.register(projectRoutes, { prefix: '/api' });

  // Setup WebSocket
  await setupWebSocket(fastify);

  // Ensure MinIO buckets exist
  try {
    await ensureBuckets();
    fastify.log.info('MinIO buckets ready');
  } catch (err) {
    fastify.log.error(err, 'Failed to ensure MinIO buckets');
    // Continue anyway, buckets might already exist
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
