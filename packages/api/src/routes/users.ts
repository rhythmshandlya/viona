import { FastifyInstance } from 'fastify';
import { eq, and, or, ilike, sql, asc, desc } from 'drizzle-orm';
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

  // Get current user's projects (with pagination, sorting, filtering)
  fastify.get('/users/me/projects', { preHandler: authMiddleware }, async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const query = request.query as {
      page?: string;
      limit?: string;
      sortBy?: string;
      sortOrder?: string;
      status?: string;
      search?: string;
    };

    const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '12', 10) || 12));
    const offset = (page - 1) * limit;

    // Sorting
    const sortByField = query.sortBy || 'createdAt';
    const sortDirection = query.sortOrder === 'asc' ? asc : desc;

    const sortColumn =
      sortByField === 'title' ? projects.title :
      sortByField === 'updatedAt' ? projects.updatedAt :
      sortByField === 'status' ? projects.status :
      projects.createdAt;

    // Filters
    const conditions = [eq(projects.userId, request.user.id)];

    if (query.status) {
      const statuses = query.status.split(',');
      if (statuses.length === 1) {
        conditions.push(eq(projects.status, statuses[0]));
      } else {
        conditions.push(or(...statuses.map(s => eq(projects.status, s)))!);
      }
    }

    if (query.search) {
      conditions.push(ilike(projects.title, `%${query.search}%`));
    }

    const where = and(...conditions)!;

    // Get total count and paginated results in parallel
    const [countResult, userProjects] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(projects)
        .where(where),
      db.select()
        .from(projects)
        .where(where)
        .orderBy(sortDirection(sortColumn))
        .limit(limit)
        .offset(offset),
    ]);

    const total = Number(countResult[0].count);

    return {
      items: userProjects.map(project => ({
        id: project.id,
        title: project.title,
        status: project.status,
        projectType: project.projectType,
        videoKey: project.videoKey,
        audioKey: project.audioKey,
        thumbnailKey: project.thumbnailKey,
        durationMs: project.durationMs,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
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
