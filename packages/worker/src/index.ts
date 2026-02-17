import { Worker } from 'bullmq';
import { config } from './config.js';
import { logger } from './logger.js';
import { processTranscribeJob, TranscribeJobData } from './processors/transcribe.js';
import { processRenderJob, RenderJobData } from './processors/render.js';
import { processEnhanceAudioJob, EnhanceAudioJobData } from './processors/enhance-audio.js';
import { processGenerateVisualsJob, GenerateVisualsJobData, validateEnvironment } from './processors/generate-visuals.js';
import { processEditVisualsJob, EditVisualsJobData } from './processors/edit-visuals.js';
import { processSvgAnimationJob, SvgAnimationJobData } from './processors/svg-animation.js';
import { processPreloadProjectJob, PreloadProjectJobData } from './processors/preload-project.js';
import { processPlanVisualsJob, PlanVisualsJobData } from './processors/plan-visuals.js';
import { initializeWorkspace, getWorkerId } from './workspace.js';
import { ensureTemplate } from './utils/template.js';

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
      concurrency: 1,
      lockDuration: 5 * 60 * 1000,
      stalledInterval: 30_000,
      maxStalledCount: 2,
      settings: {
        // Jittered exponential backoff: base * 2^attempt + random jitter (0-2s)
        backoffStrategy: (attemptsMade: number) => {
          const base = Math.min(5000 * Math.pow(2, attemptsMade), 30000);
          const jitter = Math.random() * 2000;
          return base + jitter;
        },
      },
    }
  );

  generateVisualsWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Generate-visuals job completed');
  });

  generateVisualsWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Generate-visuals job failed');
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
      lockDuration: 5 * 60 * 1000,
      stalledInterval: 30_000,
      maxStalledCount: 2,
      settings: {
        backoffStrategy: (attemptsMade: number) => {
          const base = Math.min(5000 * Math.pow(2, attemptsMade), 30000);
          const jitter = Math.random() * 2000;
          return base + jitter;
        },
      },
    }
  );

  planVisualsWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Plan-visuals job completed');
  });

  planVisualsWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Plan-visuals job failed');
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
      lockDuration: 5 * 60 * 1000,
      stalledInterval: 30_000,
      maxStalledCount: 2,
      settings: {
        backoffStrategy: (attemptsMade: number) => {
          const base = Math.min(5000 * Math.pow(2, attemptsMade), 30000);
          const jitter = Math.random() * 2000;
          return base + jitter;
        },
      },
    }
  );

  editVisualsWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Edit-visuals job completed');
  });

  editVisualsWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Edit-visuals job failed');
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

  logger.info('Worker started, waiting for jobs...');

  // Graceful shutdown — close all workers in parallel, waiting for in-progress
  // jobs to finish. This prevents stalled jobs on deploys/restarts.
  const allWorkers = [
    transcribeWorker, renderWorker, enhanceAudioWorker,
    generateVisualsWorker, planVisualsWorker, editVisualsWorker,
    svgAnimationWorker, preloadProjectWorker,
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
