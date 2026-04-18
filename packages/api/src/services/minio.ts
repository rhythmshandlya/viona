import { Client } from 'minio';
import { config } from '../config.js';
import { logger } from '../logger.js';

// Public endpoint for presigned URLs (browsers need public access)
const publicEndpoint = process.env.BUCKET_PUBLIC_ENDPOINT || process.env.RAILWAY_SERVICE_STORAGE_URL;
const isInternalEndpoint = config.storage.endpoint.includes('.railway.internal');

// Build MinIO client configuration for internal operations
const clientConfig: {
  endPoint: string;
  port?: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  region?: string;
} = {
  endPoint: config.storage.endpoint,
  useSSL: config.storage.useSSL,
  accessKey: config.storage.accessKey,
  secretKey: config.storage.secretKey,
  region: config.storage.region,
};

// Only add port for local MinIO (Railway doesn't use port)
if (config.storage.port) {
  clientConfig.port = config.storage.port;
}

export const minioClient = new Client(clientConfig);

// Create a separate client for presigned URLs that uses the public endpoint
// This is needed because presigned URL signatures include the hostname
// If we sign with internal hostname and serve from public hostname, signature fails
const presignedClient = (isInternalEndpoint && publicEndpoint)
  ? new Client({
      endPoint: publicEndpoint,
      useSSL: true, // Public endpoint always uses HTTPS
      accessKey: config.storage.accessKey,
      secretKey: config.storage.secretKey,
      region: config.storage.region,
    })
  : minioClient;

// Single bucket name
const BUCKET = config.storage.bucket;

// Prefixes for organizing objects
const PREFIXES = config.storage.prefixes;

/**
 * Ensure the bucket exists (creates if not present)
 */
export async function ensureBuckets() {
  const exists = await minioClient.bucketExists(BUCKET);
  if (!exists) {
    await minioClient.makeBucket(BUCKET, config.storage.region);
    logger.info({ bucket: BUCKET }, 'Created bucket');
  }
}

/**
 * Get full key with prefix for uploads
 */
export function getUploadKey(key: string): string {
  return `${PREFIXES.uploads}${key}`;
}

/**
 * Get full key with prefix for outputs
 */
export function getOutputKey(key: string): string {
  return `${PREFIXES.outputs}${key}`;
}

/**
 * Get full key with prefix for templates
 */
export function getTemplateKey(key: string): string {
  return `${PREFIXES.templates}${key}`;
}

export async function getPresignedUploadUrl(
  prefix: 'uploads' | 'outputs' | 'templates',
  key: string,
  expirySeconds = 3600
): Promise<string> {
  const fullKey = `${PREFIXES[prefix]}${key}`;
  // Use presignedClient which is configured with public endpoint for correct signatures
  const url = await presignedClient.presignedPutObject(BUCKET, fullKey, expirySeconds);
  return url;
}

export async function getPresignedDownloadUrl(
  prefix: 'uploads' | 'outputs' | 'templates',
  key: string,
  expirySeconds = 3600
): Promise<string> {
  const fullKey = `${PREFIXES[prefix]}${key}`;
  // Use presignedClient which is configured with public endpoint for correct signatures
  const url = await presignedClient.presignedGetObject(BUCKET, fullKey, expirySeconds);
  return url;
}

export async function deleteObject(prefix: 'uploads' | 'outputs' | 'templates', key: string): Promise<void> {
  const fullKey = `${PREFIXES[prefix]}${key}`;
  await minioClient.removeObject(BUCKET, fullKey);
}

export async function objectExists(prefix: 'uploads' | 'outputs' | 'templates' | 'sources', key: string): Promise<boolean> {
  try {
    const fullKey = `${PREFIXES[prefix]}${key}`;
    await minioClient.statObject(BUCKET, fullKey);
    return true;
  } catch {
    return false;
  }
}

export async function getObjectStream(prefix: 'uploads' | 'outputs' | 'templates' | 'sources', key: string) {
  const fullKey = `${PREFIXES[prefix]}${key}`;
  return minioClient.getObject(BUCKET, fullKey);
}

export async function getPartialObjectStream(
  prefix: 'uploads' | 'outputs' | 'templates',
  key: string,
  offset: number,
  length?: number,
) {
  const fullKey = `${PREFIXES[prefix]}${key}`;
  return length !== undefined
    ? minioClient.getPartialObject(BUCKET, fullKey, offset, length)
    : minioClient.getPartialObject(BUCKET, fullKey, offset);
}

export async function getObjectStat(prefix: 'uploads' | 'outputs' | 'templates', key: string) {
  const fullKey = `${PREFIXES[prefix]}${key}`;
  return minioClient.statObject(BUCKET, fullKey);
}

// Legacy compatibility - these match the old API signatures
// Used by routes that still pass bucket names directly
export async function getPresignedUploadUrlLegacy(
  _bucket: string, // ignored, kept for signature compatibility
  key: string,
  expirySeconds = 3600
): Promise<string> {
  // Use presignedClient which is configured with public endpoint for correct signatures
  const url = await presignedClient.presignedPutObject(BUCKET, key, expirySeconds);
  return url;
}

export async function getPresignedDownloadUrlLegacy(
  _bucket: string,
  key: string,
  expirySeconds = 3600
): Promise<string> {
  // Use presignedClient which is configured with public endpoint for correct signatures
  const url = await presignedClient.presignedGetObject(BUCKET, key, expirySeconds);
  return url;
}

/**
 * Upload a stream directly to storage (used for proxy uploads)
 */
export async function uploadStream(
  prefix: 'uploads' | 'outputs' | 'templates',
  key: string,
  stream: import('stream').Readable | Buffer | string,
  size?: number,
  contentType?: string
): Promise<void> {
  const fullKey = `${PREFIXES[prefix]}${key}`;
  const metaData = contentType ? { 'Content-Type': contentType } : {};
  await minioClient.putObject(BUCKET, fullKey, stream, size, metaData);
}

/**
 * List all objects with a given prefix.
 * @param prefix - The prefix type ('uploads', 'outputs', 'templates')
 * @param keyPrefix - Additional prefix within the bucket prefix
 */
export async function listObjects(prefix: 'uploads' | 'outputs' | 'templates', keyPrefix: string): Promise<string[]> {
  const fullPrefix = `${PREFIXES[prefix]}${keyPrefix}`;

  const objects: string[] = [];
  const stream = minioClient.listObjects(BUCKET, fullPrefix, true);

  return new Promise((resolve, reject) => {
    stream.on('data', (obj) => {
      if (obj.name) {
        // Remove the bucket prefix to get relative path
        objects.push(obj.name.replace(PREFIXES[prefix], ''));
      }
    });
    stream.on('error', reject);
    stream.on('end', () => resolve(objects));
  });
}

/**
 * Delete all objects under a given prefix (e.g. bundles/{compositionId}/ or sources/{compositionId}/).
 */
export async function deleteObjectsByPrefix(prefix: 'uploads' | 'outputs' | 'templates', keyPrefix: string): Promise<number> {
  const keys = await listObjects(prefix, keyPrefix);
  for (const key of keys) {
    await deleteObject(prefix, key);
  }
  return keys.length;
}

// Named exports for dispatcher (avoids importing raw config in inference layer)
export const BUCKET_NAME = BUCKET;
export const OUTPUTS_PREFIX = PREFIXES.outputs;
export const UPLOADS_PREFIX = PREFIXES.uploads;
export { presignedClient };
