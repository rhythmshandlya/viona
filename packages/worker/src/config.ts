import 'dotenv/config';

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

  whisperx: {
    pythonPath: process.env.PYTHON_PATH || 'python',
    scriptPath: process.env.WHISPERX_SCRIPT_PATH || './scripts/whisperx_transcribe.py',
    model: process.env.WHISPER_MODEL || 'large-v2',
    language: process.env.WHISPER_LANGUAGE || 'en',
    device: process.env.WHISPER_DEVICE || 'auto',
    computeType: process.env.WHISPER_COMPUTE_TYPE || 'float16',
    batchSize: parseInt(process.env.WHISPER_BATCH_SIZE || '16', 10),
  },
} as const;
