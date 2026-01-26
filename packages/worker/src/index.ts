import { Worker } from 'bullmq';
import { config } from './config.js';
import { processTranscribeJob, TranscribeJobData } from './processors/transcribe.js';
import { processRenderJob, RenderJobData } from './processors/render.js';

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
  console.log('Starting Reelify worker...');

  // Transcribe worker
  const transcribeWorker = new Worker<TranscribeJobData>(
    'transcribe',
    async (job) => {
      console.log(`Processing transcribe job ${job.id} for project ${job.data.projectId}`);
      await processTranscribeJob(job);
    },
    {
      connection,
      concurrency: 1, // Process one transcription at a time (CPU/GPU intensive)
    }
  );

  transcribeWorker.on('completed', (job) => {
    console.log(`Transcribe job ${job.id} completed`);
  });

  transcribeWorker.on('failed', (job, err) => {
    console.error(`Transcribe job ${job?.id} failed:`, err);
  });

  // Render worker
  const renderWorker = new Worker<RenderJobData>(
    'render',
    async (job) => {
      console.log(`Processing render job ${job.id} for project ${job.data.projectId}`);
      await processRenderJob(job);
    },
    {
      connection,
      concurrency: 1, // Process one render at a time (CPU/GPU intensive)
    }
  );

  renderWorker.on('completed', (job) => {
    console.log(`Render job ${job.id} completed`);
  });

  renderWorker.on('failed', (job, err) => {
    console.error(`Render job ${job?.id} failed:`, err);
  });

  console.log('Worker started, waiting for jobs...');

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down worker...');
    await transcribeWorker.close();
    await renderWorker.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});
