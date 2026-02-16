import { Client } from 'minio';
import { Readable } from 'stream';

/**
 * Storage configuration supporting both:
 * - Local MinIO (multiple buckets: uploads, outputs, templates)
 * - Railway Buckets (single bucket with prefixes: uploads/, outputs/, templates/)
 */
export interface StorageConfig {
  endpoint: string;
  port?: number;  // Optional - Railway doesn't use port
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;  // Single bucket name
  region?: string;

  // Prefixes for organizing objects within the bucket
  prefixes: {
    uploads: string;
    outputs: string;
    templates: string;
  };
}

/**
 * Create storage config from environment variables.
 * Supports both Railway Bucket vars and legacy MinIO vars.
 */
export function createStorageConfigFromEnv(): StorageConfig {
  // Railway Bucket uses these auto-injected vars
  const isRailway = !!process.env.BUCKET_ENDPOINT || !!process.env.RAILWAY_ENVIRONMENT;

  if (isRailway) {
    // Internal Railway connections (*.railway.internal) use HTTP, not HTTPS
    const endpoint = process.env.BUCKET_ENDPOINT || 'storage.railway.internal';
    const isInternalConnection = endpoint.includes('.railway.internal');

    return {
      endpoint,
      port: process.env.BUCKET_PORT ? parseInt(process.env.BUCKET_PORT, 10) : undefined,
      useSSL: !isInternalConnection, // Use HTTP for internal, HTTPS for external
      accessKey: process.env.BUCKET_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '',
      secretKey: process.env.BUCKET_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
      bucket: process.env.BUCKET_NAME || process.env.BUCKET || '',
      region: process.env.BUCKET_REGION || process.env.AWS_REGION || 'us-east-1',
      prefixes: {
        uploads: 'uploads/',
        outputs: 'outputs/',
        templates: 'templates/',
      },
    };
  }

  // Local MinIO / S3-compatible storage
  return {
    endpoint: process.env.S3_ENDPOINT || 'localhost',
    port: parseInt(process.env.S3_PORT || '9000', 10),
    useSSL: process.env.S3_USE_SSL === 'true',
    accessKey: process.env.S3_ACCESS_KEY || 'reelify',
    secretKey: process.env.S3_SECRET_KEY || 'reelify123',
    bucket: process.env.S3_BUCKET || 'viona',
    region: process.env.S3_REGION || 'us-east-1',
    prefixes: {
      uploads: 'uploads/',
      outputs: 'outputs/',
      templates: 'templates/',
    },
  };
}

export class StorageService {
  private client: Client;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;

    const clientConfig: any = {
      endPoint: config.endpoint,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    };

    // Only set port for non-Railway (local MinIO)
    if (config.port) {
      clientConfig.port = config.port;
    }

    // Set region if provided
    if (config.region) {
      clientConfig.region = config.region;
    }

    this.client = new Client(clientConfig);
  }

  // ============ Bucket Management ============

  async ensureBucket(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.config.bucket);
      if (!exists) {
        await this.client.makeBucket(this.config.bucket, this.config.region || 'us-east-1');
        console.log(`[Storage] Created bucket: ${this.config.bucket}`);
      }
    } catch (error: any) {
      // Railway Buckets are pre-created, ignore "already exists" errors
      if (!error.message?.includes('already exists') && !error.message?.includes('BucketAlreadyOwnedByYou')) {
        throw error;
      }
    }
  }

  // ============ Key Helpers ============

  private uploadsKey(key: string): string {
    return `${this.config.prefixes.uploads}${key}`;
  }

  private outputsKey(key: string): string {
    return `${this.config.prefixes.outputs}${key}`;
  }

  private templatesKey(key: string): string {
    return `${this.config.prefixes.templates}${key}`;
  }

  // ============ Generic Operations ============

  async uploadBuffer(key: string, data: Buffer, contentType?: string): Promise<void> {
    const metadata = contentType ? { 'Content-Type': contentType } : {};
    await this.client.putObject(this.config.bucket, key, data, data.length, metadata);
  }

  async uploadStream(key: string, stream: Readable, size?: number): Promise<void> {
    await this.client.putObject(this.config.bucket, key, stream, size);
  }

  async uploadFile(key: string, filePath: string): Promise<void> {
    await this.client.fPutObject(this.config.bucket, key, filePath);
  }

  async downloadBuffer(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.config.bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async downloadFile(key: string, destPath: string): Promise<void> {
    await this.client.fGetObject(this.config.bucket, key, destPath);
  }

  async getObjectStream(key: string): Promise<Readable> {
    return this.client.getObject(this.config.bucket, key);
  }

  async getPartialObjectStream(key: string, offset: number, length?: number): Promise<Readable> {
    return length !== undefined
      ? this.client.getPartialObject(this.config.bucket, key, offset, length)
      : this.client.getPartialObject(this.config.bucket, key, offset);
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.removeObject(this.config.bucket, key);
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.config.bucket, key);
      return true;
    } catch {
      return false;
    }
  }

  async getObjectStat(key: string) {
    return this.client.statObject(this.config.bucket, key);
  }

  // ============ Presigned URLs ============

  async getPresignedUploadUrl(key: string, expirySeconds = 3600): Promise<string> {
    return this.client.presignedPutObject(this.config.bucket, key, expirySeconds);
  }

  async getPresignedDownloadUrl(key: string, expirySeconds = 3600): Promise<string> {
    return this.client.presignedGetObject(this.config.bucket, key, expirySeconds);
  }

  // ============ List Operations ============

  async listObjects(prefix?: string): Promise<string[]> {
    const objects: string[] = [];
    const stream = this.client.listObjects(this.config.bucket, prefix, true);
    for await (const obj of stream) {
      if (obj.name) {
        objects.push(obj.name);
      }
    }
    return objects;
  }

  async deleteObjects(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.client.removeObjects(this.config.bucket, keys);
  }

  // ============ Uploads Operations ============

  async uploadUserFile(key: string, filePath: string): Promise<string> {
    const fullKey = this.uploadsKey(key);
    await this.uploadFile(fullKey, filePath);
    return fullKey;
  }

  async downloadUserFile(key: string, destPath: string): Promise<void> {
    const fullKey = key.startsWith(this.config.prefixes.uploads) ? key : this.uploadsKey(key);
    await this.downloadFile(fullKey, destPath);
  }

  async getUserFileUrl(key: string, expirySeconds = 3600): Promise<string> {
    const fullKey = key.startsWith(this.config.prefixes.uploads) ? key : this.uploadsKey(key);
    return this.getPresignedDownloadUrl(fullKey, expirySeconds);
  }

  async getUploadPresignedUrl(key: string, expirySeconds = 3600): Promise<string> {
    const fullKey = this.uploadsKey(key);
    return this.getPresignedUploadUrl(fullKey, expirySeconds);
  }

  // ============ Template Operations ============

  async uploadTemplate(name: string, filePath: string): Promise<string> {
    const key = this.templatesKey(name);
    await this.uploadFile(key, filePath);
    console.log(`[Storage] Uploaded template: ${key}`);
    return key;
  }

  async downloadTemplate(name: string, destPath: string): Promise<void> {
    const key = this.templatesKey(name);
    await this.downloadFile(key, destPath);
    console.log(`[Storage] Downloaded template: ${key}`);
  }

  async templateExists(name: string): Promise<boolean> {
    const key = this.templatesKey(name);
    return this.objectExists(key);
  }

  async listTemplates(): Promise<string[]> {
    const objects = await this.listObjects(this.config.prefixes.templates);
    return objects.map(obj => obj.replace(this.config.prefixes.templates, ''));
  }

  // ============ Bundle Operations ============

  async uploadBundle(projectId: string, filePath: string): Promise<string> {
    const key = this.outputsKey(`bundles/${projectId}.zip`);
    await this.uploadFile(key, filePath);
    console.log(`[Storage] Uploaded bundle: ${key}`);
    return key;
  }

  async downloadBundle(projectId: string, destPath: string): Promise<void> {
    const key = this.outputsKey(`bundles/${projectId}.zip`);
    await this.downloadFile(key, destPath);
  }

  async getBundleUrl(projectId: string, expirySeconds = 3600): Promise<string> {
    const key = this.outputsKey(`bundles/${projectId}.zip`);
    return this.getPresignedDownloadUrl(key, expirySeconds);
  }

  async bundleExists(projectId: string): Promise<boolean> {
    const key = this.outputsKey(`bundles/${projectId}.zip`);
    return this.objectExists(key);
  }

  async deleteBundle(projectId: string): Promise<void> {
    const key = this.outputsKey(`bundles/${projectId}.zip`);
    await this.deleteObject(key);
  }

  // ============ Output Operations ============

  async uploadOutput(key: string, filePath: string): Promise<string> {
    const fullKey = this.outputsKey(key);
    await this.uploadFile(fullKey, filePath);
    return fullKey;
  }

  async downloadOutput(key: string, destPath: string): Promise<void> {
    const fullKey = key.startsWith(this.config.prefixes.outputs) ? key : this.outputsKey(key);
    await this.downloadFile(fullKey, destPath);
  }

  async getOutputUrl(key: string, expirySeconds = 3600): Promise<string> {
    const fullKey = key.startsWith(this.config.prefixes.outputs) ? key : this.outputsKey(key);
    return this.getPresignedDownloadUrl(fullKey, expirySeconds);
  }

  // ============ Accessors ============

  get bucketName(): string {
    return this.config.bucket;
  }

  get prefixes() {
    return this.config.prefixes;
  }

  getClient(): Client {
    return this.client;
  }

  isRailway(): boolean {
    return this.config.endpoint === 'storage.railway.app';
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
