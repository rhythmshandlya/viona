import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { inferenceJobs } from '../db/schema.js';
import { presignedClient, BUCKET_NAME, OUTPUTS_PREFIX, UPLOADS_PREFIX } from '../services/minio.js';
import { queueInferenceJob } from '../services/queue.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { getCapability } from './registry.js';
import { runpodSubmit } from './runpod-client.js';
import { issueWebhookToken } from './webhook-auth.js';

interface DispatchParams {
  capability: string;
  input: unknown;
  projectId: string;
  sandboxSessionId: string;
}

interface DispatchResult {
  jobId: string;
  provider: 'runpod' | 'worker';
}

export async function dispatchInference(params: DispatchParams): Promise<DispatchResult> {
  const cap = getCapability(params.capability);
  const validated = cap.inputSchema.parse(params.input);
  const provider = config.inference.provider;

  const [row] = await db
    .insert(inferenceJobs)
    .values({
      sandboxSessionId: params.sandboxSessionId,
      projectId: params.projectId,
      capability: cap.name,
      provider,
      status: 'pending',
      input: validated,
    })
    .returning();

  const jobId = row.id;

  try {
    if (provider === 'runpod') {
      await dispatchRunpod(jobId, cap, validated);
    } else {
      await dispatchWorker(jobId, cap.name, validated);
    }
    await db.update(inferenceJobs).set({ status: 'running' }).where(eq(inferenceJobs.id, jobId));
    return { jobId, provider };
  } catch (err) {
    logger.error({ jobId, provider, err: (err as Error).message }, 'Inference dispatch failed');
    await db
      .update(inferenceJobs)
      .set({
        status: 'failed',
        error: { message: (err as Error).message, stage: 'dispatch' },
        completedAt: new Date(),
      })
      .where(eq(inferenceJobs.id, jobId));
    throw err;
  }
}

async function dispatchRunpod(
  jobId: string,
  cap: ReturnType<typeof getCapability>,
  validated: any,
) {
  const videoKey = validated.videoKey as string;
  const inputGetUrl = await presignedClient.presignedGetObject(
    BUCKET_NAME,
    `${UPLOADS_PREFIX}${videoKey}`.replace(/\/+/g, '/').replace(/^\//, ''),
    60 * 60,
  );

  const outputKeys = cap.outputKeys(jobId, validated);
  const outputs: Record<string, string> = {};
  for (const [name, { key }] of Object.entries(outputKeys)) {
    outputs[name] = await presignedClient.presignedPutObject(
      BUCKET_NAME,
      `${OUTPUTS_PREFIX}${key}`,
      cap.executionTimeoutSec + 120,
    );
  }

  const token = await issueWebhookToken(jobId, cap.name, cap.executionTimeoutSec);
  const webhookUrl = `${config.runpod.webhookBaseUrl}/internal/runpod/callback/${jobId}?token=${encodeURIComponent(token)}`;

  const runpodParams = {
    ...(validated.params ?? {}),
    ...(validated.ranges ? { ranges: validated.ranges } : {}),
  };
  const submitted = await runpodSubmit(cap.getEndpointId(), {
    input: {
      inputs: { video: inputGetUrl },
      outputs,
      params: runpodParams,
    },
    webhook: webhookUrl,
    policy: { executionTimeout: cap.executionTimeoutSec * 1000 },
  });

  await db
    .update(inferenceJobs)
    .set({ runpodJobId: submitted.id })
    .where(eq(inferenceJobs.id, jobId));
}

async function dispatchWorker(jobId: string, capability: string, validated: any) {
  await queueInferenceJob({ jobId, capability, input: validated });
}

/**
 * Fire a no-op RunPod job to warm a worker. Does NOT create an inferenceJobs
 * row — the job intentionally fails fast with KeyError on a warm worker.
 * Its only purpose: kick RunPod's allocator to pull the image + boot a pod
 * so subsequent real dispatches land on a warm worker (or at least a host
 * with the image layers cached).
 *
 * No-op when INFERENCE_PROVIDER=worker (nothing to prewarm locally).
 * Fire-and-forget — never throws; logs and swallows errors.
 */
export async function prewarmInference(capability: string): Promise<void> {
  if (config.inference.provider !== 'runpod') return;
  try {
    const cap = getCapability(capability);
    await runpodSubmit(cap.getEndpointId(), {
      input: { inputs: {}, outputs: {}, params: {} },
      policy: { executionTimeout: 30_000 },
    });
    logger.info({ capability }, 'Inference prewarm fired');
  } catch (err) {
    logger.warn({ capability, err: (err as Error).message }, 'Inference prewarm failed (non-fatal)');
  }
}
