import 'dotenv/config';
import { join } from 'path';
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

  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    accessKey: process.env.MINIO_ACCESS_KEY || 'reelify',
    secretKey: process.env.MINIO_SECRET_KEY || 'reelify123',
    useSSL: process.env.MINIO_USE_SSL === 'true',
    buckets: {
      uploads: process.env.MINIO_BUCKET_UPLOADS || 'uploads',
      outputs: process.env.MINIO_BUCKET_OUTPUTS || 'outputs',
    },
  },

  pythonPath: process.env.PYTHON_PATH || 'python',

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
    // Set DISABLE_AUDIO_ENHANCEMENT=true to skip the enhancement pipeline entirely
    disabled: process.env.DISABLE_AUDIO_ENHANCEMENT === 'true',
  },

  remotion: {
    projectDir: process.env.REMOTION_PROJECT_DIR || join(process.cwd(), 'remotion-project'),
    // IMPORTANT: This must match the API's bundles.dir config (set BUNDLE_OUTPUT_DIR in .env)
    bundleOutputDir: process.env.BUNDLE_OUTPUT_DIR || join(process.cwd(), '..', '..', 'bundles'),
  },
} as const;
