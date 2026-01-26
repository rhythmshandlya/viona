import Redis from 'ioredis';
import { config } from '../config.js';

export const redis = new Redis(config.redis.url);

export async function publishJobProgress(
  jobId: string,
  progress: number,
  message?: string
) {
  await redis.publish(
    `job:${jobId}:progress`,
    JSON.stringify({ jobId, progress, message })
  );
}

export async function publishJobComplete(jobId: string, projectId: string) {
  await redis.publish(
    `job:${jobId}:complete`,
    JSON.stringify({ jobId, projectId })
  );
}

export async function publishJobError(jobId: string, error: string) {
  await redis.publish(
    `job:${jobId}:error`,
    JSON.stringify({ jobId, error })
  );
}
