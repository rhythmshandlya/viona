import 'dotenv/config';
import { join, resolve } from 'path';
import { hostname } from 'os';

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
    // Template directory - downloaded from S3 on startup
    templatePath: process.env.WORKSPACE_TEMPLATE_PATH || (
      process.env.RAILWAY_ENVIRONMENT ? '/tmp/template' : join(process.cwd(), 'remotion-template')
    ),
    // Template name in S3 storage
    templateName: process.env.TEMPLATE_NAME || 'remotion-template.zip',
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

  // Storage configuration is now handled by @reelify/shared StorageService
  // This config is kept for backwards compatibility with existing code
  // Use: import { getStorage } from '@reelify/shared/storage';
  storage: (() => {
    // Railway Bucket vars take precedence (auto-injected in prod)
    const endpoint = process.env.BUCKET_ENDPOINT || process.env.S3_ENDPOINT || 'localhost';
    // Internal Railway connections (*.railway.internal) use HTTP, not HTTPS
    const isInternalConnection = endpoint.includes('.railway.internal');
    return {
      endpoint,
      port: process.env.BUCKET_PORT ? parseInt(process.env.BUCKET_PORT, 10) : parseInt(process.env.S3_PORT || '9000', 10),
      accessKey: process.env.BUCKET_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY || 'reelify',
      secretKey: process.env.BUCKET_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY || 'reelify123',
      useSSL: !isInternalConnection && (!!process.env.BUCKET_ENDPOINT || process.env.S3_USE_SSL === 'true'),
      bucket: process.env.BUCKET_NAME || process.env.S3_BUCKET || 'cllipify',
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
    // Inverse of enabled for backwards compatibility
    get disabled() {
      return !this.enabled;
    },
  },

  freepik: {
    apiKey: process.env.FREEPIK_API_KEY || '',
  },

  remotion: {
    projectDir: resolve(process.env.REMOTION_PROJECT_DIR || join(process.cwd(), 'remotion-temp')),
    // IMPORTANT: In production, use /tmp/bundles (ephemeral but uploaded to S3)
    // In development, use local bundles directory
    bundleOutputDir: resolve(process.env.BUNDLE_OUTPUT_DIR || (
      process.env.RAILWAY_ENVIRONMENT ? '/tmp/bundles' : join(process.cwd(), 'bundles')
    )),
  },

  // Python path for running Python scripts (transcription, enhancement)
  pythonPath: process.env.PYTHON_PATH || 'python3',
} as const;
