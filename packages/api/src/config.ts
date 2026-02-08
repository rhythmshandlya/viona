import 'dotenv/config';
import { join, resolve } from 'path';

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),

  database: {
    url: process.env.DATABASE_URL || 'postgresql://reelify:reelify123@localhost:5432/reelify',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // Storage (S3-compatible: MinIO for dev, Railway Simple S3 for prod)
  storage: {
    endpoint: process.env.S3_ENDPOINT || process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.S3_PORT || process.env.MINIO_PORT || '9000', 10),
    accessKey: process.env.S3_ACCESS_KEY || process.env.MINIO_ACCESS_KEY || 'reelify',
    secretKey: process.env.S3_SECRET_KEY || process.env.MINIO_SECRET_KEY || 'reelify123',
    useSSL: (process.env.S3_USE_SSL || process.env.MINIO_USE_SSL) === 'true',
    buckets: {
      uploads: process.env.S3_BUCKET_UPLOADS || process.env.MINIO_BUCKET_UPLOADS || 'uploads',
      outputs: process.env.S3_BUCKET_OUTPUTS || process.env.MINIO_BUCKET_OUTPUTS || 'outputs',
      templates: process.env.S3_BUCKET_TEMPLATES || 'templates',
    },
  },

  // Legacy alias for backwards compatibility
  get minio() {
    return this.storage;
  },

  bundles: {
    // IMPORTANT: This must match the worker's remotion.bundleOutputDir config (set BUNDLE_OUTPUT_DIR in .env)
    dir: resolve(process.env.BUNDLE_OUTPUT_DIR || join(process.cwd(), '..', 'worker', 'bundles')),
  },
} as const;
