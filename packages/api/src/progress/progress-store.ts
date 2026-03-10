import { eq } from 'drizzle-orm';
import type {
  ProgressState,
  HealthState,
  ActivityEvent,
} from '@viona/shared';
import { PROGRESS_KEYS } from '@viona/shared';
import { redisHGetAll, redisLRange, redisSubscribe } from '../services/redis.js';
import { db } from '../db/index.js';
import { jobs } from '../db/schema.js';

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

function deserializeHealth(raw: Record<string, string>): HealthState {
  return {
    processAlive: raw.processAlive === 'true',
    lastHeartbeat: parseInt(raw.lastHeartbeat, 10),
    lastFileChange: parseInt(raw.lastFileChange, 10),
    lastRedisUpdate: parseInt(raw.lastRedisUpdate, 10),
    phase: raw.phase,
    retriesUsed: parseInt(raw.retriesUsed, 10),
    retriesMax: parseInt(raw.retriesMax, 10),
  };
}

export const apiProgressStore = {
  async get(jobId: string): Promise<ProgressState | null> {
    try {
      const raw = await redisHGetAll(PROGRESS_KEYS.state(jobId));
      if (raw) return deserializeState(raw);
    } catch {}

    try {
      const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
      if (!job) return null;
      const meta = job.progressMeta as Record<string, unknown> | null;
      return {
        percent: job.progress,
        message: job.progressMessage || 'Processing...',
        phase: (meta?.phase as string) || 'unknown',
        phaseName: (meta?.phaseName as string) || 'Processing',
        updatedAt: job.updatedAt?.getTime() ?? Date.now(),
        meta: meta || undefined,
      };
    } catch {
      return null;
    }
  },

  async getHealth(jobId: string): Promise<HealthState | null> {
    try {
      const raw = await redisHGetAll(PROGRESS_KEYS.health(jobId));
      if (raw) return deserializeHealth(raw);
    } catch {}
    return null;
  },

  async getActivity(jobId: string): Promise<ActivityEvent[]> {
    try {
      const raw = await redisLRange(PROGRESS_KEYS.activity(jobId));
      return raw.map((r) => JSON.parse(r) as ActivityEvent);
    } catch {
      return [];
    }
  },

  subscribe(
    jobId: string,
    onProgress: (state: ProgressState) => void,
    onActivity?: (event: ActivityEvent) => void,
  ): () => void {
    return redisSubscribe(PROGRESS_KEYS.state(jobId), (message) => {
      try {
        const parsed = JSON.parse(message);
        if (parsed._type === 'activity' && onActivity) {
          const { _type, ...event } = parsed;
          onActivity(event as ActivityEvent);
        } else {
          onProgress(parsed as ProgressState);
        }
      } catch {}
    });
  },

  subscribeHealth(
    jobId: string,
    onHealth: (health: HealthState) => void,
  ): () => void {
    return redisSubscribe(PROGRESS_KEYS.health(jobId), (message) => {
      try {
        onHealth(JSON.parse(message) as HealthState);
      } catch {}
    });
  },
};
