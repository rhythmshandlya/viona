import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { apiProgressStore } from '../progress/progress-store.js';

export async function jobRoutes(fastify: FastifyInstance) {
  // GET /jobs/:id/activity — fetch activity log + current progress for a job
  fastify.get<{ Params: { id: string } }>('/jobs/:id/activity', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params;
    const [activity, progress] = await Promise.all([
      apiProgressStore.getActivity(id),
      apiProgressStore.get(id),
    ]);
    return { activity, progress };
  });
}
