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
    url: process.env.DATABASE_URL || 'postgresql://viona:viona123@localhost:5432/viona',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // Storage configuration - single bucket with prefixes
  // Railway Bucket vars take precedence (auto-injected in prod)
  storage: {
    endpoint: storageEndpoint,
    port: process.env.BUCKET_PORT ? parseInt(process.env.BUCKET_PORT, 10) : parseInt(process.env.S3_PORT || '9000', 10),
    accessKey: process.env.BUCKET_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY || 'viona',
    secretKey: process.env.BUCKET_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY || 'viona123',
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

  // Sandbox configuration
  sandbox: {
    provider: (process.env.SANDBOX_PROVIDER || 'docker') as 'railway' | 'docker',
    image: process.env.SANDBOX_IMAGE || 'viona-sandbox:latest',
    idleTimeoutMs: parseInt(process.env.SANDBOX_IDLE_TIMEOUT_MS || '600000', 10),  // 10 min
    checkpointIntervalMs: parseInt(process.env.SANDBOX_CHECKPOINT_MS || '60000', 10),  // 60s
    maxConcurrent: parseInt(process.env.SANDBOX_MAX_CONCURRENT || '100', 10),
    reconnectionGraceMs: 30_000,  // 30s grace period before idle timer starts
    // Railway-specific (production)
    railway: {
      apiToken: process.env.RAILWAY_API_TOKEN || '',
      projectId: process.env.RAILWAY_PROJECT_ID || '',
      environmentId: process.env.RAILWAY_ENVIRONMENT_ID || '',
      repo: process.env.SANDBOX_REPO || 'rhythmshandlya/clippify',
      branch: process.env.SANDBOX_BRANCH || 'main',
    },
    /** Callback URL that sandbox containers use to reach this API instance. */
    get callbackUrl(): string {
      if (process.env.RAILWAY_PRIVATE_DOMAIN) {
        return `http://${process.env.RAILWAY_PRIVATE_DOMAIN}`;
      }
      if (process.env.RAILWAY_PUBLIC_DOMAIN) {
        return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
      }
      return process.env.API_CALLBACK_URL || 'http://host.docker.internal:4000';
    },
  },
} as const;
