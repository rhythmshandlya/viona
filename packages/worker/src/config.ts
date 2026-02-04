import 'dotenv/config';
import { join } from 'path';

export const config = {
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
    pythonPath: process.env.ENHANCE_PYTHON_PATH || './venv-enhance/bin/python',
  },

  remotion: {
    projectDir: process.env.REMOTION_PROJECT_DIR || './remotion-temp',
    // IMPORTANT: This must match the API's bundles.dir config (set BUNDLE_OUTPUT_DIR in .env)
    bundleOutputDir: process.env.BUNDLE_OUTPUT_DIR || './bundles',
  },

  // Visual generation agent: 'openhands' or 'opencode'
  visualAgent: (process.env.VISUAL_AGENT || 'openhands') as 'openhands' | 'opencode',

  openHands: {
    // Python path for OpenHands (requires Python 3.12+)
    pythonPath: process.env.OPENHANDS_PYTHON_PATH || 'python',
    // Use Docker sandbox for isolation (recommended for production)
    useDocker: process.env.OPENHANDS_USE_DOCKER === 'true',
    // Docker image with Python, Node.js, Chromium, Remotion
    dockerImage: process.env.OPENHANDS_DOCKER_IMAGE || 'clipify-openhands-sandbox:latest',
    // Container resource limits
    memoryLimit: process.env.OPENHANDS_MEMORY_LIMIT || '4g',
    cpuLimit: process.env.OPENHANDS_CPU_LIMIT || '2',
  },

  openCode: {
    // OpenCode server port (if running separately)
    serverPort: parseInt(process.env.OPENCODE_SERVER_PORT || '4096', 10),
  },

  llm: {
    // LLM provider: 'claude-max' (via local proxy) or 'openrouter' (default)
    provider: (process.env.LLM_PROVIDER || 'openrouter') as 'claude-max' | 'openrouter',

    // Claude Max settings (requires claude-max-api-proxy running locally)
    claudeMax: {
      proxyUrl: process.env.CLAUDE_MAX_PROXY_URL || 'http://localhost:3456/v1',
      model: process.env.CLAUDE_MAX_MODEL || 'claude-opus-4-5-20251101',
      modelFlash: process.env.CLAUDE_MAX_MODEL_FLASH || 'claude-haiku-4-5-20251001',
      apiKey: 'not-needed', // Proxy uses Claude Max subscription
    },

    // OpenRouter settings
    openrouter: {
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      // Use Gemini 3 Flash for all tasks - 1M+ context handles large skill files efficiently
      model: 'google/gemini-3-flash-preview',
      modelFlash: 'google/gemini-3-flash-preview',
    },

    // Shared settings
    temperature: 1.0, // Required for Gemini 3.x, fine for Claude
  },
} as const;
