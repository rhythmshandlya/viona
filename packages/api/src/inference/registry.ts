import { z } from 'zod';
import { config } from '../config.js';

export interface CapabilityDefinition {
  /** Name used in API routes and DB (`segment-speaker`). */
  name: string;
  /**
   * Module name the worker uses to dynamic-import the local runner when
   * INFERENCE_PROVIDER=worker. Resolves to `packages/worker/src/inference/{workerModule}.ts`.
   */
  workerModule: string;
  /** RunPod endpoint ID resolved from the config (only used when INFERENCE_PROVIDER=runpod). */
  getEndpointId: () => string;
  /** Shared execution timeout in seconds. Passed to RunPod and used as worker subprocess timeout. */
  executionTimeoutSec: number;
  /** Zod schema for the `input` field of POST /inference. */
  inputSchema: z.ZodTypeAny;
  /** Zod schema for the `output` field set by the webhook/worker. */
  outputSchema: z.ZodTypeAny;
  /**
   * Given a validated input, produce the MinIO output keys. Keys are relative
   * to the `outputs/` prefix. Used by both the API (to presign for RunPod) and
   * the worker (to choose upload keys).
   */
  outputKeys: (jobId: string, input: any) => Record<string, { key: string; contentType: string }>;
}

// ---- segment-speaker (RVM) ----

const segmentSpeakerInput = z.object({
  videoKey: z.string().min(1),
  ranges: z
    .array(z.object({ startMs: z.number().int().min(0), endMs: z.number().int().positive() }))
    .optional(),
  params: z
    .object({
      backbone: z.enum(['resnet50', 'mobilenetv3']).default('resnet50'),
      scale: z.number().positive().max(1).default(0.5),
      fps: z.number().int().min(0).default(0),
      downsampleRatio: z.number().positive().max(1).default(0.8),
    })
    .default({}),
});

const segmentSpeakerOutput = z.object({
  matteKey: z.string(),
  fgrKey: z.string(),
  bboxKey: z.string(),
  proxyMatteKey: z.string(),
  proxyFgrKey: z.string(),
});

const segmentSpeaker: CapabilityDefinition = {
  name: 'segment-speaker',
  workerModule: 'segment-speaker',
  getEndpointId: () => {
    const id = config.runpod.rvmEndpointId;
    if (!id) throw new Error('RUNPOD_RVM_ENDPOINT_ID is not set');
    return id;
  },
  executionTimeoutSec: 900,
  inputSchema: segmentSpeakerInput,
  outputSchema: segmentSpeakerOutput,
  outputKeys: (jobId) => ({
    matte: { key: `mattes/${jobId}/matte.mp4`, contentType: 'video/mp4' },
    fgr: { key: `mattes/${jobId}/fgr.mp4`, contentType: 'video/mp4' },
    bbox: { key: `mattes/${jobId}/bbox.json`, contentType: 'application/json' },
    proxyMatte: { key: `mattes/${jobId}/matte-proxy.mp4`, contentType: 'video/mp4' },
    proxyFgr: { key: `mattes/${jobId}/fgr-proxy.mp4`, contentType: 'video/mp4' },
  }),
};

export const inferenceRegistry = {
  'segment-speaker': segmentSpeaker,
} as const satisfies Record<string, CapabilityDefinition>;

export type CapabilityName = keyof typeof inferenceRegistry;

export function getCapability(name: string): CapabilityDefinition {
  const cap = (inferenceRegistry as Record<string, CapabilityDefinition>)[name];
  if (!cap) throw new Error(`Unknown capability: ${name}`);
  return cap;
}
