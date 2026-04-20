/**
 * Submit the SAME test video to the current endpoint (:onnx), download the
 * outputs, run ffprobe + parse bbox.json. Flags whether outputs look correct.
 */
import 'dotenv/config';
import { statSync, createReadStream, createWriteStream } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { pipeline } from 'node:stream/promises';
import { Client } from 'minio';
import { runpodSubmit, runpodStatus, isTerminal, type RunPodStatusResponse } from '../../../packages/api/src/inference/runpod-client.js';

const run = promisify(exec);

const RAILWAY_ENDPOINT = process.env.RAILWAY_MINIO_ENDPOINT!;
const RAILWAY_USER = process.env.RAILWAY_MINIO_USER!;
const RAILWAY_PASSWORD = process.env.RAILWAY_MINIO_PASSWORD!;
const BUCKET = process.env.RAILWAY_MINIO_BUCKET || 'viona';
const ENDPOINT = process.env.RUNPOD_RVM_ENDPOINT_ID!;

if (!ENDPOINT) throw new Error('RUNPOD_RVM_ENDPOINT_ID required');

const LOCAL_VIDEO = process.argv[2] ?? './viona-test.mp4';
const TAG = process.argv[3] ?? 'onnx';
const JOB_PREFIX = `verify-${TAG}-${Date.now()}`;
const INPUT_KEY = `uploads/test/${JOB_PREFIX}.mp4`;

const minio = new Client({
  endPoint: RAILWAY_ENDPOINT,
  port: 443,
  useSSL: true,
  accessKey: RAILWAY_USER,
  secretKey: RAILWAY_PASSWORD,
});

async function main() {
  console.log(`=== parity verify: image=${TAG} input=${LOCAL_VIDEO} ===`);

  // Upload + verify
  console.log('\n[1] probing input video…');
  const { stdout: inputProbe } = await run(
    `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate,nb_read_packets -of default=nw=1 -read_intervals %+#1000 "${LOCAL_VIDEO}"`,
  );
  console.log(inputProbe);

  console.log('[2] upload to Railway bucket…');
  const size = statSync(LOCAL_VIDEO).size;
  await minio.putObject(BUCKET, INPUT_KEY, createReadStream(LOCAL_VIDEO), size, {
    'Content-Type': 'video/mp4',
  });

  // Presign
  const inputUrl = await minio.presignedGetObject(BUCKET, INPUT_KEY, 3600);
  const outputs: Record<string, string> = {};
  const outputKeys: Record<string, string> = {};
  for (const name of ['matte', 'fgr', 'bbox']) {
    const ext = name === 'bbox' ? 'json' : 'mp4';
    const key = `outputs/mattes/${JOB_PREFIX}/${name}.${ext}`;
    outputKeys[name] = key;
    outputs[name] = await minio.presignedPutObject(BUCKET, key, 15 * 60);
  }

  // Submit
  console.log('\n[3] submit job…');
  const submitted = await runpodSubmit(ENDPOINT, {
    input: {
      inputs: { video: inputUrl },
      outputs,
      params: { backbone: 'resnet50', scale: 0.5, downsampleRatio: 0.25 },
    },
  });
  console.log('jobId:', submitted.id);

  let status: RunPodStatusResponse = submitted as any;
  const t0 = Date.now();
  while (!isTerminal(status.status as any)) {
    await new Promise((r) => setTimeout(r, 5000));
    status = (await runpodStatus(ENDPOINT, submitted.id)) as any;
    process.stdout.write(`  [${Math.round((Date.now() - t0) / 1000)}s] ${status.status}\r`);
  }
  console.log(`\n[4] terminal: ${status.status}  execution=${(status as any).executionTime}ms  delay=${(status as any).delayTime}ms`);
  if (status.status !== 'COMPLETED') {
    console.error('FAILED:', (status as any).error ?? status);
    process.exit(1);
  }

  // Download + verify each artifact
  console.log('\n[5] download + probe artifacts…');
  for (const [name, key] of Object.entries(outputKeys)) {
    const local = `/tmp/${JOB_PREFIX}-${name}.${name === 'bbox' ? 'json' : 'mp4'}`;
    const stream = await minio.getObject(BUCKET, key);
    await pipeline(stream, createWriteStream(local));
    const stat = statSync(local);
    console.log(`\n  ${name}: ${stat.size} bytes → ${local}`);

    if (name === 'bbox') {
      const { readFileSync } = await import('node:fs');
      const json = JSON.parse(readFileSync(local, 'utf-8'));
      const keys = Object.keys(json);
      const frameCount = json.frames?.length ?? 0;
      const agg = json.aggregate ?? {};
      console.log(`    keys: [${keys.join(', ')}]  frames: ${frameCount}  fps: ${json.fps}`);
      console.log(`    aggregate: avgBbox=${JSON.stringify(agg.avgBbox)} bodyCenter=${JSON.stringify(agg.bodyCenter)}`);
      if (frameCount === 0) console.log('    ⚠️  ZERO FRAMES in bbox.json');
      if (!agg.avgBbox) console.log('    ⚠️  MISSING aggregate.avgBbox');
    } else {
      const { stdout } = await run(
        `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate,duration,nb_read_packets -of default=nw=1 -read_intervals %+#1000 "${local}"`,
      );
      console.log(stdout.trim().split('\n').map((l) => '    ' + l).join('\n'));
    }
  }
  console.log('\nDONE');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
