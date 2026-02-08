import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, projects, users } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

export async function userRoutes(fastify: FastifyInstance) {
  // Get current user profile
  fastify.get('/users/me', { preHandler: authMiddleware }, async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    return {
      id: request.user.id,
      email: request.user.email,
      name: request.user.name,
      avatarUrl: request.user.avatarUrl,
      createdAt: request.user.createdAt,
    };
  });

  // Update current user profile
  fastify.patch('/users/me', { preHandler: authMiddleware }, async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const body = request.body as { name?: string; avatarUrl?: string };

    const [updated] = await db.update(users)
      .set({
        name: body.name !== undefined ? body.name : request.user.name,
        avatarUrl: body.avatarUrl !== undefined ? body.avatarUrl : request.user.avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, request.user.id))
      .returning();

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatarUrl: updated.avatarUrl,
      createdAt: updated.createdAt,
    };
  });

  // Get current user's projects
  fastify.get('/users/me/projects', { preHandler: authMiddleware }, async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const userProjects = await db.query.projects.findMany({
      where: eq(projects.userId, request.user.id),
      orderBy: (projects, { desc }) => [desc(projects.createdAt)],
    });

    return userProjects.map(project => ({
      id: project.id,
      status: project.status,
      videoKey: project.videoKey,
      durationMs: project.durationMs,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }));
  });

  // Delete current user account
  fastify.delete('/users/me', { preHandler: authMiddleware }, async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // Note: Projects will have userId set to NULL due to ON DELETE SET NULL
    await db.delete(users).where(eq(users.id, request.user.id));

    return { success: true, message: 'Account deleted' };
  });
}
