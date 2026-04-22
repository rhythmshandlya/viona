import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { mkdtemp, rm } from 'node:fs/promises';
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

// The `assets.storage_key` column stores the bare key (e.g. `users/:uid/assets/pending/:nanoid/file.mp4`).
// MinIO objects live under the `uploads/` prefix — the API's `getPresignedMultipartUploadUrls` /
// `getPresignedDownloadUrl` helpers prepend it automatically. These worker helpers are called with
// the same bare key, so we re-apply the prefix here to hit the actual object.
const UPLOADS_PREFIX = config.minio.prefixes?.uploads ?? 'uploads/';
function fullKey(storageKey: string): string {
  return storageKey.startsWith(UPLOADS_PREFIX) ? storageKey : `${UPLOADS_PREFIX}${storageKey}`;
}

export interface DownloadedAsset {
  /** Absolute path to the downloaded file on local disk. */
  path: string;
  /** Removes the temp directory containing the file. Safe to call multiple times. */
  cleanup: () => Promise<void>;
}

/**
 * Downloads an object by full storage key into a freshly-created temp directory.
 * Returns `{ path, cleanup }` — the caller MUST `await cleanup()` in a `finally`
 * block to avoid leaking tmp directories on long-running workers.
 */
export async function downloadToTmp(storageKey: string): Promise<DownloadedAsset> {
  const dir = await mkdtemp(join(tmpdir(), 'asset-meta-'));
  const destPath = join(dir, basename(storageKey) || 'asset.bin');
  const stream = await minioClient.getObject(BUCKET, fullKey(storageKey));
  const writeStream = createWriteStream(destPath);
  await pipeline(stream, writeStream);
  return {
    path: destPath,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true }).catch(() => { /* swallow */ });
    },
  };
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
  await minioClient.putObject(BUCKET, fullKey(storageKey), body, body.length, {
    'Content-Type': contentType,
  });
  // Return the bare key (without the uploads/ prefix) so it matches the shape
  // stored on `assets.thumbnail_key` / `waveform_key` / `proxy_key`, and the
  // API's `getPresignedDownloadUrl('uploads', key)` resolution.
  return storageKey;
}
