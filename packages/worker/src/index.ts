import { Worker } from 'bullmq';
import { logger } from './logger.js';
import { processTranscribeJob, TranscribeJobData } from './processors/transcribe.js';
import { processSvgAnimationJob, SvgAnimationJobData } from './processors/svg-animation/index.js';
import { processPreloadProjectJob, PreloadProjectJobData } from './processors/preload-project.js';
import { processHeadTrackingJob, HeadTrackingJobData } from './processors/head-tracking.js';
import { processGenerateReframeJob } from './processors/generate-reframe.js';
import { processGenerateCaptionStylesJob, GenerateCaptionStylesJobData } from './processors/generate-caption-styles.js';
import { processYouTubeClipJob, YouTubeClipJobData } from './processors/youtube-clip.js';
import { processRenderTemplateJob, RenderTemplateJobData } from './processors/render-template.js';
import { getWorkerId } from './workspace.js';
import { redisConnection } from './utils/redis.js';
import { eq, or, and, lt } from 'drizzle-orm';
import { db, jobs } from './db/index.js';
import { publishJobError } from './services/redis.js';

const connection = redisConnection;

async function main() {
  const workerId = getWorkerId();
  logger.info({ workerId }, 'Starting Viona worker...');

  // Sweep orphaned jobs — if the worker crashed, DB jobs may still be 'processing'
  // or 'pending'. Mark them as failed so the frontend doesn't show a stuck progress bar.
  // Only sweep jobs older than 2 minutes to avoid marking freshly-queued jobs that
  // BullMQ hasn't picked up yet.
  try {
    const cutoff = new Date(Date.now() - 2 * 60 * 1000);
    const orphaned = await db.update(jobs)
      .set({ status: 'failed', error: 'Worker restarted — job was interrupted. You can retry.' })
      .where(and(
        or(eq(jobs.status, 'processing'), eq(jobs.status, 'pending')),
        lt(jobs.createdAt, cutoff),
      ))
      .returning({ id: jobs.id, projectId: jobs.projectId });

    if (orphaned.length > 0) {
      logger.info({ count: orphaned.length, jobIds: orphaned.map(j => j.id) }, 'Marked orphaned jobs as failed on startup');
      // Notify any listening frontends
      for (const j of orphaned) {
        await publishJobError(j.id, 'Worker restarted — job was interrupted. You can retry.');
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to sweep orphaned jobs on startup (non-fatal)');
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
      lockDuration: 10 * 60 * 1000, // 10 minutes — large-v2 on CPU can take a while
      stalledInterval: 5 * 60 * 1000, // Check for stalls every 5 minutes
      maxStalledCount: 2,
    }
  );

  transcribeWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Transcribe job completed');
  });

  transcribeWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Transcribe job failed');
  });

  // SVG Animation worker - converts images to animated SVG compositions
  const svgAnimationWorker = new Worker<SvgAnimationJobData>(
    'svg-animation',
    async (job) => {
      logger.info({ jobId: job.id, projectId: job.data.projectId }, 'Processing svg-animation job');
      await processSvgAnimationJob(job);
    },
    {
      connection,
      concurrency: 1, // One at a time (AI + render intensive)
    }
  );

  svgAnimationWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'SVG-animation job completed');
  });

  svgAnimationWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'SVG-animation job failed');
  });

  // Preload project worker - warms up workspace when editor opens
  const preloadProjectWorker = new Worker<PreloadProjectJobData>(
    'preload-project',
    async (job) => {
      logger.info({ jobId: job.id, projectId: job.data.projectId }, 'Processing preload-project job');
      await processPreloadProjectJob(job);
    },
    {
      connection,
      concurrency: 2, // Can preload multiple projects in parallel
    }
  );

  preloadProjectWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Preload-project job completed');
  });

  preloadProjectWorker.on('failed', (job, err) => {
    // Preload failures are non-critical
    logger.warn({ jobId: job?.id, err }, 'Preload-project job failed (non-critical)');
  });

  // Head tracking worker — ML speaker detection
  const headTrackingWorker = new Worker<HeadTrackingJobData>(
    'head-tracking',
    async (job) => {
      logger.info({ jobId: job.id, projectId: job.data.projectId }, 'Processing head-tracking job');
      await processHeadTrackingJob(job);
    },
    {
      connection,
      concurrency: 1,
    }
  );

  headTrackingWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Head-tracking job completed');
  });

  headTrackingWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Head-tracking job failed');
  });

  // Generate reframe worker — auto-queued by head-tracking completion
  const generateReframeWorker = new Worker(
    'generate-reframe',
    async (job) => {
      logger.info({ jobId: job.id }, 'Processing generate-reframe job');
      await processGenerateReframeJob(job);
    },
    {
      connection,
      concurrency: 1,
    }
  );

  generateReframeWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Generate-reframe job completed');
  });

  generateReframeWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Generate-reframe job failed');
  });

  // Generate caption styles worker — AI-powered per-caption styling
  const generateCaptionStylesWorker = new Worker<GenerateCaptionStylesJobData>(
    'generate-caption-styles',
    async (job) => {
      logger.info({ jobId: job.id, projectId: job.data.projectId }, 'Processing generate-caption-styles job');
      await processGenerateCaptionStylesJob(job);
    },
    {
      connection,
      concurrency: 2,
    }
  );

  generateCaptionStylesWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Generate-caption-styles job completed');
  });

  generateCaptionStylesWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Generate-caption-styles job failed');
  });

  // YouTube clip extraction worker
  const youtubeClipWorker = new Worker<YouTubeClipJobData>(
    'youtube-clip',
    async (job) => {
      logger.info({ jobId: job.id, url: job.data.url }, 'Processing youtube-clip job');
      return await processYouTubeClipJob(job);
    },
    {
      connection,
      concurrency: 2, // Can process multiple clips in parallel
      lockDuration: 10 * 60 * 1000, // 10 minutes
    }
  );

  youtubeClipWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'YouTube-clip job completed');
  });

  youtubeClipWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'YouTube-clip job failed');
  });

  // Render template worker — renders templates with custom props to MP4
  const renderTemplateWorker = new Worker<RenderTemplateJobData>(
    'render-template',
    async (job) => {
      logger.info({ jobId: job.id, exportId: job.data.exportId }, 'Processing render-template job');
      await processRenderTemplateJob(job);
    },
    {
      connection,
      concurrency: 2,
      lockDuration: 5 * 60 * 1000, // 5 minutes
      stalledInterval: 2 * 60 * 1000,
      maxStalledCount: 2,
    }
  );

  renderTemplateWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Render-template job completed');
  });

  renderTemplateWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Render-template job failed');
  });

  logger.info('Worker started, waiting for jobs...');

  // Graceful shutdown — close all workers in parallel, waiting for in-progress
  // jobs to finish. This prevents stalled jobs on deploys/restarts.
  const allWorkers = [
    transcribeWorker,
    svgAnimationWorker, preloadProjectWorker,
    headTrackingWorker, generateReframeWorker, generateCaptionStylesWorker,
    youtubeClipWorker, renderTemplateWorker,
  ];

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      logger.warn({ signal }, 'Shutdown already in progress, ignoring duplicate signal');
      return;
    }
    shuttingDown = true;

    logger.info({ signal }, 'Received shutdown signal, closing workers...');

    // Give workers 25s to finish (Kubernetes default grace period is 30s)
    const timeout = setTimeout(() => {
      logger.error('Shutdown timeout exceeded (25s), forcing exit');
      process.exit(1);
    }, 25_000);

    await Promise.allSettled(allWorkers.map(w => w.close()));
    clearTimeout(timeout);
    logger.info('All workers closed');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Worker failed to start');
  process.exit(1);
});
