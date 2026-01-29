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
  },

  remotion: {
    projectDir: process.env.REMOTION_PROJECT_DIR || 'C:/Users/armaa/test',
    // IMPORTANT: This must match the API's bundles.dir config (set BUNDLE_OUTPUT_DIR in .env)
    bundleOutputDir: process.env.BUNDLE_OUTPUT_DIR || 'C:/Users/armaa/Documents/cllipify/bundles',
  },

  openHands: {
    // Python path for OpenHands (requires Python 3.12+)
    pythonPath: process.env.OPENHANDS_PYTHON_PATH || 'python',
    // Use Docker sandbox for isolation (recommended for production)
    useDocker: process.env.OPENHANDS_USE_DOCKER === 'true',
    // Docker image with Python, Node.js, Chromium, Remotion
    dockerImage: process.env.OPENHANDS_DOCKER_IMAGE || 'clipify-remotion-sandbox:latest',
    // Container resource limits
    memoryLimit: process.env.OPENHANDS_MEMORY_LIMIT || '4g',
    cpuLimit: process.env.OPENHANDS_CPU_LIMIT || '2',
  },
} as const;
