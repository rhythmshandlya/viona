import { Client } from 'minio';
import { createWriteStream, createReadStream, mkdirSync, existsSync } from 'fs';
import { pipeline } from 'stream/promises';
import { join, dirname } from 'path';
import { config } from '../config.js';

// Build client config - only add port for local MinIO
const clientConfig: {
  endPoint: string;
  port?: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  region?: string;
} = {
  endPoint: config.minio.endpoint,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
  region: config.minio.region,
};

// Only add port for local MinIO (Railway doesn't use port)
if (config.minio.port) {
  clientConfig.port = config.minio.port;
}

export const minioClient = new Client(clientConfig);

// Single bucket with prefixes
const BUCKET = config.minio.bucket;
const PREFIXES = config.minio.prefixes;

/**
 * Download file from storage.
 * @param prefix - The prefix type ('uploads', 'outputs', 'templates') - for backwards compatibility this param is named 'bucket'
 * @param key - The object key (without prefix)
 * @param destPath - Local destination path
 */
export async function downloadFile(prefix: string, key: string, destPath: string): Promise<void> {
  // Handle both old bucket names and new prefix approach
  const fullKey = PREFIXES[prefix as keyof typeof PREFIXES]
    ? `${PREFIXES[prefix as keyof typeof PREFIXES]}${key}`
    : `${prefix}/${key}`; // Fallback: treat prefix as a prefix path

  const stream = await minioClient.getObject(BUCKET, fullKey);
  const writeStream = createWriteStream(destPath);
  await pipeline(stream, writeStream);
}

/**
 * Upload file to storage.
 * @param prefix - The prefix type ('uploads', 'outputs', 'templates') - for backwards compatibility this param is named 'bucket'
 * @param key - The object key (without prefix)
 * @param srcPath - Local source path
 */
export async function uploadFile(prefix: string, key: string, srcPath: string): Promise<void> {
  const fullKey = PREFIXES[prefix as keyof typeof PREFIXES]
    ? `${PREFIXES[prefix as keyof typeof PREFIXES]}${key}`
    : `${prefix}/${key}`;

  await minioClient.fPutObject(BUCKET, fullKey, srcPath);
}

/**
 * Get object stream from storage.
 * @param prefix - The prefix type ('uploads', 'outputs', 'templates')
 * @param key - The object key (without prefix)
 */
export async function getObjectStream(prefix: string, key: string) {
  const fullKey = PREFIXES[prefix as keyof typeof PREFIXES]
    ? `${PREFIXES[prefix as keyof typeof PREFIXES]}${key}`
    : `${prefix}/${key}`;

  return minioClient.getObject(BUCKET, fullKey);
}

/**
 * List all objects with a given prefix.
 * @param prefix - The prefix type ('uploads', 'outputs', 'templates')
 * @param keyPrefix - Additional prefix within the bucket prefix
 */
export async function listObjects(prefix: string, keyPrefix: string): Promise<string[]> {
  const fullPrefix = PREFIXES[prefix as keyof typeof PREFIXES]
    ? `${PREFIXES[prefix as keyof typeof PREFIXES]}${keyPrefix}`
    : `${prefix}/${keyPrefix}`;

  const objects: string[] = [];
  const stream = minioClient.listObjects(BUCKET, fullPrefix, true);

  return new Promise((resolve, reject) => {
    stream.on('data', (obj) => {
      if (obj.name) {
        // Remove the bucket prefix to get relative path
        const basePrefix = PREFIXES[prefix as keyof typeof PREFIXES] || `${prefix}/`;
        objects.push(obj.name.replace(basePrefix, ''));
      }
    });
    stream.on('error', reject);
    stream.on('end', () => resolve(objects));
  });
}

/**
 * Check if an object exists in storage.
 * @param prefix - The prefix type ('uploads', 'outputs', 'templates')
 * @param key - The object key (without prefix)
 */
export async function objectExists(prefix: string, key: string): Promise<boolean> {
  const fullKey = PREFIXES[prefix as keyof typeof PREFIXES]
    ? `${PREFIXES[prefix as keyof typeof PREFIXES]}${key}`
    : `${prefix}/${key}`;

  try {
    await minioClient.statObject(BUCKET, fullKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Download all source files for a composition from storage to local workspace.
 * Restores the full AI context (plans, code, configs) for continued editing.
 *
 * @param compositionId - The composition ID (e.g., "proj-abc123")
 * @param destDir - Local destination directory (e.g., workspace/src/proj_abc123)
 * @returns List of downloaded files
 */
export async function downloadSourceFromStorage(compositionId: string, destDir: string): Promise<string[]> {
  // List all source files for this composition
  const sourcePrefix = `sources/${compositionId}/`;
  const files = await listObjects('outputs', sourcePrefix);

  if (files.length === 0) {
    throw new Error(`No source files found for composition: ${compositionId}. This project may have been created before source file saving was enabled. Please regenerate visuals to enable AI editing.`);
  }

  // Create destination directory if it doesn't exist
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  const downloadedFiles: string[] = [];

  for (const file of files) {
    // file is like "sources/proj-xxx/index.tsx" or "sources/proj-xxx/scenes/Scene1.tsx"
    // We need to extract the relative path after the compositionId
    const relativePath = file.replace(sourcePrefix, '');
    const localPath = join(destDir, relativePath);

    // Create subdirectories if needed (e.g., for scenes/Scene1.tsx)
    const localDir = dirname(localPath);
    if (!existsSync(localDir)) {
      mkdirSync(localDir, { recursive: true });
    }

    // Download the file
    await downloadFile('outputs', file, localPath);
    downloadedFiles.push(relativePath);
  }

  return downloadedFiles;
}
