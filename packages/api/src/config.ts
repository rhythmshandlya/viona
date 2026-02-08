import 'dotenv/config';
import { resolve, join } from 'path';

// Determine if running on Railway (production)
const isRailway = !!process.env.BUCKET_ENDPOINT || !!process.env.RAILWAY_ENVIRONMENT;

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),

  // Bundle output directory (shared with worker for local development)
  // In Railway, bundles are ephemeral on worker containers
  bundles: {
    dir: resolve(process.env.BUNDLE_OUTPUT_DIR || join(process.cwd(), '..', 'worker', 'bundles')),
  },

  database: {
    url: process.env.DATABASE_URL || 'postgresql://reelify:reelify123@localhost:5432/reelify',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // Storage configuration - single bucket with prefixes
  // Railway Bucket vars take precedence (auto-injected in prod)
  storage: {
    endpoint: process.env.BUCKET_ENDPOINT || process.env.S3_ENDPOINT || 'localhost',
    port: isRailway ? undefined : parseInt(process.env.S3_PORT || '9000', 10),
    accessKey: process.env.BUCKET_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY || 'reelify',
    secretKey: process.env.BUCKET_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY || 'reelify123',
    useSSL: isRailway || process.env.S3_USE_SSL === 'true',
    bucket: process.env.BUCKET_NAME || process.env.S3_BUCKET || 'cllipify',
    region: process.env.BUCKET_REGION || process.env.S3_REGION || 'us-east-1',
    // Prefixes for organizing objects within single bucket
    prefixes: {
      uploads: 'uploads/',
      outputs: 'outputs/',
      templates: 'templates/',
    },
  },

  // Legacy alias for backwards compatibility
  get minio() {
    return this.storage;
  },
} as const;
