import Redis from 'ioredis';
import { config } from '../config.js';
import { logger } from '../logger.js';

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

export async function publishJobProgress(
  jobId: string,
  progress: number,
  message?: string,
  extras?: Record<string, unknown>,
) {
  await redis.publish(
    `job:${jobId}:progress`,
    JSON.stringify({ jobId, progress, message, ...extras })
  );
}

export async function publishJobComplete(
  jobId: string,
  projectId: string,
  extras?: Record<string, unknown>,
) {
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
  await redis.publish(
    `job:${jobId}:error`,
    JSON.stringify({ jobId, error, ...extras })
  );
}
