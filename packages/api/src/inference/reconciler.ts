import { and, eq, inArray, lt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { inferenceJobs } from '../db/schema.js';
import { getRedis } from '../services/redis.js';
import { logger } from '../logger.js';
import { getCapability } from './registry.js';
import { runpodStatus, isTerminal } from './runpod-client.js';

const INTERVAL_MS = 30_000;
// 20min absolute ceiling — matches worst-case execution window.
const MAX_AGE_MS = 1000 * 60 * 20;

let timer: NodeJS.Timeout | null = null;

async function reconcileOnce(): Promise<void> {
  // Only look at jobs older than 30s so we don't race freshly-dispatched rows
  // whose webhook may still be in-flight. Row updates below are idempotent
  // (last writer wins) so webhook + reconciler racing is safe — whichever
  // commits first marks the row terminal, the other becomes a no-op.
  const cutoff = new Date(Date.now() - 30_000);
  const rows = await db
    .select()
    .from(inferenceJobs)
    .where(
      and(
        eq(inferenceJobs.provider, 'runpod'),
        inArray(inferenceJobs.status, ['pending', 'running']),
        lt(inferenceJobs.submittedAt, cutoff),
      ),
    )
    .limit(50);

  for (const row of rows) {
    // Defensive: runpodJobId is set synchronously after dispatch, so this
    // should never fire post-dispatch. Skip silently if it does.
    if (!row.runpodJobId) continue;
    const cap = getCapability(row.capability);

    try {
      const status = await runpodStatus(cap.getEndpointId(), row.runpodJobId);

      if (!isTerminal(status.status)) {
        // Stale beyond absolute ceiling → mark timed out. Sandbox tools
        // consume the `:error` channel with { reconciled: true } as the
        // signal that the reconciler (not webhook) resolved this job.
        if (Date.now() - row.submittedAt.getTime() > MAX_AGE_MS) {
          await db
            .update(inferenceJobs)
            .set({
              status: 'timed_out',
              error: { message: 'Exceeded reconciler ceiling', reconciled: true },
              completedAt: new Date(),
            })
            .where(eq(inferenceJobs.id, row.id));
          await getRedis().publish(
            `job:${row.id}:error`,
            JSON.stringify({ jobId: row.id, status: 'timed_out', reconciled: true }),
          );
          logger.warn(
            { jobId: row.id, runpodJobId: row.runpodJobId },
            'Reconciler timed out stale job',
          );
        }
        continue;
      }

      // Terminal: mirror the webhook handler's DB-update + Redis-publish
      // shape exactly so sandbox consumers don't care which path resolved.
      const isSuccess = status.status === 'COMPLETED';
      const outputKeys = cap.outputKeys(row.id, row.input);
      const output = isSuccess
        ? Object.fromEntries(
            Object.entries(outputKeys).map(([name, { key }]) => [
              `${name}Key`,
              `outputs/${key}`,
            ]),
          )
        : null;

      // CANCELLED is treated as 'failed' (explicit cancel, not a timeout).
      const nextStatus: 'completed' | 'failed' | 'timed_out' = isSuccess
        ? 'completed'
        : status.status === 'TIMED_OUT'
          ? 'timed_out'
          : 'failed';

      const metrics =
        (status.output as { metrics?: Record<string, unknown> } | undefined)?.metrics ??
        null;

      await db
        .update(inferenceJobs)
        .set({
          status: nextStatus,
          output,
          error: isSuccess
            ? null
            : { message: status.error ?? 'runpod failure', reconciled: true },
          metrics,
          completedAt: new Date(),
        })
        .where(eq(inferenceJobs.id, row.id));

      const channel = `job:${row.id}:${isSuccess ? 'complete' : 'error'}`;
      await getRedis().publish(
        channel,
        JSON.stringify({
          jobId: row.id,
          status: nextStatus,
          output,
          error: status.error,
          reconciled: true,
        }),
      );

      logger.info(
        { jobId: row.id, status: status.status, nextStatus },
        'Reconciler resolved job',
      );
    } catch (err) {
      // Transient poll failure — leave row as-is and let the next cycle retry.
      logger.warn(
        { jobId: row.id, err: (err as Error).message },
        'Reconciler poll failed; will retry',
      );
    }
  }
}

export function startReconciler(): void {
  if (timer) return;
  timer = setInterval(() => {
    reconcileOnce().catch((err) =>
      logger.error({ err: (err as Error).message }, 'reconcileOnce threw'),
    );
  }, INTERVAL_MS);
  logger.info({ intervalMs: INTERVAL_MS }, 'Inference reconciler started');
}

export function stopReconciler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
