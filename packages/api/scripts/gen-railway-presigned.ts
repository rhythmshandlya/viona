/** Generate a RunPod handler input.json with Railway MinIO presigned URLs. */
import 'dotenv/config';
import { statSync, createReadStream, writeFileSync } from 'node:fs';
import { Client } from 'minio';

const E = process.env.RAILWAY_MINIO_ENDPOINT!;
const U = process.env.RAILWAY_MINIO_USER!;
const P = process.env.RAILWAY_MINIO_PASSWORD!;
const B = process.env.RAILWAY_MINIO_BUCKET || 'viona';

if (!E || !U || !P) throw new Error('RAILWAY_MINIO_* envs required');

const LOCAL = process.argv[2] ?? './viona-test.mp4';
const PREFIX = `local-${Date.now()}`;
const INPUT_KEY = `uploads/test/${PREFIX}.mp4`;

const minio = new Client({ endPoint: E, port: 443, useSSL: true, accessKey: U, secretKey: P });

async function main() {
  const exists = await minio.bucketExists(B).catch(() => false);
  if (!exists) await minio.makeBucket(B, 'us-east-1');

  const size = statSync(LOCAL).size;
  console.log(`uploading ${LOCAL} (${size}) → ${B}/${INPUT_KEY}`);
  await minio.putObject(B, INPUT_KEY, createReadStream(LOCAL), size, { 'Content-Type': 'video/mp4' });

  const inputUrl = await minio.presignedGetObject(B, INPUT_KEY, 3600);
  const outputs: Record<string, string> = {};
  for (const [name, ext] of [['matte', 'mp4'], ['fgr', 'mp4'], ['bbox', 'json']] as const) {
    const key = `outputs/mattes/${PREFIX}/${name}.${ext}`;
    outputs[name] = await minio.presignedPutObject(B, key, 3600);
    console.log(`  output ${name} → ${B}/${key}`);
  }

  const payload = {
    inputs: { video: inputUrl },
    outputs,
    params: { backbone: 'resnet50', scale: 0.5, downsampleRatio: 0.25 },
  };

  writeFileSync('/tmp/rvm-input.json', JSON.stringify(payload, null, 2));
  console.log('\nwritten /tmp/rvm-input.json');
  console.log(`\nPrefix for output verification: ${PREFIX}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
