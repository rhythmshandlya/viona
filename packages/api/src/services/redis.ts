import Redis from 'ioredis';
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

export async function publishJobProgress(
  jobId: string,
  progress: number,
  message?: string
) {
  await redis.publish(
    CHANNELS.jobProgress(jobId),
    JSON.stringify({ jobId, progress, message })
  );
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
