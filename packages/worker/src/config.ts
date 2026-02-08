import 'dotenv/config';
import { join, resolve } from 'path';
import { hostname } from 'os';

export const config = {
  // Worker identification and workspace
  worker: {
    // Unique worker ID (defaults to hostname)
    id: process.env.WORKER_ID || hostname(),
    // Base path for worker workspace (each worker gets a dedicated directory)
    workspacePath: process.env.WORKSPACE_PATH || join(process.cwd(), 'workspace'),
    // Template directory for Remotion project
    templatePath: process.env.WORKSPACE_TEMPLATE_PATH || join(process.cwd(), 'remotion-template'),
  },

  // Claude Agent SDK visual generator (uses OAuth authentication)
  claudeAgent: {
    // Model for visual generation
    model: process.env.CLAUDE_AGENT_MODEL || 'claude-opus-4-5-20251101',
    // Extended thinking tokens for planning
    maxThinkingTokens: parseInt(process.env.CLAUDE_AGENT_MAX_THINKING_TOKENS || '10000', 10),
    // Maximum agent turns
    maxTurns: parseInt(process.env.CLAUDE_AGENT_MAX_TURNS || '100', 10),
    // Timeout for generation (45 minutes default - includes Director + Animator + retries)
    timeoutSeconds: parseInt(process.env.CLAUDE_AGENT_TIMEOUT || '2700', 10),
    // Maximum retries on failure (more for transient API errors)
    maxRetries: parseInt(process.env.CLAUDE_AGENT_MAX_RETRIES || '4', 10),
  },

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

  // Transcription mode: "local" (WhisperX) or "api" (OpenAI Whisper API)
  transcription: {
    mode: (process.env.TRANSCRIPTION_MODE || 'local') as 'local' | 'api',
    openaiApiKey: process.env.OPENAI_API_KEY,
  },

  whisperx: {
    scriptPath: process.env.WHISPERX_SCRIPT_PATH || './scripts/whisperx_transcribe.py',
    model: process.env.WHISPER_MODEL || 'base',
    language: process.env.WHISPER_LANGUAGE || 'en',
    device: process.env.WHISPER_DEVICE || 'auto',
    computeType: process.env.WHISPER_COMPUTE_TYPE || 'float16',
    batchSize: parseInt(process.env.WHISPER_BATCH_SIZE || '16', 10),
  },

  enhance: {
    scriptPath: process.env.ENHANCE_SCRIPT_PATH || './scripts/enhance_audio.py',
    // Set AUDIO_ENHANCEMENT_ENABLED=false to skip the enhancement pipeline
    enabled: process.env.AUDIO_ENHANCEMENT_ENABLED !== 'false',
  },

  remotion: {
    projectDir: resolve(process.env.REMOTION_PROJECT_DIR || join(process.cwd(), 'remotion-temp')),
    // IMPORTANT: This must match the API's bundles.dir config (set BUNDLE_OUTPUT_DIR in .env)
    bundleOutputDir: resolve(process.env.BUNDLE_OUTPUT_DIR || join(process.cwd(), 'bundles')),
  },
} as const;
