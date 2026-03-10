import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { apiProgressStore } from '../progress/progress-store.js';
import { db } from '../db/index.js';
import { jobs, projects } from '../db/schema.js';

export async function jobRoutes(fastify: FastifyInstance) {
  // GET /jobs/:id/activity — fetch activity log + current progress for a job
  fastify.get<{ Params: { id: string } }>('/jobs/:id/activity', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params;

    if (!request.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // Verify the user owns the job's project
    const job = await db.query.jobs.findFirst({ where: eq(jobs.id, id) });
    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }
    const project = await db.query.projects.findFirst({ where: eq(projects.id, job.projectId) });
    if (!project || project.userId !== request.user.id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const [activity, progress] = await Promise.all([
      apiProgressStore.getActivity(id),
      apiProgressStore.get(id),
    ]);
    return { activity, progress };
  });
}
