import 'dotenv/config';
import { presignedClient, BUCKET_NAME } from '../src/services/minio.js';

const jobId = process.argv[2];
if (!jobId) throw new Error('usage: tsx verify-inference-outputs.ts <jobId>');

const expected = [
  `outputs/mattes/${jobId}/matte.mp4`,
  `outputs/mattes/${jobId}/fgr.mp4`,
  `outputs/mattes/${jobId}/bbox.json`,
  `outputs/mattes/${jobId}/matte-proxy.mp4`,
  `outputs/mattes/${jobId}/fgr-proxy.mp4`,
];

for (const key of expected) {
  try {
    const stat = await presignedClient.statObject(BUCKET_NAME, key);
    console.log(`  ✓ ${key}  ${stat.size} bytes`);
  } catch (e: any) {
    console.log(`  ✗ ${key}  MISSING (${e.message})`);
  }
}
