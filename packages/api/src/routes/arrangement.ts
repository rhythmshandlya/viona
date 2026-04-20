import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { computeArrangement } from '../services/arrangement-orchestrator.js';
import { db, projects } from '../db/index.js';

/**
 * Returns true iff the given user owns the given project.
 * Used to gate /projects/:id/arrangement/* endpoints so one user cannot
 * force-run the arrangement agent against another user's project (S2).
 */
async function requireProjectOwnership(projectId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ userId: projects.userId })
    .from(projects)
    .where(eq(projects.id, projectId));
  if (rows.length === 0) return false;
  return rows[0].userId === userId;
}

const arrangementRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authMiddleware);

  fastify.post<{ Params: { id: string } }>(
    '/projects/:id/arrangement/compute',
    async (request, reply) => {
      const userId = request.user!.id;
      const { id: projectId } = request.params;

      if (!(await requireProjectOwnership(projectId, userId))) {
        return reply.code(403).send({ error: 'forbidden' });
      }

      try {
        const output = await computeArrangement(projectId);
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
