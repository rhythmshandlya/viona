import { Worker } from 'bullmq';
import { config } from './config.js';
import { logger } from './logger.js';
import { processTranscribeJob, TranscribeJobData } from './processors/transcribe.js';
import { processRenderJob, RenderJobData } from './processors/render.js';
import { processEnhanceAudioJob, EnhanceAudioJobData } from './processors/enhance-audio.js';
import { processGenerateVisualsJob, GenerateVisualsJobData, validateEnvironment } from './processors/generate-visuals.js';

// Parse Redis URL for BullMQ connection
function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
  };
}

const connection = parseRedisUrl(config.redis.url);

async function main() {
  logger.info('Starting Reelify worker...');

  // Validate environment for visual generation (Python + OpenHands)
  const envCheck = await validateEnvironment();
  if (!envCheck.valid) {
    logger.warn({ error: envCheck.error }, 'Visual generation environment not configured - generate-visuals jobs will fail');
  } else {
    logger.info('Visual generation environment validated');
  }

  // Transcribe worker
  const transcribeWorker = new Worker<TranscribeJobData>(
    'transcribe',
    async (job) => {
      logger.info({ jobId: job.id, projectId: job.data.projectId }, 'Processing transcribe job');
      await processTranscribeJob(job);
    },
    {
      connection,
      concurrency: 1, // Process one transcription at a time (CPU/GPU intensive)
    }
  );

  transcribeWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Transcribe job completed');
  });

  transcribeWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Transcribe job failed');
  });

  // Render worker
  const renderWorker = new Worker<RenderJobData>(
    'render',
    async (job) => {
      logger.info({ jobId: job.id, projectId: job.data.projectId }, 'Processing render job');
      await processRenderJob(job);
    },
    {
      connection,
      concurrency: 1, // Process one render at a time (CPU/GPU intensive)
    }
  );

  renderWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Render job completed');
  });

  renderWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Render job failed');
  });

  // Enhance audio worker
  const enhanceAudioWorker = new Worker<EnhanceAudioJobData>(
    'enhance-audio',
    async (job) => {
      logger.info({ jobId: job.id, projectId: job.data.projectId }, 'Processing enhance-audio job');
      await processEnhanceAudioJob(job);
    },
    {
      connection,
      concurrency: 1,
    }
  );

  enhanceAudioWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Enhance-audio job completed');
  });

  enhanceAudioWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Enhance-audio job failed');
  });

  // Generate visuals worker
  const generateVisualsWorker = new Worker<GenerateVisualsJobData>(
    'generate-visuals',
    async (job) => {
      logger.info({ jobId: job.id, projectId: job.data.projectId }, 'Processing generate-visuals job');
      await processGenerateVisualsJob(job);
    },
    {
      connection,
      concurrency: 1, // One at a time (AI + render intensive)
    }
  );

  generateVisualsWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Generate-visuals job completed');
  });

  generateVisualsWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Generate-visuals job failed');
  });

  logger.info('Worker started, waiting for jobs...');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down worker...');
    await transcribeWorker.close();
    await renderWorker.close();
    await enhanceAudioWorker.close();
    await generateVisualsWorker.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error({ err }, 'Worker failed to start');
  process.exit(1);
});
