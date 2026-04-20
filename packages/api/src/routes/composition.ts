import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { projects } from '../db/schema.js';
import { loadComposition } from '../services/composition-loader.js';

/**
 * Returns true iff the given user owns the given project. Gates the
 * composition-v2 endpoint so one user cannot read another user's timeline.
 */
async function requireProjectOwnership(projectId: string, userId: string): Promise<boolean> {
  const rows = await db.select({ userId: projects.userId }).from(projects).where(eq(projects.id, projectId));
  return rows.length > 0 && rows[0].userId === userId;
}

const compositionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authMiddleware);

  fastify.get<{ Params: { id: string } }>(
    '/projects/:id/composition-v2',
    async (request, reply) => {
      const userId = request.user!.id;
      const projectId = request.params.id;

      if (!(await requireProjectOwnership(projectId, userId))) {
        return reply.code(403).send({ error: 'forbidden' });
      }

      const composition = await loadComposition({ projectId, userId });
      return reply.send(composition);
    },
  );
};

export default compositionRoutes;
