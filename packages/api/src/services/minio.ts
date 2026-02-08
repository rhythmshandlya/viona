import { Client } from 'minio';
import { config } from '../config.js';

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

// Public endpoint for presigned URLs (browsers need public access)
const publicEndpoint = process.env.BUCKET_PUBLIC_ENDPOINT || process.env.RAILWAY_SERVICE_STORAGE_URL;
const isInternalEndpoint = config.storage.endpoint.includes('.railway.internal');

/**
 * Convert internal presigned URL to public URL for browser access
 */
function toPublicUrl(url: string): string {
  if (!isInternalEndpoint || !publicEndpoint) {
    return url;
  }
  // Replace internal endpoint with public endpoint
  // Internal: http://storage.railway.internal:9000/...
  // Public: https://storage-production-xxxx.up.railway.app/...
  const internalPattern = new RegExp(`http://${config.storage.endpoint}:${config.storage.port || 9000}`);
  return url.replace(internalPattern, `https://${publicEndpoint}`);
}

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
    console.log(`Created bucket: ${BUCKET}`);
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
  const url = await minioClient.presignedPutObject(BUCKET, fullKey, expirySeconds);
  return toPublicUrl(url);
}

export async function getPresignedDownloadUrl(
  prefix: 'uploads' | 'outputs' | 'templates',
  key: string,
  expirySeconds = 3600
): Promise<string> {
  const fullKey = `${PREFIXES[prefix]}${key}`;
  const url = await minioClient.presignedGetObject(BUCKET, fullKey, expirySeconds);
  return toPublicUrl(url);
}

export async function deleteObject(prefix: 'uploads' | 'outputs' | 'templates', key: string): Promise<void> {
  const fullKey = `${PREFIXES[prefix]}${key}`;
  await minioClient.removeObject(BUCKET, fullKey);
}

export async function objectExists(prefix: 'uploads' | 'outputs' | 'templates', key: string): Promise<boolean> {
  try {
    const fullKey = `${PREFIXES[prefix]}${key}`;
    await minioClient.statObject(BUCKET, fullKey);
    return true;
  } catch {
    return false;
  }
}

export async function getObjectStream(prefix: 'uploads' | 'outputs' | 'templates', key: string) {
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
  // Determine prefix from key or default to uploads
  const url = await minioClient.presignedPutObject(BUCKET, key, expirySeconds);
  return toPublicUrl(url);
}

export async function getPresignedDownloadUrlLegacy(
  _bucket: string,
  key: string,
  expirySeconds = 3600
): Promise<string> {
  const url = await minioClient.presignedGetObject(BUCKET, key, expirySeconds);
  return toPublicUrl(url);
}

/**
 * Upload a stream directly to storage (used for proxy uploads)
 */
export async function uploadStream(
  prefix: 'uploads' | 'outputs' | 'templates',
  key: string,
  stream: NodeJS.ReadableStream,
  size?: number,
  contentType?: string
): Promise<void> {
  const fullKey = `${PREFIXES[prefix]}${key}`;
  const metaData = contentType ? { 'Content-Type': contentType } : {};
  await minioClient.putObject(BUCKET, fullKey, stream, size, metaData);
}
