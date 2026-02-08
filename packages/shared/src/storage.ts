import { Client } from 'minio';
import { Readable } from 'stream';

export interface StorageConfig {
  endpoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  buckets: {
    uploads: string;
    outputs: string;
    templates: string;
  };
}

export function createStorageConfigFromEnv(): StorageConfig {
  return {
    endpoint: process.env.S3_ENDPOINT || 'localhost',
    port: parseInt(process.env.S3_PORT || '9000', 10),
    useSSL: process.env.S3_USE_SSL === 'true',
    accessKey: process.env.S3_ACCESS_KEY || 'reelify',
    secretKey: process.env.S3_SECRET_KEY || 'reelify123',
    buckets: {
      uploads: process.env.S3_BUCKET_UPLOADS || 'uploads',
      outputs: process.env.S3_BUCKET_OUTPUTS || 'outputs',
      templates: process.env.S3_BUCKET_TEMPLATES || 'templates',
    },
  };
}

export class StorageService {
  private client: Client;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
    this.client = new Client({
      endPoint: config.endpoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });
  }

  // ============ Bucket Management ============

  async ensureBuckets(): Promise<void> {
    const buckets = Object.values(this.config.buckets);
    for (const bucket of buckets) {
      const exists = await this.client.bucketExists(bucket);
      if (!exists) {
        await this.client.makeBucket(bucket);
        console.log(`[Storage] Created bucket: ${bucket}`);
      }
    }
  }

  // ============ Generic Operations ============

  async uploadBuffer(bucket: string, key: string, data: Buffer, contentType?: string): Promise<void> {
    const metadata = contentType ? { 'Content-Type': contentType } : {};
    await this.client.putObject(bucket, key, data, data.length, metadata);
  }

  async uploadStream(bucket: string, key: string, stream: Readable, size?: number): Promise<void> {
    await this.client.putObject(bucket, key, stream, size);
  }

  async uploadFile(bucket: string, key: string, filePath: string): Promise<void> {
    await this.client.fPutObject(bucket, key, filePath);
  }

  async downloadBuffer(bucket: string, key: string): Promise<Buffer> {
    const stream = await this.client.getObject(bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async downloadFile(bucket: string, key: string, destPath: string): Promise<void> {
    await this.client.fGetObject(bucket, key, destPath);
  }

  async getObjectStream(bucket: string, key: string): Promise<Readable> {
    return this.client.getObject(bucket, key);
  }

  async getPartialObjectStream(bucket: string, key: string, offset: number, length?: number): Promise<Readable> {
    return length !== undefined
      ? this.client.getPartialObject(bucket, key, offset, length)
      : this.client.getPartialObject(bucket, key, offset);
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    await this.client.removeObject(bucket, key);
  }

  async objectExists(bucket: string, key: string): Promise<boolean> {
    try {
      await this.client.statObject(bucket, key);
      return true;
    } catch {
      return false;
    }
  }

  async getObjectStat(bucket: string, key: string) {
    return this.client.statObject(bucket, key);
  }

  // ============ Presigned URLs ============

  async getPresignedUploadUrl(bucket: string, key: string, expirySeconds = 3600): Promise<string> {
    return this.client.presignedPutObject(bucket, key, expirySeconds);
  }

  async getPresignedDownloadUrl(bucket: string, key: string, expirySeconds = 3600): Promise<string> {
    return this.client.presignedGetObject(bucket, key, expirySeconds);
  }

  // ============ List Operations ============

  async listObjects(bucket: string, prefix?: string): Promise<string[]> {
    const objects: string[] = [];
    const stream = this.client.listObjects(bucket, prefix, true);
    for await (const obj of stream) {
      if (obj.name) {
        objects.push(obj.name);
      }
    }
    return objects;
  }

  async deleteObjects(bucket: string, keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.client.removeObjects(bucket, keys);
  }

  // ============ Template Operations ============

  get templatesBucket(): string {
    return this.config.buckets.templates;
  }

  async uploadTemplate(key: string, filePath: string): Promise<void> {
    await this.uploadFile(this.config.buckets.templates, key, filePath);
  }

  async downloadTemplate(key: string, destPath: string): Promise<void> {
    await this.downloadFile(this.config.buckets.templates, key, destPath);
  }

  async templateExists(key: string): Promise<boolean> {
    return this.objectExists(this.config.buckets.templates, key);
  }

  async listTemplates(prefix?: string): Promise<string[]> {
    return this.listObjects(this.config.buckets.templates, prefix);
  }

  // ============ Bundle Operations ============

  get outputsBucket(): string {
    return this.config.buckets.outputs;
  }

  async uploadBundle(projectId: string, filePath: string): Promise<string> {
    const key = `bundles/${projectId}.zip`;
    await this.uploadFile(this.config.buckets.outputs, key, filePath);
    return key;
  }

  async downloadBundle(projectId: string, destPath: string): Promise<void> {
    const key = `bundles/${projectId}.zip`;
    await this.downloadFile(this.config.buckets.outputs, key, destPath);
  }

  async getBundleUrl(projectId: string, expirySeconds = 3600): Promise<string> {
    const key = `bundles/${projectId}.zip`;
    return this.getPresignedDownloadUrl(this.config.buckets.outputs, key, expirySeconds);
  }

  async bundleExists(projectId: string): Promise<boolean> {
    const key = `bundles/${projectId}.zip`;
    return this.objectExists(this.config.buckets.outputs, key);
  }

  // ============ Upload Operations ============

  get uploadsBucket(): string {
    return this.config.buckets.uploads;
  }

  async getUploadUrl(key: string, expirySeconds = 3600): Promise<string> {
    return this.getPresignedUploadUrl(this.config.buckets.uploads, key, expirySeconds);
  }

  async getDownloadUrl(key: string, expirySeconds = 3600): Promise<string> {
    return this.getPresignedDownloadUrl(this.config.buckets.uploads, key, expirySeconds);
  }

  // ============ Accessors ============

  get buckets() {
    return this.config.buckets;
  }

  getClient(): Client {
    return this.client;
  }
}

// Singleton instance (lazy initialization)
let storageInstance: StorageService | null = null;

export function getStorage(): StorageService {
  if (!storageInstance) {
    storageInstance = new StorageService(createStorageConfigFromEnv());
  }
  return storageInstance;
}

export function initStorage(config: StorageConfig): StorageService {
  storageInstance = new StorageService(config);
  return storageInstance;
}
