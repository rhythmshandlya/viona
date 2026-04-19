import 'dotenv/config';
import { presignedClient, BUCKET_NAME, UPLOADS_PREFIX } from '../src/services/minio.js';

const stream = presignedClient.listObjects(BUCKET_NAME, UPLOADS_PREFIX, true);
const items: Array<{ name: string; size: number }> = [];
for await (const o of stream) {
  if (o.name) items.push({ name: o.name, size: o.size ?? 0 });
  if (items.length >= 50) break;
}
for (const i of items) console.log(i.size.toString().padStart(12), i.name);
console.log('\ntotal (capped at 50):', items.length);
