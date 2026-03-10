import Redis from 'ioredis';
import { eq } from 'drizzle-orm';
import { config } from '../config.js';

export const redis = new Redis(config.redis.url);

// Subscriber client - disable ready check to avoid "Connection in subscriber mode" error
export const redisSub = new Redis(config.redis.url, {
  enableReadyCheck: false,
});

// Pub/Sub channels
export const CHANNELS = {
  jobProgress: (jobId: string) => `job:${jobId}:progress`,
  jobComplete: (jobId: string) => `job:${jobId}:complete`,
  jobError: (jobId: string) => `job:${jobId}:error`,
  projectUpdated: (projectId: string) => `project:${projectId}:updated`,
} as const;

// Lazy import to avoid circular dependency (redis <- db <- schema <- redis)
let _jobs: any = null;
let _db: any = null;
async function getDb() {
  if (!_db) {
    const mod = await import('../db/index.js');
    _db = mod.db;
    _jobs = mod.jobs;
  }
  return { db: _db, jobs: _jobs };
}

export async function publishJobProgress(
  jobId: string,
  progress: number,
  message?: string
) {
  // Publish to Redis for real-time WebSocket delivery
  await redis.publish(
    CHANNELS.jobProgress(jobId),
    JSON.stringify({ jobId, progress, message })
  );

  // Also persist to DB so pollJobProgress (DB-based) and loadHistory see updates
  try {
    const { db, jobs } = await getDb();
    await db.update(jobs)
      .set({ progress, progressMessage: message ?? null })
      .where(eq(jobs.id, jobId));
  } catch {
    // Non-critical — Redis pub/sub still delivers real-time updates
  }
}

export async function publishJobComplete(jobId: string, projectId: string) {
  await redis.publish(
    CHANNELS.jobComplete(jobId),
    JSON.stringify({ jobId, projectId })
  );
}

export async function publishJobError(jobId: string, error: string) {
  await redis.publish(
    CHANNELS.jobError(jobId),
    JSON.stringify({ jobId, error })
  );
}

// --- Progress Store Redis helpers ---

/** Get all hash fields (HGETALL) */
export async function redisHGetAll(key: string): Promise<Record<string, string> | null> {
  const result = await redis.hgetall(key);
  return Object.keys(result).length > 0 ? result : null;
}

/** Read full list (LRANGE) */
export async function redisLRange(key: string): Promise<string[]> {
  return redis.lrange(key, 0, -1);
}

/**
 * Subscribe to a Redis channel.
 * Returns an unsubscribe function.
 * Uses a dedicated subscriber client per subscription.
 */
export function redisSubscribe(
  channel: string,
  callback: (message: string) => void,
): () => void {
  const sub = new Redis(config.redis.url, { enableReadyCheck: false });

  sub.subscribe(channel, (err: Error | null) => {
    if (err) console.error(`Failed to subscribe to ${channel}:`, err);
  });

  sub.on('message', (_ch: string, message: string) => {
    callback(message);
  });

  return () => {
    sub.unsubscribe(channel);
    sub.disconnect();
  };
}
