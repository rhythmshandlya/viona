import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { computeArrangement } from '../services/arrangement-orchestrator.js';
import { db, projects } from '../db/index.js';
import { redis } from '../services/redis.js';

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

// Per-user token bucket for /arrangement/compute. Each compute call invokes
// Claude Opus — a runaway client retry loop or malicious user can burn quota
// at $10-30/min, so we hard-cap to 2 requests per 30s per user via Redis INCR.
const RATE_LIMIT_WINDOW_SECONDS = 30;
const RATE_LIMIT_MAX_REQUESTS = 2;

async function checkArrangementRateLimit(userId: string): Promise<boolean> {
  const key = `rate:arrangement:${userId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
  }
  return count <= RATE_LIMIT_MAX_REQUESTS;
}

const arrangementRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authMiddleware);

  fastify.post<{ Params: { id: string } }>(
    '/projects/:id/arrangement/compute',
    async (request, reply) => {
      const userId = request.user!.id;
      const { id: projectId } = request.params;

      // Rate-limit check runs BEFORE ownership check — fail-fast saves a DB query
      // when a user is hammering the endpoint.
      if (!(await checkArrangementRateLimit(userId))) {
        return reply.code(429).send({
          error: 'rate_limited',
          message: `Max ${RATE_LIMIT_MAX_REQUESTS} arrangement calls per ${RATE_LIMIT_WINDOW_SECONDS}s per user`,
        });
      }

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
