import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { inferenceJobs, sandboxSessions } from '../db/schema.js';
import { getRedis, getRedisSubscriber } from '../services/redis.js';
import { logger } from '../logger.js';
import { getCapability } from './registry.js';
import { dispatchInference } from './dispatcher.js';
import { verifyWebhookToken } from './webhook-auth.js';

interface SandboxBearerContext {
  projectId: string;
  sandboxSessionId: string;
}

async function validateSandboxBearer(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<SandboxBearerContext | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.status(401).send({ error: 'missing bearer' });
    return null;
  }
  const token = authHeader.slice(7);
  const id = (req.params as { id?: string } | undefined)?.id;
  if (!id) {
    reply.status(400).send({ error: 'missing sandbox id' });
    return null;
  }
  const [session] = await db
    .select()
    .from(sandboxSessions)
    .where(eq(sandboxSessions.id, id))
    .limit(1);
  // Plain string compare matches existing `validateInternalCallback` in
  // sandbox/routes.ts. Not a critical fix for internal-only routes; consistency
  // with the rest of the codebase wins.
  if (!session || session.sandboxSecret !== token) {
    reply.status(401).send({ error: 'invalid bearer' });
    return null;
  }
  if (!session.projectId) {
    // Defensive — schema says projectId is notNull, but narrow for TS.
    reply.status(500).send({ error: 'sandbox session missing projectId' });
    return null;
  }
  return { projectId: session.projectId, sandboxSessionId: session.id };
}

export async function registerInferenceRoutes(fastify: FastifyInstance): Promise<void> {
  // ---- POST /internal/sandbox/:id/inference ----
  fastify.post('/internal/sandbox/:id/inference', async (request, reply) => {
    const ctx = await validateSandboxBearer(request, reply);
    if (!ctx) return;

    const body = request.body as { capability?: string; input?: unknown } | undefined;
    if (!body?.capability || body.input === undefined || body.input === null) {
      return reply.status(400).send({ error: 'capability and input are required' });
    }

    try {
      const result = await dispatchInference({
        capability: body.capability,
        input: body.input,
        projectId: ctx.projectId,
        sandboxSessionId: ctx.sandboxSessionId,
      });
      return { jobId: result.jobId };
    } catch (err) {
      logger.error(
        { err: (err as Error).message, capability: body.capability },
        'dispatch failed',
      );
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // ---- POST /internal/runpod/callback/:jobId ----
  fastify.post('/internal/runpod/callback/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const { token } = (request.query as { token?: string }) ?? {};
    if (!token) return reply.status(401).send({ error: 'missing token' });

    const [row] = await db
      .select()
      .from(inferenceJobs)
      .where(eq(inferenceJobs.id, jobId))
      .limit(1);
    if (!row) return reply.status(404).send({ error: 'unknown job' });

    try {
      await verifyWebhookToken(token, jobId, row.capability);
    } catch (err) {
      logger.warn(
        { jobId, err: (err as Error).message },
        'webhook auth rejected',
      );
      return reply.status(401).send({ error: 'invalid token' });
    }

    const body = (request.body as {
      status?: string;
      output?: { artifacts?: Record<string, unknown>; metrics?: Record<string, unknown> };
      error?: string;
    }) ?? {};

    const terminal = ['COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT'].includes(
      body.status ?? '',
    );
    if (!terminal) {
      // Ignore intermediate webhook pings — reconciler handles truth.
      return { ok: true, ignored: 'non-terminal' };
    }

    const cap = getCapability(row.capability);
    const isSuccess = body.status === 'COMPLETED';
    const outputKeys = cap.outputKeys(jobId, row.input);
    const output = isSuccess
      ? Object.fromEntries(
          Object.entries(outputKeys).map(([name, { key }]) => [
            `${name}Key`,
            `outputs/${key}`,
          ]),
        )
      : null;

    const nextStatus: 'completed' | 'failed' | 'timed_out' = isSuccess
      ? 'completed'
      : body.status === 'TIMED_OUT'
        ? 'timed_out'
        : 'failed';

    await db
      .update(inferenceJobs)
      .set({
        status: nextStatus,
        output,
        error: isSuccess ? null : { message: body.error ?? 'runpod failure', raw: body },
        metrics: body.output?.metrics ?? null,
        completedAt: new Date(),
      })
      .where(eq(inferenceJobs.id, jobId));

    const channel = `job:${jobId}:${isSuccess ? 'complete' : 'error'}`;
    const payload = JSON.stringify({
      jobId,
      status: nextStatus,
      output,
      error: body.error,
    });
    await getRedis().publish(channel, payload);

    return { ok: true };
  });

  // ---- GET /internal/sandbox/:id/inference/:jobId/stream ----
  fastify.get('/internal/sandbox/:id/inference/:jobId/stream', async (request, reply) => {
    const ctx = await validateSandboxBearer(request, reply);
    if (!ctx) return;

    const { jobId } = request.params as { id: string; jobId: string };
    const [row] = await db
      .select()
      .from(inferenceJobs)
      .where(eq(inferenceJobs.id, jobId))
      .limit(1);
    if (!row) return reply.status(404).send({ error: 'unknown job' });
    if (row.sandboxSessionId !== ctx.sandboxSessionId) {
      return reply.status(403).send({ error: 'job not owned by this sandbox' });
    }

    // Write SSE headers directly via reply.raw (do NOT use reply.hijack —
    // that bypasses @fastify/cors per the project's SSE convention).
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const write = (event: string, data: unknown) => {
      try {
        reply.raw.write(`event: ${event}\n`);
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch {
        // Client disconnected mid-write — cleanup will run via 'close' handler.
      }
    };

    // If already terminal, emit immediately and close. No subscriber needed.
    if (
      row.status === 'completed' ||
      row.status === 'failed' ||
      row.status === 'timed_out'
    ) {
      write(row.status === 'completed' ? 'complete' : 'error', {
        jobId,
        status: row.status,
        output: row.output,
        error: row.error,
      });
      try {
        reply.raw.end();
      } catch {
        /* ignore */
      }
      return;
    }

    // Otherwise subscribe to Redis and relay. Each stream gets its own
    // dedicated subscriber so listener cleanup / unsubscribe can't race with
    // other concurrent SSE streams.
    const sub = getRedisSubscriber();
    const channels = [
      `job:${jobId}:progress`,
      `job:${jobId}:complete`,
      `job:${jobId}:error`,
    ];

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      clearInterval(heartbeat);
      sub.off('message', onMessage);
      sub.unsubscribe(...channels).catch(() => {});
      sub.quit().catch(() => {
        try {
          sub.disconnect();
        } catch {
          /* ignore */
        }
      });
      try {
        reply.raw.end();
      } catch {
        /* ignore */
      }
    };

    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(': heartbeat\n\n');
      } catch {
        cleanup();
      }
    }, 15_000);

    const onMessage = (channel: string, message: string) => {
      const kind = channel.endsWith(':complete')
        ? 'complete'
        : channel.endsWith(':error')
          ? 'error'
          : 'progress';
      let parsed: unknown;
      try {
        parsed = JSON.parse(message);
      } catch {
        parsed = { raw: message };
      }
      write(kind, parsed);
      if (kind !== 'progress') cleanup();
    };

    sub.on('error', (err: Error) => {
      logger.warn({ jobId, err: err.message }, 'inference SSE subscriber error');
      cleanup();
    });
    sub.on('message', onMessage);

    try {
      await sub.subscribe(...channels);
    } catch (err) {
      logger.error(
        { jobId, err: (err as Error).message },
        'inference SSE subscribe failed',
      );
      write('error', { jobId, error: 'subscribe failed' });
      cleanup();
      return;
    }

    request.raw.on('close', cleanup);
    request.raw.on('error', cleanup);

    // Subscribe-then-ready ordering: sandbox tool uses 'ready' as a signal to
    // stop polling. Must fire AFTER subscribe returns so no messages can be
    // missed in between.
    write('ready', { jobId });
  });
}
