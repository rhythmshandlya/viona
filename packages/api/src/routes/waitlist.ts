import { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db, waitlist } from '../db/index.js';

export async function waitlistRoutes(fastify: FastifyInstance) {
  // Submit email to waitlist
  fastify.post('/waitlist', async (request, reply) => {
    const body = request.body as { email?: string };

    if (!body.email || typeof body.email !== 'string') {
      return reply.status(400).send({ error: 'Email is required' });
    }

    const email = body.email.trim().toLowerCase();

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reply.status(400).send({ error: 'Invalid email address' });
    }

    try {
      // Insert or ignore if already exists
      await db
        .insert(waitlist)
        .values({ email })
        .onConflictDoNothing({ target: waitlist.email });

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(waitlist);

      return { success: true, count };
    } catch (err) {
      fastify.log.error(err, 'Failed to add to waitlist');
      return reply.status(500).send({ error: 'Something went wrong' });
    }
  });

  // Get waitlist count
  fastify.get('/waitlist/count', async (_request, reply) => {
    try {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(waitlist);

      return { count };
    } catch (err) {
      fastify.log.error(err, 'Failed to get waitlist count');
      return reply.status(500).send({ error: 'Something went wrong' });
    }
  });
}
