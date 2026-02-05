import { Client } from 'minio';
import { createWriteStream, createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { config } from '../config.js';

export const minioClient = new Client({
  endPoint: config.minio.endpoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

export async function downloadFile(bucket: string, key: string, destPath: string): Promise<void> {
  const stream = await minioClient.getObject(bucket, key);
  const writeStream = createWriteStream(destPath);
  await pipeline(stream, writeStream);
}

export async function uploadFile(bucket: string, key: string, srcPath: string): Promise<void> {
  await minioClient.fPutObject(bucket, key, srcPath);
}

export async function getObjectStream(bucket: string, key: string) {
  return minioClient.getObject(bucket, key);
}

export async function objectExists(bucket: string, key: string): Promise<boolean> {
  try {
    await minioClient.statObject(bucket, key);
    return true;
  } catch (err: any) {
    if (err.code === 'NotFound' || err.code === 'NoSuchKey') {
      return false;
    }
    throw err;
  }
}
