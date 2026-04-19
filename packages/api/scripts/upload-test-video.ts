import 'dotenv/config';
import { statSync, createReadStream } from 'node:fs';
import { presignedClient, BUCKET_NAME, UPLOADS_PREFIX } from '../src/services/minio.js';

const LOCAL = process.argv[2] ?? '/tmp/viona-test.mp4';
const KEY = process.argv[3] ?? 'test/short-clip.mp4';

const full = `${UPLOADS_PREFIX}${KEY}`;
const size = statSync(LOCAL).size;
console.log(`uploading ${LOCAL} (${size} bytes) → ${BUCKET_NAME}/${full}`);

await presignedClient.putObject(BUCKET_NAME, full, createReadStream(LOCAL), size, {
  'Content-Type': 'video/mp4',
});

const stat = await presignedClient.statObject(BUCKET_NAME, full);
console.log('uploaded:', { key: full, size: stat.size, etag: stat.etag });
