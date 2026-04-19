import type { FastifyPluginAsync } from 'fastify';
import { PassThrough } from 'node:stream';
import { authMiddleware } from '../middleware/auth.js';
import { redis } from '../services/redis.js';

const assetEventsSseRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/asset-events', { preHandler: authMiddleware }, async (request, reply) => {
    const userId = request.user!.id;
    const channel = `asset-events:${userId}`;

    const sub = redis.duplicate();
    const stream = new PassThrough();

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');

    await sub.subscribe(channel);
    sub.on('message', (_ch, message) => {
      stream.write(`data: ${message}\n\n`);
    });

    // Initial comment so the connection is visible to the client immediately.
    stream.write(': connected\n\n');

    request.raw.on('close', () => {
      void sub.unsubscribe(channel).catch(() => { /* ignore */ });
      sub.disconnect();
      stream.end();
    });

    return reply.send(stream);
  });
};

export default assetEventsSseRoutes;
