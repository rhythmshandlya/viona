// packages/worker/src/progress/progress-store.ts

import { eq } from 'drizzle-orm';
import type {
  ProgressState,
  HealthState,
  ActivityEvent,
} from '@viona/shared';
import { PROGRESS_KEYS } from '@viona/shared';
import {
  redis,
  redisHSet,
  redisHGetAll,
  redisRPush,
  redisExpire,
} from '../services/redis.js';
import { db, jobs } from '../db/index.js';
import { logger } from '../logger.js';
import { ProgressBuffer } from './progress-buffer.js';

const TTL_SECONDS = 24 * 60 * 60; // 24 hours
const buffer = new ProgressBuffer(50);

/** High-water mark per job — progress never regresses */
const highWaterMarks = new Map<string, number>();

function serializeState(state: ProgressState): Record<string, string> {
  return {
    percent: String(state.percent),
    message: state.message,
    phase: state.phase,
    phaseName: state.phaseName,
    detail: state.detail ?? '',
    updatedAt: String(state.updatedAt),
    meta: state.meta ? JSON.stringify(state.meta) : '',
  };
}

function deserializeState(raw: Record<string, string>): ProgressState {
  return {
    percent: parseInt(raw.percent, 10),
    message: raw.message,
    phase: raw.phase,
    phaseName: raw.phaseName,
    detail: raw.detail || undefined,
    updatedAt: parseInt(raw.updatedAt, 10),
    meta: raw.meta ? JSON.parse(raw.meta) : undefined,
  };
}

export const progressStore = {
  async set(jobId: string, state: ProgressState): Promise<void> {
    const hwm = highWaterMarks.get(jobId) ?? 0;
    if (state.percent < hwm) {
      state = { ...state, percent: hwm };
    }
    highWaterMarks.set(jobId, state.percent);

    try {
      const key = PROGRESS_KEYS.state(jobId);
      const serialized = serializeState(state);
      await redisHSet(key, serialized);
      await redis.publish(key, JSON.stringify(state));
      await redisExpire(key, TTL_SECONDS);

      const buffered = buffer.flush();
      for (const evt of buffered) {
        const k = PROGRESS_KEYS.state(evt.jobId);
        await redisHSet(k, serializeState(evt.state));
        await redis.publish(k, JSON.stringify(evt.state));
      }
    } catch (err) {
      logger.warn({ jobId, err }, 'Redis write failed, buffering progress');
      buffer.push(jobId, state);
    }
  },

  async get(jobId: string): Promise<ProgressState | null> {
    try {
      const raw = await redisHGetAll(PROGRESS_KEYS.state(jobId));
      if (raw) return deserializeState(raw);
    } catch {
      // Redis unavailable, fall through to DB
    }

    try {
      const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
      if (!job) return null;
      const meta = job.progressMeta as Record<string, unknown> | null;
      return {
        percent: job.progress,
        message: job.progressMessage || 'Processing...',
        phase: (meta?.phase as string) || 'unknown',
        phaseName: (meta?.phaseName as string) || 'Processing',
        updatedAt: Date.now(),
        meta: meta || undefined,
      };
    } catch {
      return null;
    }
  },

  async checkpoint(jobId: string, state: ProgressState): Promise<void> {
    await progressStore.set(jobId, state);

    try {
      const meta: Record<string, unknown> = {
        phase: state.phase,
        phaseName: state.phaseName,
      };
      if (state.meta) Object.assign(meta, state.meta);

      await db.update(jobs)
        .set({
          progress: state.percent,
          progressMessage: state.message.slice(0, 500),
          progressMeta: meta,
        })
        .where(eq(jobs.id, jobId));
    } catch (err) {
      logger.error({ jobId, err }, 'Failed to write progress checkpoint to DB');
    }
  },

  async setHealth(jobId: string, health: HealthState): Promise<void> {
    try {
      const key = PROGRESS_KEYS.health(jobId);
      const serialized: Record<string, string> = {
        processAlive: String(health.processAlive),
        lastHeartbeat: String(health.lastHeartbeat),
        lastFileChange: String(health.lastFileChange),
        lastRedisUpdate: String(health.lastRedisUpdate),
        phase: health.phase,
        retriesUsed: String(health.retriesUsed),
        retriesMax: String(health.retriesMax),
      };
      await redisHSet(key, serialized);
      await redis.publish(key, JSON.stringify(health));
      await redisExpire(key, TTL_SECONDS);
    } catch (err) {
      logger.warn({ jobId, err }, 'Failed to publish health state');
    }
  },

  async addActivity(jobId: string, event: ActivityEvent): Promise<void> {
    try {
      const key = PROGRESS_KEYS.activity(jobId);
      await redisRPush(key, JSON.stringify(event), 100);
      await redisExpire(key, TTL_SECONDS);
      await redis.publish(PROGRESS_KEYS.state(jobId), JSON.stringify({
        ...event,
        _type: 'activity',
      }));
    } catch (err) {
      logger.warn({ jobId, err }, 'Failed to add activity event');
    }
  },

  async getActivity(jobId: string): Promise<ActivityEvent[]> {
    try {
      const key = PROGRESS_KEYS.activity(jobId);
      const raw = await redis.lrange(key, 0, -1);
      return raw.map((r) => JSON.parse(r) as ActivityEvent);
    } catch {
      return [];
    }
  },

  async cleanup(jobId: string): Promise<void> {
    highWaterMarks.delete(jobId);
    try {
      const ttl = 60 * 60; // 1 hour
      await redisExpire(PROGRESS_KEYS.state(jobId), ttl);
      await redisExpire(PROGRESS_KEYS.health(jobId), ttl);
      await redisExpire(PROGRESS_KEYS.activity(jobId), ttl);
    } catch {
      // Non-critical
    }
  },
};
