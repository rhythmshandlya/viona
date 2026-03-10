import type { ProgressState, HealthState, ActivityEvent } from '@viona/shared';
import { apiProgressStore } from './progress-store.js';

interface ProgressRelayConfig {
  jobId: string;
  sendSSE: (event: string, data: unknown) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
  jobType?: string;
  initialPercent?: number;
}

interface RelayResult {
  status: 'complete' | 'failed' | 'timeout' | 'aborted';
}

/**
 * Subscribe to Redis-based progress and relay to SSE stream.
 * Replaces the old DB-polling pollJobProgress loop.
 */
export function createProgressRelay(config: ProgressRelayConfig): Promise<RelayResult> {
  const {
    jobId,
    sendSSE,
    signal,
    timeoutMs = 50 * 60 * 1000,
    jobType,
  } = config;

  let highWaterMark = config.initialPercent ?? 0;

  return new Promise<RelayResult>((resolve) => {
    let resolved = false;
    const cleanups: Array<() => void> = [];

    function finish(result: RelayResult) {
      if (resolved) return;
      resolved = true;
      for (const fn of cleanups) fn();
      resolve(result);
    }

    // Subscribe to progress updates
    const unsubProgress = apiProgressStore.subscribe(
      jobId,
      (state: ProgressState) => {
        const percent = Math.max(state.percent, highWaterMark);
        highWaterMark = percent;

        sendSSE('progress', {
          percent,
          message: state.message,
          phase: state.phase,
          phaseName: state.phaseName,
          jobId,
          jobType,
          meta: state.meta,
        });

        if (state.phase === 'done' || percent >= 100) {
          sendSSE('progress', { percent: 100, message: 'Done!', jobId });
          finish({ status: 'complete' });
        }
        if (state.phase === 'error') {
          sendSSE('progress', {
            percent,
            message: state.message || 'Generation failed',
            error: true,
            jobId,
          });
          finish({ status: 'failed' });
        }
      },
      (event: ActivityEvent) => {
        sendSSE('activity', event);
      },
    );
    cleanups.push(unsubProgress);

    // Subscribe to health updates
    const unsubHealth = apiProgressStore.subscribeHealth(jobId, (health: HealthState) => {
      sendSSE('health', health);

      if (!health.processAlive && health.retriesUsed >= health.retriesMax) {
        sendSSE('progress', {
          percent: highWaterMark,
          message: 'Generation failed — process crashed and retries exhausted',
          error: true,
          jobId,
        });
        finish({ status: 'failed' });
      }
    });
    cleanups.push(unsubHealth);

    // Safety timeout
    const timer = setTimeout(() => {
      sendSSE('progress', {
        percent: highWaterMark,
        message: 'Processing is taking longer than expected. The job continues in the background.',
        error: true,
        jobId,
      });
      finish({ status: 'timeout' });
    }, timeoutMs);
    cleanups.push(() => clearTimeout(timer));

    // Abort signal
    if (signal) {
      const onAbort = () => finish({ status: 'aborted' });
      signal.addEventListener('abort', onAbort, { once: true });
      cleanups.push(() => signal.removeEventListener('abort', onAbort));
    }

    // DB backup poll (every 10s — Redis is primary)
    const dbPollInterval = setInterval(async () => {
      try {
        const { db } = await import('../db/index.js');
        const { jobs } = await import('../db/schema.js');
        const { eq } = await import('drizzle-orm');
        const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
        if (!job) return;

        if (job.status === 'complete') {
          sendSSE('progress', { percent: 100, message: 'Done!', jobId });
          finish({ status: 'complete' });
        }
        if (job.status === 'failed') {
          sendSSE('progress', {
            percent: job.progress,
            message: `Failed: ${job.error || 'Unknown error'}`,
            error: true,
            jobId,
          });
          finish({ status: 'failed' });
        }
      } catch {
        // DB unavailable — Redis is primary, this is backup
      }
    }, 10_000);
    cleanups.push(() => clearInterval(dbPollInterval));
  });
}
