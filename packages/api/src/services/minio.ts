import { Client } from 'minio';
import { config } from '../config.js';

export const minioClient = new Client({
  endPoint: config.minio.endpoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

export async function ensureBuckets() {
  const buckets = [config.minio.buckets.uploads, config.minio.buckets.outputs];

  for (const bucket of buckets) {
    const exists = await minioClient.bucketExists(bucket);
    if (!exists) {
      await minioClient.makeBucket(bucket);
      console.log(`Created bucket: ${bucket}`);
    }
  }
}

export async function getPresignedUploadUrl(
  bucket: string,
  key: string,
  expirySeconds = 3600
): Promise<string> {
  return minioClient.presignedPutObject(bucket, key, expirySeconds);
}

export async function getPresignedDownloadUrl(
  bucket: string,
  key: string,
  expirySeconds = 3600
): Promise<string> {
  return minioClient.presignedGetObject(bucket, key, expirySeconds);
}

export async function deleteObject(bucket: string, key: string): Promise<void> {
  await minioClient.removeObject(bucket, key);
}

export async function objectExists(bucket: string, key: string): Promise<boolean> {
  try {
    await minioClient.statObject(bucket, key);
    return true;
  } catch {
    return false;
  }
}

export async function getObjectStream(bucket: string, key: string) {
  return minioClient.getObject(bucket, key);
}

export async function getPartialObjectStream(
  bucket: string,
  key: string,
  offset: number,
  length?: number,
) {
  return length !== undefined
    ? minioClient.getPartialObject(bucket, key, offset, length)
    : minioClient.getPartialObject(bucket, key, offset);
}

export async function getObjectStat(bucket: string, key: string) {
  return minioClient.statObject(bucket, key);
}
