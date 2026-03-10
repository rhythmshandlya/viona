import 'dotenv/config';
import { resolve, join } from 'path';
import { z } from 'zod';

const isProduction = !!process.env.RAILWAY_ENVIRONMENT;

// In production, crash fast if critical env vars are missing
if (isProduction) {
  const prodEnvSchema = z.object({
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    COOKIE_SECRET: z.string().min(16),
    STYTCH_PROJECT_ID: z.string().min(1),
    STYTCH_SECRET: z.string().min(1),
  });

  const result = prodEnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('FATAL: Missing required environment variables in production:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
}

// Determine if running on Railway (production)
const isRailway = !!process.env.BUCKET_ENDPOINT || !!process.env.RAILWAY_ENVIRONMENT;
// Internal Railway connections (*.railway.internal) use HTTP, not HTTPS
const storageEndpoint = process.env.BUCKET_ENDPOINT || process.env.S3_ENDPOINT || 'localhost';
const isInternalConnection = storageEndpoint.includes('.railway.internal');

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
    endpoint: storageEndpoint,
    port: process.env.BUCKET_PORT ? parseInt(process.env.BUCKET_PORT, 10) : parseInt(process.env.S3_PORT || '9000', 10),
    accessKey: process.env.BUCKET_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY || 'reelify',
    secretKey: process.env.BUCKET_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY || 'reelify123',
    useSSL: isRailway && !isInternalConnection ? true : process.env.S3_USE_SSL === 'true',
    bucket: process.env.BUCKET_NAME || process.env.S3_BUCKET || 'viona',
    region: process.env.BUCKET_REGION || process.env.S3_REGION || 'us-east-1',
    // Prefixes for organizing objects within single bucket
    prefixes: {
      uploads: 'uploads/',
      outputs: 'outputs/',
      templates: 'templates/',
      sources: 'sources/',
    },
  },

  // Legacy alias for backwards compatibility
  get minio() {
    return this.storage;
  },

  // CORS — in production, restrict to explicit origins
  corsOrigin: process.env.CORS_ORIGIN || '',

  // Anthropic (Creative Director agent)
  // Requires ANTHROPIC_API_KEY in environment (Claude Agent SDK uses it for auth)
  anthropic: {
    model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-6',
  },

  // Stytch authentication
  stytch: {
    projectId: process.env.STYTCH_PROJECT_ID || '',
    secret: process.env.STYTCH_SECRET || '',
  },

  // YouTube Data API
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY || '',
  },
} as const;
