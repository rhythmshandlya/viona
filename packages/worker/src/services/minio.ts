import { Client } from 'minio';
import { createWriteStream, createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
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
