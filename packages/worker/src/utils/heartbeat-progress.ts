import { publishJobProgress } from '../services/redis.js';

/**
 * Emit synthetic progress during opaque subprocess phases using an exponential
 * decay curve. Progress approaches `ceilingPercent` but never reaches it —
 * the caller should emit the real value after the phase completes.
 */
export function startHeartbeatProgress(
  jobId: string,
  startPercent: number,
  ceilingPercent: number,
  estimatedMs: number,
) {
  const startTime = Date.now();

  const interval = setInterval(async () => {
    const elapsed = Date.now() - startTime;
    // Exponential decay: 1 - e^(-t/τ) approaches 1 asymptotically
    const ratio = 1 - Math.exp(-elapsed / (estimatedMs * 0.7));
    // Approach ceiling - 2 so we never quite reach it
    const percent = Math.round(startPercent + ratio * (ceilingPercent - startPercent - 2));

    await publishJobProgress(jobId, percent, 'Processing...').catch(() => {});
  }, 5_000); // every 5 seconds

  return {
    stop: () => clearInterval(interval),
  };
}
