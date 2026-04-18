import { eq } from 'drizzle-orm';
import { Worker } from 'bullmq';
import { db, inferenceJobs } from '../db/index.js';
import { redis } from '../services/redis.js';
import { redisConnection } from '../utils/redis.js';
import { logger } from '../logger.js';
import { getCapability } from '../inference/registry.js';

interface InferenceJobData {
  jobId: string;
  capability: string;
  input: unknown;
}

interface RunnerResult {
  output: Record<string, unknown>;
  metrics?: Record<string, unknown> | null;
}

interface RunnerModule {
  run: (
    jobId: string,
    input: unknown,
    outputKeys: Record<string, { key: string; contentType: string }>,
    executionTimeoutSec: number,
  ) => Promise<RunnerResult>;
}

async function processInference(data: InferenceJobData): Promise<void> {
  const cap = getCapability(data.capability);
  const outputKeys = cap.outputKeys(data.jobId, data.input);

  // Mark running at the start — BullMQ retries land back here on attempt 2+,
  // and we want the DB row to reflect the in-flight attempt instead of the
  // terminal 'failed' set by the prior attempt's catch block.
  await db
    .update(inferenceJobs)
    .set({ status: 'running' })
    .where(eq(inferenceJobs.id, data.jobId));

  // Dynamic import of the per-capability runner module. The `.js` extension is
  // required for ESM resolution in both dev (tsx) and prod (tsup dist).
  const mod = (await import(`../inference/${cap.workerModule}.js`)) as Partial<RunnerModule>;
  if (typeof mod.run !== 'function') {
    throw new Error(`worker module '${cap.workerModule}' does not export run()`);
  }

  try {
    const { output, metrics } = await mod.run(
      data.jobId,
      data.input,
      outputKeys,
      cap.executionTimeoutSec,
    );

    await db
      .update(inferenceJobs)
      .set({
        status: 'completed',
        output,
        metrics: metrics ?? null,
        completedAt: new Date(),
      })
      .where(eq(inferenceJobs.id, data.jobId));

    // Match the shape produced by the API webhook + reconciler so sandbox SSE
    // consumers don't need to branch on which backend resolved the job.
    await redis.publish(
      `job:${data.jobId}:complete`,
      JSON.stringify({ jobId: data.jobId, status: 'completed', output }),
    );

    logger.info(
      { jobId: data.jobId, capability: data.capability },
      'Inference completed',
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await db
      .update(inferenceJobs)
      .set({
        status: 'failed',
        error: { message },
        completedAt: new Date(),
      })
      .where(eq(inferenceJobs.id, data.jobId));

    await redis.publish(
      `job:${data.jobId}:error`,
      JSON.stringify({ jobId: data.jobId, status: 'failed', error: { message } }),
    );

    logger.error(
      { jobId: data.jobId, capability: data.capability, err: message },
      'Inference failed',
    );

    throw err; // Let BullMQ handle retry/backoff (per queue config)
  }
}

export function startInferenceWorker(): Worker<InferenceJobData> {
  const worker = new Worker<InferenceJobData>(
    'inference',
    async (job) => processInference(job.data),
    {
      connection: redisConnection,
      concurrency: 1, // RVM holds a GPU (when present); serialize.
      lockDuration: 60 * 60 * 1000, // 60min — long enough for slowest CPU-only jobs.
    },
  );

  worker.on('failed', (job, err) =>
    logger.error(
      { jobId: job?.data?.jobId, err: err.message },
      'inference job failed',
    ),
  );
  worker.on('error', (err) =>
    logger.error({ err: err.message }, 'inference worker error'),
  );

  logger.info('Inference worker started');
  return worker;
}
