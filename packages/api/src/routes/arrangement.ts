import type { FastifyPluginAsync } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { computeArrangement } from '../services/arrangement-orchestrator.js';

const arrangementRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authMiddleware);

  fastify.post<{ Params: { id: string } }>(
    '/projects/:id/arrangement/compute',
    async (request, reply) => {
      try {
        const output = await computeArrangement(request.params.id);
        return reply.send(output);
      } catch (err) {
        request.log.error({ err }, 'arrangement compute failed');
        return reply.code(500).send({
          error: 'arrangement_failed',
          message: (err as Error).message,
        });
      }
    },
  );
};

export default arrangementRoutes;
