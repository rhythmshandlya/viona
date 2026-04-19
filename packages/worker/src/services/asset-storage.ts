import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { minioClient } from './minio.js';
import { config } from '../config.js';

// Raw-key storage helpers for the asset pipeline (Task 7+).
//
// The legacy `minio.ts` helpers (`downloadFile` / `uploadFile`) take a
// `prefix` + relative `key`. The asset pipeline instead stores the full key
// (e.g. `users/{userId}/assets/{assetId}/file.mp4`) on the `assets.storage_key`
// column. These helpers accept that raw full key directly.

const BUCKET = config.minio.bucket;

/**
 * Downloads an object by full storage key into a freshly-created temp directory.
 * Returns the local filepath. Caller is responsible for cleaning up the parent dir.
 */
export async function downloadToTmp(storageKey: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'asset-meta-'));
  const destPath = join(dir, basename(storageKey) || 'asset.bin');
  const stream = await minioClient.getObject(BUCKET, storageKey);
  const writeStream = createWriteStream(destPath);
  await pipeline(stream, writeStream);
  return destPath;
}

/**
 * Uploads an in-memory buffer to the given full storage key with a content-type header.
 * Returns the storage key that was uploaded.
 */
export async function uploadFile(
  storageKey: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  await minioClient.putObject(BUCKET, storageKey, body, body.length, {
    'Content-Type': contentType,
  });
  return storageKey;
}
