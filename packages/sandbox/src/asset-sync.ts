import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { Client as MinioClient } from 'minio';
import pino from 'pino';
import { withManifestLock } from './tools/manifest-ops.js';

const logger = pino({ name: 'asset-sync' });

const WORKSPACE = '/workspace';
const PUBLIC_DIR = join(WORKSPACE, 'public');
const MANIFEST_PATH = join(WORKSPACE, 'manifest.json');
const PRESIGNED_TTL = 8 * 60 * 60; // 8 hours in seconds

const uploadedFiles = new Set<string>();

let _minioClient: MinioClient | null = null;
let _presignedClient: MinioClient | null = null;

function getMinioClient(): MinioClient {
  if (!_minioClient) {
    _minioClient = new MinioClient({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || '',
      secretKey: process.env.MINIO_SECRET_KEY || '',
    });
  }
  return _minioClient;
}

/** Get a MinIO client configured with the public endpoint for generating
 *  browser-accessible presigned URLs. Falls back to the internal client. */
function getPresignedClient(): MinioClient {
  if (!_presignedClient) {
    const publicEndpoint = process.env.MINIO_PUBLIC_ENDPOINT;
    if (publicEndpoint) {
      _presignedClient = new MinioClient({
        endPoint: publicEndpoint,
        useSSL: true,
        accessKey: process.env.MINIO_ACCESS_KEY || '',
        secretKey: process.env.MINIO_SECRET_KEY || '',
      });
    } else {
      _presignedClient = getMinioClient();
    }
  }
  return _presignedClient;
}

export async function syncAssets(): Promise<void> {
  const bucket = process.env.MINIO_BUCKET || 'viona';
  const projectPrefix = process.env.SANDBOX_ID || 'unknown';

  let files: string[] = [];
  try {
    // Use withFileTypes to distinguish files from directories (fixes EISDIR error)
    const entries = await readdir(PUBLIC_DIR, { withFileTypes: true });
    files = entries.filter(e => e.isFile()).map(e => e.name);
  } catch {
    logger.debug('No public directory yet');
    return;
  }

  if (files.length === 0) return;

  let minio: MinioClient;
  try {
    minio = getMinioClient();
  } catch (err) {
    logger.error({ err }, 'Failed to create MinIO client');
    return;
  }

  const assets: Record<string, string> = {};

  for (const file of files) {
    const objectKey = `${projectPrefix}/${file}`;
    const filePath = join(PUBLIC_DIR, file);

    if (!uploadedFiles.has(file)) {
      try {
        await minio.fPutObject(bucket, objectKey, filePath);
        uploadedFiles.add(file);
        logger.info({ file }, 'Uploaded to MinIO');
      } catch (err) {
        logger.warn({ err, file }, 'Failed to upload file, skipping');
        continue;
      }
    }

    try {
      const presignedMinio = getPresignedClient();
      const url = await presignedMinio.presignedGetObject(bucket, objectKey, PRESIGNED_TTL);
      assets[file] = url;
    } catch (err) {
      logger.warn({ err, file }, 'Failed to generate presigned URL');
    }
  }

  // Use manifest lock to prevent race with agent manifest writes (Issue #10)
  try {
    await withManifestLock(async () => {
      const manifestRaw = await readFile(MANIFEST_PATH, 'utf-8');
      const manifest = JSON.parse(manifestRaw);
      manifest.assets = assets;
      await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
      logger.info({ assetCount: Object.keys(assets).length }, 'Assets map updated in manifest');
    });
  } catch (err) {
    logger.error({ err }, 'Failed to update manifest assets map');
  }
}
