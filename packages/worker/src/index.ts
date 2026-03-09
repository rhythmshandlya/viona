import { Worker } from 'bullmq';
import { config } from './config.js';
import { logger } from './logger.js';
import { processTranscribeJob, TranscribeJobData } from './processors/transcribe.js';
import { processRenderJob, RenderJobData } from './processors/render/index.js';

import { processGenerateVisualsJob, GenerateVisualsJobData, validateEnvironment } from './processors/generate-visuals.js';
import { processEditVisualsJob, EditVisualsJobData } from './processors/edit-visuals.js';
import { processSvgAnimationJob, SvgAnimationJobData } from './processors/svg-animation.js';
import { processPreloadProjectJob, PreloadProjectJobData } from './processors/preload-project.js';
import { processPlanVisualsJob, PlanVisualsJobData } from './processors/plan-visuals.js';
import { processHeadTrackingJob, HeadTrackingJobData } from './processors/head-tracking.js';
import { processGenerateReframeJob } from './processors/generate-reframe.js';
import { processGenerateCaptionStylesJob, GenerateCaptionStylesJobData } from './processors/generate-caption-styles.js';
import { processYouTubeClipJob, YouTubeClipJobData } from './processors/youtube-clip.js';
import { processSegmentation, SegmentationJobData } from './processors/segmentation.js';
import { initializeWorkspace, getWorkerId } from './workspace.js';
import { ensureTemplate } from './utils/template.js';
import { redisConnection } from './utils/redis.js';
import { eq, or, and, lt } from 'drizzle-orm';
import { db, jobs } from './db/index.js';
import { publishJobError } from './services/redis.js';

const connection = redisConnection;

async function main() {
  const workerId = getWorkerId();
  logger.info({ workerId }, 'Starting Viona worker...');

  // Auth: Claude Agent SDK reads CLAUDE_CODE_OAUTH_TOKEN from env (long-lived token from `claude setup-token`)
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    logger.warn('CLAUDE_CODE_OAUTH_TOKEN not set — visual generation will not work in production. Run `claude setup-token` to generate one.');
  }

  // Ensure remotion template is available (downloads from S3 in prod)
  logger.info({ workerId }, 'Ensuring remotion template is available...');
  try {
    await ensureTemplate();
    logger.info({ workerId }, 'Template ready');
  } catch (err) {
    logger.error({ err, workerId }, 'Failed to ensure template - visual generation will not work');
  }

  // Initialize workspace for Claude Code generator
  logger.info({ workerId }, 'Initializing workspace for Claude Code generator...');
  try {
    await initializeWorkspace();
    logger.info({ workerId }, 'Workspace initialized successfully');
  } catch (err) {
    logger.error({ err, workerId }, 'Failed to initialize workspace - visual generation will not work');
  }

  // Validate environment for visual generation (Python + Claude Agent SDK)
  const envCheck = await validateEnvironment();
  if (!envCheck.valid) {
    logger.warn({ error: envCheck.error }, 'Visual generation environment not configured - generate-visuals jobs will fail');
  } else {
    logger.info('Visual generation environment validated');
  }

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

  // Render worker — lockDuration must be long enough for Remotion SSR renders
  // (can take 2+ minutes). Default 30s causes BullMQ to declare job as stalled.
  const renderWorker = new Worker<RenderJobData>(
    'render',
    async (job) => {
      logger.info({ jobId: job.id, projectId: job.data.projectId }, 'Processing render job');
      await processRenderJob(job);
    },
    {
      connection,
      concurrency: 2,
      lockDuration: 10 * 60 * 1000, // 10 minutes — renders can take a while
      stalledInterval: 5 * 60 * 1000, // Check for stalls every 5 minutes
    }
  );

  renderWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Render job completed');
  });

  renderWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Render job failed');
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
      concurrency: 1, // Must be 1 — workspace is shared (Root.tsx, index.ts, public/assets)
      lockDuration: 90 * 60 * 1000,   // 90 min — matches subprocess timeout
      stalledInterval: 10 * 60 * 1000, // Check every 10 min (generous buffer for lock extender)
      maxStalledCount: 0,              // Immediately fail stalled jobs (no re-queue — generation is too expensive to retry blindly)
    }
  );

  generateVisualsWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Generate-visuals job completed');
  });

  generateVisualsWorker.on('failed', async (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Generate-visuals job failed');
    // Ensure DB is updated even if processor catch block didn't run (e.g. OOM kill)
    if (job?.data?.jobId) {
      try {
        await db.update(jobs)
          .set({ status: 'failed', error: err?.message || 'Generation failed' })
          .where(eq(jobs.id, job.data.jobId));
        await publishJobError(job.data.jobId, err?.message || 'Generation failed');
      } catch { /* best-effort */ }
    }
  });

  // Plan visuals worker - Director phase only (creates scene plan for approval)
  const planVisualsWorker = new Worker<PlanVisualsJobData>(
    'plan-visuals',
    async (job) => {
      logger.info({ jobId: job.id, projectId: job.data.projectId }, 'Processing plan-visuals job');
      await processPlanVisualsJob(job);
    },
    {
      connection,
      concurrency: 1,
      lockDuration: 15 * 60 * 1000,  // 15 min — Director runs 5-12 min
      stalledInterval: 10 * 60 * 1000,
      maxStalledCount: 0,              // Immediately fail stalled jobs (no re-queue)
    }
  );

  planVisualsWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Plan-visuals job completed');
  });

  planVisualsWorker.on('failed', async (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Plan-visuals job failed');
    if (job?.data?.jobId) {
      try {
        await db.update(jobs)
          .set({ status: 'failed', error: err?.message || 'Planning failed' })
          .where(eq(jobs.id, job.data.jobId));
        await publishJobError(job.data.jobId, err?.message || 'Planning failed');
      } catch { /* best-effort */ }
    }
  });

  // Edit visuals worker - for continuing to edit existing compositions
  const editVisualsWorker = new Worker<EditVisualsJobData>(
    'edit-visuals',
    async (job) => {
      logger.info({ jobId: job.id, projectId: job.data.projectId, prompt: job.data.prompt.slice(0, 50) }, 'Processing edit-visuals job');
      await processEditVisualsJob(job);
    },
    {
      connection,
      concurrency: 1,
      lockDuration: 20 * 60 * 1000,  // 20 min — edit jobs run 5-15 min
      stalledInterval: 10 * 60 * 1000,
      maxStalledCount: 0,              // Immediately fail stalled jobs (no re-queue)
    }
  );

  editVisualsWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Edit-visuals job completed');
  });

  editVisualsWorker.on('failed', async (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Edit-visuals job failed');
    if (job?.data?.jobId) {
      try {
        await db.update(jobs)
          .set({ status: 'failed', error: err?.message || 'Edit failed' })
          .where(eq(jobs.id, job.data.jobId));
        await publishJobError(job.data.jobId, err?.message || 'Edit failed');
      } catch { /* best-effort */ }
    }
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

  // Segmentation worker — extracts speaker from video using SAM2
  const segmentationWorker = new Worker<SegmentationJobData>(
    'segmentation',
    async (job) => {
      logger.info({ jobId: job.id, projectId: job.data.projectId }, 'Processing segmentation job');
      await processSegmentation(job);
    },
    {
      connection,
      concurrency: 1, // GPU-intensive, process one at a time
      lockDuration: 30 * 60 * 1000, // 30 minutes — SAM2 can be slow on long videos
      stalledInterval: 10 * 60 * 1000, // Check for stalls every 10 minutes
      maxStalledCount: 2,
    }
  );

  segmentationWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Segmentation job completed');
  });

  segmentationWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Segmentation job failed');
  });

  logger.info('Worker started, waiting for jobs...');

  // Graceful shutdown — close all workers in parallel, waiting for in-progress
  // jobs to finish. This prevents stalled jobs on deploys/restarts.
  const allWorkers = [
    transcribeWorker, renderWorker,
    generateVisualsWorker, planVisualsWorker, editVisualsWorker,
    svgAnimationWorker, preloadProjectWorker,
    headTrackingWorker, generateReframeWorker, generateCaptionStylesWorker,
    youtubeClipWorker, segmentationWorker,
  ];

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal, closing workers...');
    await Promise.allSettled(allWorkers.map(w => w.close()));
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
