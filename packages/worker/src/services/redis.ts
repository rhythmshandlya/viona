import Redis from 'ioredis';
import { eq } from 'drizzle-orm';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { db, jobs } from '../db/index.js';

export const redis = new Redis(config.redis.url);
const subscriber = new Redis(config.redis.url);

// Job cancel handlers
const cancelHandlers = new Map<string, () => void>();

export function registerCancelHandler(jobId: string, handler: () => void): void {
  cancelHandlers.set(jobId, handler);
}

export function unregisterCancelHandler(jobId: string): void {
  cancelHandlers.delete(jobId);
}

// Subscribe to cancel channel
subscriber.subscribe('job:cancel', (err) => {
  if (err) {
    logger.error({ err }, 'Failed to subscribe to job:cancel channel');
  } else {
    logger.info('Subscribed to job:cancel channel');
  }
});

subscriber.on('message', (channel, message) => {
  if (channel === 'job:cancel') {
    try {
      const { jobId } = JSON.parse(message);
      logger.info({ jobId }, 'Received cancel request');
      const handler = cancelHandlers.get(jobId);
      if (handler) {
        handler();
        cancelHandlers.delete(jobId);
      }
    } catch (err) {
      logger.error({ err, message }, 'Failed to parse cancel message');
    }
  }
});

// Cache jobId → projectId so we don't need a DB query per progress event.
// A job's projectId never changes, so this is safe to cache indefinitely.
const jobProjectIdCache = new Map<string, string>();

/**
 * Register a job's projectId in the cache so publishJobProgress can include it
 * in Redis payloads without a DB lookup. Call this once at the start of each processor.
 */
export function setJobProjectId(jobId: string, projectId: string): void {
  jobProjectIdCache.set(jobId, projectId);
}

/**
 * Clear a job's cached projectId (call on job completion/failure).
 */
export function clearJobProjectId(jobId: string): void {
  jobProjectIdCache.delete(jobId);
}

export async function publishJobProgress(
  jobId: string,
  progress: number,
  message?: string,
  extras?: Record<string, unknown>,
) {
  // Update progress in DB so frontend polling can see it
  const meta = extras?.meta as Record<string, unknown> | undefined;
  const truncatedMessage = message && message.length > 500 ? message.slice(0, 497) + '...' : message;
  try {
    await db.update(jobs)
      .set({
        progress,
        ...(truncatedMessage ? { progressMessage: truncatedMessage } : {}),
        ...(meta ? { progressMeta: meta } : {}),
      })
      .where(eq(jobs.id, jobId));
  } catch (err) {
    logger.warn({ jobId, progress, err }, 'Failed to update job progress in DB');
  }

  // Include projectId so the WebSocket handler can match by project
  // (not just by subscribed jobId). This makes progress delivery reliable
  // even when WebSocket connections reconnect and lose their subscriptions.
  const projectId = jobProjectIdCache.get(jobId);

  await redis.publish(
    `job:${jobId}:progress`,
    JSON.stringify({ jobId, projectId, progress, message, ...extras })
  );
}

export async function publishJobComplete(
  jobId: string,
  projectId: string,
  extras?: Record<string, unknown>,
) {
  clearJobProjectId(jobId);
  await redis.publish(
    `job:${jobId}:complete`,
    JSON.stringify({ jobId, projectId, ...extras })
  );
}

export async function publishJobError(
  jobId: string,
  error: string,
  extras?: Record<string, unknown>,
) {
  clearJobProjectId(jobId);
  await redis.publish(
    `job:${jobId}:error`,
    JSON.stringify({ jobId, error, ...extras })
  );
}

// --- Progress Store Redis helpers ---

/** Set a hash field set (HSET) */
export async function redisHSet(key: string, data: Record<string, string>): Promise<void> {
  await redis.hset(key, data);
}

/** Get all hash fields (HGETALL) */
export async function redisHGetAll(key: string): Promise<Record<string, string> | null> {
  const result = await redis.hgetall(key);
  return Object.keys(result).length > 0 ? result : null;
}

/** Append to a capped list (RPUSH + LTRIM) */
export async function redisRPush(key: string, value: string, maxLen: number = 100): Promise<void> {
  await redis.rpush(key, value);
  await redis.ltrim(key, -maxLen, -1);
}

/** Read full list (LRANGE) */
export async function redisLRange(key: string): Promise<string[]> {
  return redis.lrange(key, 0, -1);
}

/** Set TTL on a key */
export async function redisExpire(key: string, seconds: number): Promise<void> {
  await redis.expire(key, seconds);
}
