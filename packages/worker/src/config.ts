import 'dotenv/config';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { hostname } from 'os';
import { z } from 'zod';

const isProduction = !!process.env.RAILWAY_ENVIRONMENT;

// In production, crash fast if critical env vars are missing
if (isProduction) {
  const prodEnvSchema = z.object({
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
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

// Worker package root (packages/worker/) — used for resolving relative script paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKER_ROOT = resolve(__dirname, '..');

export const config = {
  // Worker identification and workspace
  worker: {
    // Unique worker ID (defaults to hostname)
    id: process.env.WORKER_ID || hostname(),
    // Base path for worker workspace (each worker gets a dedicated directory)
    // Uses /tmp in prod (Railway ephemeral), local dir in dev
    workspacePath: process.env.WORKSPACE_PATH || (
      process.env.RAILWAY_ENVIRONMENT ? '/tmp/workspace' : join(process.cwd(), 'workspace')
    ),
  },

  database: {
    url: process.env.DATABASE_URL || 'postgresql://viona:viona123@localhost:5432/viona',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // Storage configuration is now handled by @viona/shared StorageService
  // This config is kept for backwards compatibility with existing code
  // Use: import { getStorage } from '@viona/shared/storage';
  storage: (() => {
    // Railway Bucket vars take precedence (auto-injected in prod)
    const endpoint = process.env.BUCKET_ENDPOINT || process.env.S3_ENDPOINT || 'localhost';
    // Internal Railway connections (*.railway.internal) use HTTP, not HTTPS
    const isInternalConnection = endpoint.includes('.railway.internal');
    return {
      endpoint,
      port: process.env.BUCKET_PORT ? parseInt(process.env.BUCKET_PORT, 10) : parseInt(process.env.S3_PORT || '9000', 10),
      accessKey: process.env.BUCKET_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY || 'viona',
      secretKey: process.env.BUCKET_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY || 'viona123',
      useSSL: !isInternalConnection && (!!process.env.BUCKET_ENDPOINT || process.env.S3_USE_SSL === 'true'),
      bucket: process.env.BUCKET_NAME || process.env.S3_BUCKET || 'viona',
      region: process.env.BUCKET_REGION || process.env.S3_REGION || 'us-east-1',
      // Prefixes for organizing objects within single bucket
      prefixes: {
        uploads: 'uploads/',
        outputs: 'outputs/',
        templates: 'templates/',
      },
    };
  })(),

  // Legacy alias for backwards compatibility
  get minio() {
    return this.storage;
  },

  // Transcription via OpenAI Whisper API
  transcription: {
    openaiApiKey: process.env.OPENAI_API_KEY,
    language: process.env.WHISPER_LANGUAGE || 'en',
  },

  wordStyleAnalysis: {
    // Set WORD_STYLE_ANALYSIS_ENABLED=false to skip LLM word analysis
    enabled: process.env.WORD_STYLE_ANALYSIS_ENABLED === 'true',
    model: process.env.WORD_STYLE_ANALYSIS_MODEL || 'gpt-4o-mini',
  },

  remotion: {
    projectDir: resolve(process.env.REMOTION_PROJECT_DIR || join(process.cwd(), 'remotion-temp')),
    // IMPORTANT: In production, use /tmp/bundles (ephemeral but uploaded to S3)
    // In development, use local bundles directory
    bundleOutputDir: resolve(process.env.BUNDLE_OUTPUT_DIR || (
      process.env.RAILWAY_ENVIRONMENT ? '/tmp/bundles' : join(WORKER_ROOT, 'bundles')
    )),
  },

  // Python path for running Python scripts (head-tracking)
  pythonPath: process.env.PYTHON_PATH || 'python',

  // GPU inference dispatch
  inference: {
    provider: (process.env.INFERENCE_PROVIDER ?? (process.env.RAILWAY_ENVIRONMENT ? 'runpod' : 'worker')) as 'runpod' | 'worker',
  },

  // Anthropic model selection. Mirror of packages/api/src/config.ts — kept in
  // sync so the API + worker invoke the same model for parity.
  anthropic: {
    model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-6',
  },
} as const;
