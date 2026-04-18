/**
 * E2E test: submits a real RunPod job, verifies artifacts land in MinIO.
 *
 * This script bypasses the Viona API dispatcher and talks directly to the
 * RunPod REST API. It presigns real MinIO URLs for inputs/outputs, submits
 * the job, polls until terminal, and prints the MinIO keys so you can verify
 * artifacts manually (e.g. via `mc stat local/viona/<key>` or the Console).
 *
 * --------------------------------------------------------------------------
 * Prerequisites:
 * --------------------------------------------------------------------------
 *  1. `.env` in `packages/api/` with:
 *       RUNPOD_API_KEY=<from runpod.io dashboard>
 *       RUNPOD_RVM_ENDPOINT_ID=<id of the deployed RVM serverless endpoint>
 *       BUCKET_ENDPOINT / BUCKET_ACCESS_KEY / BUCKET_SECRET_KEY / BUCKET_NAME
 *       (plus BUCKET_PUBLIC_ENDPOINT if MinIO is behind a public hostname)
 *
 *  2. The RunPod serverless endpoint from Task 17 must already be deployed
 *     and healthy (image pushed, workers active).
 *
 *  3. A short (~5-10s) test video must already be uploaded to MinIO at
 *     `uploads/test/short-clip.mp4`. Upload with:
 *
 *       mc alias set local http://localhost:9000 viona viona123
 *       mc cp ./my-clip.mp4 local/viona/uploads/test/short-clip.mp4
 *
 * --------------------------------------------------------------------------
 * Run:
 * --------------------------------------------------------------------------
 *     cd packages/api && pnpm tsx ../../scripts/temp/test-runpod-handler.ts
 *
 * (Running from `packages/api` is required so that cross-workspace TS imports
 * resolve through the API package's tsconfig and `.env` gets loaded from
 * the correct cwd.)
 *
 * --------------------------------------------------------------------------
 * Expected flow:
 * --------------------------------------------------------------------------
 *  - Submitted: <runpod-id>
 *  - Polling prints every 5s: IN_QUEUE -> IN_PROGRESS -> COMPLETED
 *  - Cold start on first run adds ~30-120s while the container pulls; warm
 *    subsequent runs start in seconds.
 *  - Exits 0 on COMPLETED, 1 on FAILED / TIMED_OUT / CANCELLED.
 *
 * --------------------------------------------------------------------------
 * Debugging a FAILED status:
 * --------------------------------------------------------------------------
 *  The RunPod handler in `infra/runpod/rvm/handler.py` expects
 *  `input.inputs.video` (GET URL) and `input.outputs.{matte,fgr,bbox}` (PUT
 *  URLs). This script sends all of those, so a real FAILED is a real failure
 *  (image issue, OOM, malformed video, expired presigned URL, etc.) — NOT
 *  the "empty args" bug that happens when the handler is invoked without
 *  the correct input shape. Check RunPod's worker logs in the dashboard.
 */

import 'dotenv/config';
import {
  runpodSubmit,
  runpodStatus,
  isTerminal,
  type RunPodStatusResponse,
} from '../../packages/api/src/inference/runpod-client.js';
import {
  presignedClient,
  BUCKET_NAME,
  OUTPUTS_PREFIX,
  UPLOADS_PREFIX,
} from '../../packages/api/src/services/minio.js';

const ENDPOINT = process.env.RUNPOD_RVM_ENDPOINT_ID ?? '';
if (!ENDPOINT) throw new Error('RUNPOD_RVM_ENDPOINT_ID required');
if (!process.env.RUNPOD_API_KEY) throw new Error('RUNPOD_API_KEY required');

const TEST_KEY = 'test/short-clip.mp4';
const JOB_PREFIX = `test-${Date.now()}`;
const OUTPUT_NAMES = ['matte', 'fgr', 'bbox'] as const;

function outputExt(name: (typeof OUTPUT_NAMES)[number]): string {
  return name === 'bbox' ? 'json' : 'mp4';
}

function outputKey(name: (typeof OUTPUT_NAMES)[number]): string {
  return `${OUTPUTS_PREFIX}mattes/${JOB_PREFIX}/${name}.${outputExt(name)}`;
}

async function main(): Promise<void> {
  const inputFullKey = `${UPLOADS_PREFIX}${TEST_KEY}`;
  console.log(`Presigning GET for input: ${inputFullKey}`);
  const inputUrl = await presignedClient.presignedGetObject(
    BUCKET_NAME,
    inputFullKey,
    60 * 60,
  );

  const outputs: Record<string, string> = {};
  for (const name of OUTPUT_NAMES) {
    const key = outputKey(name);
    console.log(`Presigning PUT for output: ${key}`);
    outputs[name] = await presignedClient.presignedPutObject(
      BUCKET_NAME,
      key,
      15 * 60,
    );
  }

  console.log('\nSubmitting RunPod job...');
  const submitted = await runpodSubmit(ENDPOINT, {
    input: {
      inputs: { video: inputUrl },
      outputs,
      params: { backbone: 'resnet50', scale: 0.5, downsampleRatio: 0.8 },
    },
  });
  console.log(`Submitted: ${submitted.id} (status=${submitted.status})\n`);

  let status: RunPodStatusResponse = {
    id: submitted.id,
    status: submitted.status,
  };
  const start = Date.now();
  while (!isTerminal(status.status)) {
    await new Promise((r) => setTimeout(r, 5_000));
    status = await runpodStatus(ENDPOINT, submitted.id);
    const elapsed = Math.round((Date.now() - start) / 1000);
    console.log(`  [${elapsed}s] status=${status.status}`);
  }

  console.log('\nTerminal status:', status.status);
  if (status.executionTime !== undefined) {
    console.log(`Execution time: ${status.executionTime}ms`);
  }
  if (status.delayTime !== undefined) {
    console.log(`Queue delay: ${status.delayTime}ms`);
  }
  console.log('Output:', JSON.stringify(status.output, null, 2));
  if (status.error) console.log('Error:', status.error);

  if (status.status !== 'COMPLETED') {
    console.error(`\nJob did not complete successfully: ${status.status}`);
    process.exit(1);
  }

  console.log('\nExpected outputs in MinIO (verify with `mc stat` or Console):');
  for (const name of OUTPUT_NAMES) {
    console.log(`  ${BUCKET_NAME}/${outputKey(name)}`);
  }
  console.log('\nExample:');
  console.log(`  mc stat local/${BUCKET_NAME}/${outputKey('matte')}`);
  console.log(`  mc cp local/${BUCKET_NAME}/${outputKey('matte')} /tmp/matte.mp4 && ffprobe /tmp/matte.mp4`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
