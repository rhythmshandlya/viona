import { publishJobProgress } from '../services/redis.js';

/**
 * Emit synthetic progress during opaque subprocess phases using an exponential
 * decay curve. Progress approaches `ceilingPercent` but never reaches it —
 * the caller should emit the real value after the phase completes.
 *
 * After reaching 80% of the range, switches from exponential decay to a slow
 * linear crawl (0.5% per tick) to prevent the "stuck at 81%" visual freeze
 * when a job takes longer than estimated.
 */
export function startHeartbeatProgress(
  jobId: string,
  startPercent: number,
  ceilingPercent: number,
  estimatedMs: number,
) {
  const startTime = Date.now();
  const range = ceilingPercent - startPercent - 2;
  // 80% of the range — switch to linear crawl above this
  const linearThreshold = startPercent + range * 0.8;
  let lastPercent = startPercent;

  // Track unrounded crawl position to avoid Math.round killing 0.5 increments
  let linearPosition = 0;

  const interval = setInterval(async () => {
    const elapsed = Date.now() - startTime;
    // Exponential decay: 1 - e^(-t/τ) approaches 1 asymptotically
    const ratio = 1 - Math.exp(-elapsed / (estimatedMs * 0.7));
    const expPercent = Math.round(startPercent + ratio * range);

    let percent: number;
    if (expPercent >= linearThreshold) {
      // Slow linear crawl: +0.3% per tick (unrounded), never exceeding ceiling - 2.
      // Using unrounded accumulator so progress always increases after rounding.
      if (linearPosition === 0) linearPosition = expPercent;
      linearPosition = Math.min(linearPosition + 0.3, ceilingPercent - 2);
      percent = Math.round(linearPosition);
    } else {
      percent = expPercent;
    }

    lastPercent = percent;

    await publishJobProgress(jobId, percent, 'Processing...').catch(() => {});
  }, 5_000); // every 5 seconds

  return {
    stop: () => clearInterval(interval),
  };
}
