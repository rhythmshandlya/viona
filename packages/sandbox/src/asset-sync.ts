import { readdir, readFile, writeFile } from 'fs/promises';
import { join, relative } from 'path';
import { Client as MinioClient } from 'minio';
import pino from 'pino';
import { withManifestLock } from './tools/manifest-ops.js';

const logger = pino({ name: 'asset-sync' });

const WORKSPACE = '/workspace';
const PUBLIC_DIR = join(WORKSPACE, 'public');
const MANIFEST_PATH = join(WORKSPACE, 'manifest.json');
const PRESIGNED_TTL = 24 * 60 * 60; // 24 hours in seconds

const uploadedFiles = new Set<string>();

async function walkDir(dir: string, baseDir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkDir(fullPath, baseDir));
    } else if (entry.isFile()) {
      // Relative path with forward slashes for manifest keys (e.g., "matte/scene-1.mp4")
      files.push(relative(baseDir, fullPath).replace(/\\/g, '/'));
    }
  }
  return files;
}

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
/** Build the public base URL for presigned URLs (what the browser sees).
 *  Falls back to the internal endpoint if no public endpoint is configured. */
function getPublicBaseUrl(): string | null {
  const pub = process.env.MINIO_PUBLIC_ENDPOINT;
  if (!pub) return null;
  const ssl = process.env.MINIO_PUBLIC_USE_SSL === 'true';
  const port = parseInt(process.env.MINIO_PUBLIC_PORT || process.env.MINIO_PORT || '9000', 10);
  const scheme = ssl ? 'https' : 'http';
  const defaultPort = ssl ? 443 : 80;
  const portSuffix = port === defaultPort ? '' : `:${port}`;
  return `${scheme}://${pub}${portSuffix}`;
}

export async function syncAssets(): Promise<void> {
  const bucket = process.env.MINIO_BUCKET || 'viona';
  const projectPrefix = process.env.SANDBOX_ID || 'unknown';

  let files: string[] = [];
  try {
    files = await walkDir(PUBLIC_DIR, PUBLIC_DIR);
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
    // Skip build artifacts and manifest symlinks
    if (file.startsWith('.build/') || file === 'manifest.json') continue;

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

    // Full-res matte files are large — skip from assets map (only needed for server-side render).
    // Proxy matte files ARE included — served from MinIO with CORS headers.
    // MatteItem sets crossOrigin="anonymous" so canvas pixel access works cross-origin.
    if (file.startsWith('matte/') && !file.includes('-proxy.')) continue;

    try {
      const publicBase = getPublicBaseUrl();
      const pubEndpoint = process.env.MINIO_PUBLIC_ENDPOINT;
      if (publicBase && pubEndpoint !== 'localhost') {
        // Production/staging: presigned URL with host rewrite
        let url = await minio.presignedGetObject(bucket, objectKey, PRESIGNED_TTL);
        const parsed = new URL(url);
        url = url.replace(parsed.origin, publicBase);
        assets[file] = url;
      } else if (publicBase) {
        // Local dev: direct URL (bucket has anonymous download policy)
        assets[file] = `${publicBase}/${bucket}/${objectKey}`;
      }
    } catch (err) {
      logger.warn({ err, file }, 'Failed to generate asset URL');
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
