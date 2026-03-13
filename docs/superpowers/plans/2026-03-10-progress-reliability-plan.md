# Industrial-Grade Job Progress System — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the passive, failure-prone job progress system with an actively-monitored, multi-layer architecture that never shows false "stalled" messages, auto-retries from checkpoints, and keeps the UI feeling alive.

**Architecture:** Three subprocess monitoring layers (process health, heartbeat protocol, file observer) feed a unified ProgressStore (Redis HSET for live state, DB for durable checkpoints). API subscribes to Redis instead of polling DB. Frontend merges SSE + WebSocket + HTTP into smooth, always-animated progress display.

**Tech Stack:** TypeScript, ioredis, Node.js fs.watch, Python threading, React hooks, Vitest

**Spec:** `docs/superpowers/specs/2026-03-10-progress-reliability-design.md`

---

## File Structure

### New Files

```
packages/shared/src/
  progress-types.ts              — Shared interfaces (ProgressState, HealthState, ActivityEvent, CheckpointState)

packages/worker/src/
  monitor/
    types.ts                     — SubprocessMonitorConfig, ProgressMapper interface
    checkpoint.ts                — Read/write .checkpoint.json, scan directory for CheckpointState
    process-watcher.ts           — Layer 1: liveness check, exit handling, retry logic
    heartbeat-tracker.ts         — Layer 2: parse HEARTBEAT lines, hung detection
    file-observer.ts             — Layer 3: fs.watch wrapper, debounced file change events
    subprocess-monitor.ts        — Core class: wires 3 layers together, wraps ChildProcess
    progress-mapper.ts           — Base ProgressMapper with default percent-from-phase logic
  progress/
    progress-store.ts            — Worker-side ProgressStore (Redis HSET + PUBLISH + DB checkpoint)
    progress-buffer.ts           — Local ring buffer for Redis-down fallback
  processors/generate-visuals/
    visual-progress-mapper.ts    — ProgressMapper for visual generation (Scene*.tsx → percent)

packages/api/src/
  progress/
    progress-relay.ts            — Subscribe to Redis, fan out to SSE + WebSocket
    progress-store.ts            — API-side ProgressStore (read-only: Redis HGET + DB fallback)
  routes/
    jobs.ts                      — (modify) Add GET /api/jobs/:id/activity endpoint

packages/worker/src/agents/
  claude_visual_generator.py     — (modify) Add HeartbeatEmitter

apps/web/src/features/editor-v2/
  components/
    ProgressBar.tsx              — Smooth-interpolated bar with shimmer
    PhaseTimeline.tsx            — Horizontal phase indicator
    ActivityLog.tsx              — Expandable file-level event log
    HealthIndicator.tsx          — Connection/process status dot
  hooks/
    use-progress.ts              — Merge SSE + WS + HTTP into single state
    use-smooth-progress.ts       — Interpolation + creep animation
```

### Modified Files

```
packages/shared/src/index.ts                    — Add progress-types export
packages/shared/tsup.config.ts                  — Add progress-types entry
packages/shared/package.json                    — Add progress-types export path
packages/worker/src/processors/generate-visuals/subprocess.ts — Use SubprocessMonitor
packages/worker/src/processors/generate-visuals/index.ts      — Use ProgressStore, remove heartbeat-progress
packages/worker/src/services/redis.ts                         — Add HSET/HGET/RPUSH helpers
packages/api/src/services/redis.ts                            — Add HSET/HGET helpers, remove old publishJobProgress
packages/api/src/agent/agent-tools.ts                         — pollJobProgress → subscribeJobProgress
packages/api/src/agent/agent-router.ts                        — SSE heartbeat sends proper events
packages/api/src/ws/handler.ts                                — Forward health + activity events
apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx — Integrate new components
apps/web/src/features/editor-v2/hooks/use-job-websocket.ts      — Handle new event types
apps/web/src/lib/api.ts                                         — Add getJobActivity endpoint
```

### Deleted Files (Phase 3 only)

```
packages/worker/src/utils/heartbeat-progress.ts  — Replaced by SubprocessMonitor + ProgressStore
```

---

## Chunk 1: Shared Types + Progress Store

### Task 1: Add progress types to @viona/shared

**Files:**
- Create: `packages/shared/src/progress-types.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/tsup.config.ts`
- Modify: `packages/shared/package.json`

- [ ] **Step 1: Create progress-types.ts**

```typescript
// packages/shared/src/progress-types.ts

/** Live progress state — written to Redis HSET, read by frontend */
export interface ProgressState {
  percent: number;
  message: string;
  phase: string;
  phaseName: string;
  detail?: string;
  updatedAt: number;
  meta?: Record<string, unknown>;
}

/** Subprocess health — published alongside progress */
export interface HealthState {
  processAlive: boolean;
  lastHeartbeat: number;
  lastFileChange: number;
  lastRedisUpdate: number;
  phase: string;
  retriesUsed: number;
  retriesMax: number;
}

/** Single entry in the activity log */
export interface ActivityEvent {
  timestamp: number;
  type: 'file' | 'phase' | 'checkpoint' | 'health' | 'error';
  detail: string;
  phase?: string;
}

/** Phase completion status */
export interface PhaseCheckpoint {
  status: 'pending' | 'running' | 'complete' | 'failed';
  completedAt?: number;
  artifacts: string[];
}

/** Animate phase has extra scene tracking */
export interface AnimatePhaseCheckpoint extends PhaseCheckpoint {
  scenesTotal: number;
  scenesComplete: number[];
  scenesFailed: number[];
}

/** Checkpoint file written to .checkpoint.json for crash recovery */
export interface CheckpointState {
  version: 1;
  jobId: string;
  updatedAt: number;
  phases: {
    plan: PhaseCheckpoint;
    animate: AnimatePhaseCheckpoint;
    verify: PhaseCheckpoint;
    bundle: PhaseCheckpoint;
  };
}

/** Redis key helpers — ensures consistent key naming across worker + API */
export const PROGRESS_KEYS = {
  state: (jobId: string) => `job:${jobId}:progress`,
  health: (jobId: string) => `job:${jobId}:health`,
  activity: (jobId: string) => `job:${jobId}:activity`,
} as const;

/** Default empty checkpoint */
export function createEmptyCheckpoint(jobId: string): CheckpointState {
  const emptyPhase: PhaseCheckpoint = { status: 'pending', artifacts: [] };
  return {
    version: 1,
    jobId,
    updatedAt: Date.now(),
    phases: {
      plan: { ...emptyPhase },
      animate: { ...emptyPhase, scenesTotal: 0, scenesComplete: [], scenesFailed: [] },
      verify: { ...emptyPhase },
      bundle: { ...emptyPhase },
    },
  };
}
```

- [ ] **Step 2: Export from index.ts**

Add to `packages/shared/src/index.ts`:
```typescript
export * from './progress-types';
```

- [ ] **Step 3: Add progress-types entry to tsup.config.ts**

```typescript
// packages/shared/tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/types/index.ts', 'src/storage.ts', 'src/queue-types.ts', 'src/progress-types.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
});
```

- [ ] **Step 4: Add progress-types export to package.json**

Add to `packages/shared/package.json` exports field:
```json
"./progress-types": {
  "types": "./dist/progress-types.d.ts",
  "import": "./dist/progress-types.mjs",
  "require": "./dist/progress-types.js"
}
```

- [ ] **Step 5: Build and verify**

Run: `cd packages/shared && pnpm build`
Expected: Clean build, `dist/progress-types.d.ts` exists

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/progress-types.ts packages/shared/src/index.ts packages/shared/tsup.config.ts packages/shared/package.json
git commit -m "feat(shared): add progress-types for unified job progress system"
```

---

### Task 2: Worker-side ProgressStore

**Files:**
- Create: `packages/worker/src/progress/progress-buffer.ts`
- Create: `packages/worker/src/progress/progress-store.ts`
- Modify: `packages/worker/src/services/redis.ts`

- [ ] **Step 1: Add Redis hash helpers to worker redis.ts**

Add to end of `packages/worker/src/services/redis.ts`:

```typescript
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
```

- [ ] **Step 2: Create progress-buffer.ts**

```typescript
// packages/worker/src/progress/progress-buffer.ts

import type { ProgressState } from '@viona/shared';

/**
 * Ring buffer for progress events when Redis is unreachable.
 * Stores up to `capacity` events. Oldest events are dropped when full.
 * Flush drains all buffered events in order.
 */
export class ProgressBuffer {
  private buffer: Array<{ jobId: string; state: ProgressState }> = [];
  private readonly capacity: number;

  constructor(capacity: number = 50) {
    this.capacity = capacity;
  }

  push(jobId: string, state: ProgressState): void {
    if (this.buffer.length >= this.capacity) {
      this.buffer.shift();
    }
    this.buffer.push({ jobId, state });
  }

  flush(): Array<{ jobId: string; state: ProgressState }> {
    const events = [...this.buffer];
    this.buffer = [];
    return events;
  }

  get size(): number {
    return this.buffer.length;
  }
}
```

- [ ] **Step 3: Create progress-store.ts**

```typescript
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

/**
 * Worker-side ProgressStore.
 *
 * - set(): Redis HSET + PUBLISH (fast, frequent)
 * - checkpoint(): DB write (durable, infrequent)
 * - get(): Redis HGET → DB fallback
 * - setHealth(): Redis HSET + PUBLISH for health state
 * - addActivity(): Redis RPUSH for activity log
 * - cleanup(): Set TTL on all Redis keys
 */
export const progressStore = {
  async set(jobId: string, state: ProgressState): Promise<void> {
    // High-water mark: never regress
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

      // Flush any buffered events from a previous Redis outage
      const buffered = buffer.flush();
      for (const evt of buffered) {
        const k = PROGRESS_KEYS.state(evt.jobId);
        await redisHSet(k, serializeState(evt.state));
        await redis.publish(k, JSON.stringify(evt.state));
      }
    } catch (err) {
      // Redis down — buffer locally
      logger.warn({ jobId, err }, 'Redis write failed, buffering progress');
      buffer.push(jobId, state);
    }
  },

  async get(jobId: string): Promise<ProgressState | null> {
    // Try Redis first
    try {
      const raw = await redisHGetAll(PROGRESS_KEYS.state(jobId));
      if (raw) return deserializeState(raw);
    } catch {
      // Redis unavailable, fall through to DB
    }

    // Fall back to DB
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

  async checkpoint(jobId: string, state: ProgressState): Promise<void> {
    // Also write to Redis for live updates
    await progressStore.set(jobId, state);

    // Durable DB write
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
      // Also publish for real-time delivery
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
      // Set short TTL instead of deleting — allows frontend to read final state
      const ttl = 60 * 60; // 1 hour
      await redisExpire(PROGRESS_KEYS.state(jobId), ttl);
      await redisExpire(PROGRESS_KEYS.health(jobId), ttl);
      await redisExpire(PROGRESS_KEYS.activity(jobId), ttl);
    } catch {
      // Non-critical
    }
  },
};
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd packages/worker && npx tsc --noEmit`
Expected: No errors related to progress-store

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/progress/ packages/worker/src/services/redis.ts
git commit -m "feat(worker): add ProgressStore with Redis HSET + DB checkpoint + local buffer"
```

---

### Task 3: API-side ProgressStore (read-only + subscribe)

**Files:**
- Create: `packages/api/src/progress/progress-store.ts`
- Modify: `packages/api/src/services/redis.ts`

- [ ] **Step 1: Add Redis hash helpers to API redis.ts**

Add to end of `packages/api/src/services/redis.ts`:

```typescript
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
 * Subscribe to a Redis channel pattern.
 * Returns an unsubscribe function.
 *
 * Uses a dedicated subscriber client per subscription to avoid
 * conflicts with the global redisSub used by WebSocket handler.
 */
export function redisSubscribe(
  channel: string,
  callback: (message: string) => void,
): () => void {
  const Redis = require('ioredis').default;
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
```

- [ ] **Step 2: Create API-side progress-store.ts**

```typescript
// packages/api/src/progress/progress-store.ts

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

/**
 * API-side ProgressStore — read-only + subscribe.
 * Worker writes, API reads and forwards to frontend.
 */
export const apiProgressStore = {
  /** Read current progress from Redis, fall back to DB */
  async get(jobId: string): Promise<ProgressState | null> {
    try {
      const raw = await redisHGetAll(PROGRESS_KEYS.state(jobId));
      if (raw) return deserializeState(raw);
    } catch {
      // Redis unavailable
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
        updatedAt: job.updatedAt?.getTime() ?? Date.now(),
        meta: meta || undefined,
      };
    } catch {
      return null;
    }
  },

  /** Read current health from Redis */
  async getHealth(jobId: string): Promise<HealthState | null> {
    try {
      const raw = await redisHGetAll(PROGRESS_KEYS.health(jobId));
      if (raw) return deserializeHealth(raw);
    } catch {
      // Redis unavailable
    }
    return null;
  },

  /** Read activity log from Redis */
  async getActivity(jobId: string): Promise<ActivityEvent[]> {
    try {
      const raw = await redisLRange(PROGRESS_KEYS.activity(jobId));
      return raw.map((r) => JSON.parse(r) as ActivityEvent);
    } catch {
      return [];
    }
  },

  /**
   * Subscribe to live progress updates via Redis pub/sub.
   * Returns unsubscribe function.
   */
  subscribe(
    jobId: string,
    onProgress: (state: ProgressState) => void,
    onActivity?: (event: ActivityEvent) => void,
  ): () => void {
    return redisSubscribe(PROGRESS_KEYS.state(jobId), (message) => {
      try {
        const parsed = JSON.parse(message);
        // Activity events have a _type field
        if (parsed._type === 'activity' && onActivity) {
          const { _type, ...event } = parsed;
          onActivity(event as ActivityEvent);
        } else {
          onProgress(parsed as ProgressState);
        }
      } catch {
        // Malformed message
      }
    });
  },

  /** Subscribe to health updates */
  subscribeHealth(
    jobId: string,
    onHealth: (health: HealthState) => void,
  ): () => void {
    return redisSubscribe(PROGRESS_KEYS.health(jobId), (message) => {
      try {
        onHealth(JSON.parse(message) as HealthState);
      } catch {
        // Malformed message
      }
    });
  },
};
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit`
Expected: No errors related to progress-store

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/progress/ packages/api/src/services/redis.ts
git commit -m "feat(api): add API-side ProgressStore with Redis subscribe + DB fallback"
```

---

## Chunk 2: Subprocess Monitor

### Task 4: Checkpoint reader/writer

**Files:**
- Create: `packages/worker/src/monitor/types.ts`
- Create: `packages/worker/src/monitor/checkpoint.ts`

- [ ] **Step 1: Create monitor types.ts**

```typescript
// packages/worker/src/monitor/types.ts

import type { ChildProcess } from 'child_process';
import type { ProgressState, CheckpointState } from '@viona/shared';
import type { progressStore } from '../progress/progress-store.js';

/** Configuration for SubprocessMonitor */
export interface SubprocessMonitorConfig {
  jobId: string;
  workDir: string;
  progressStore: typeof progressStore;
  heartbeatTimeoutSec: number;
  healthCheckIntervalSec: number;
  maxRetries: number;
  buildRetryArgs: (checkpoint: CheckpointState) => string[];
  progressMapper: ProgressMapper;
  signal?: AbortSignal;
}

/** Processor-specific progress mapping */
export interface ProgressMapper {
  mapFilesToProgress(checkpoint: CheckpointState): Partial<ProgressState>;
  mapHeartbeatToProgress(phase: string, detail: string): Partial<ProgressState>;
  mapStdoutToProgress(percent: number, message: string, meta?: Record<string, unknown>): Partial<ProgressState>;
}

/** Result from SubprocessMonitor.run() */
export interface SubprocessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  checkpoint: CheckpointState;
  retriesUsed: number;
}

/** Parsed heartbeat from Python stdout */
export interface HeartbeatEvent {
  timestamp: number;
  phase: string;
  detail: string;
}

/** File change event from observer */
export interface FileChangeEvent {
  type: 'create' | 'modify' | 'delete';
  path: string;
  relativePath: string;
  timestamp: number;
}
```

- [ ] **Step 2: Create checkpoint.ts**

```typescript
// packages/worker/src/monitor/checkpoint.ts

import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { join, relative } from 'path';
import type { CheckpointState, AnimatePhaseCheckpoint } from '@viona/shared';
import { createEmptyCheckpoint } from '@viona/shared';

const CHECKPOINT_FILENAME = '.checkpoint.json';

/**
 * Read .checkpoint.json from disk.
 * Returns empty checkpoint if file doesn't exist.
 */
export async function readCheckpoint(workDir: string, jobId: string): Promise<CheckpointState> {
  const filePath = join(workDir, CHECKPOINT_FILENAME);
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as CheckpointState;
  } catch {
    return createEmptyCheckpoint(jobId);
  }
}

/** Write .checkpoint.json to disk */
export async function writeCheckpoint(workDir: string, checkpoint: CheckpointState): Promise<void> {
  const filePath = join(workDir, CHECKPOINT_FILENAME);
  checkpoint.updatedAt = Date.now();
  await writeFile(filePath, JSON.stringify(checkpoint, null, 2), 'utf-8');
}

/**
 * Scan project directory and derive checkpoint state from what files exist.
 * This is the ground truth — no matter what the process said, this is what's on disk.
 */
export async function scanCheckpointFromDisk(
  workDir: string,
  jobId: string,
): Promise<CheckpointState> {
  const cp = createEmptyCheckpoint(jobId);

  const exists = async (name: string) => {
    try { await stat(join(workDir, name)); return true; } catch { return false; }
  };

  // Plan phase
  const hasScenePlan = await exists('SCENE_PLAN.md');
  const hasScenesJson = await exists('scenes.json');
  if (hasScenePlan) cp.phases.plan.artifacts.push('SCENE_PLAN.md');
  if (hasScenesJson) cp.phases.plan.artifacts.push('scenes.json');
  if (hasScenePlan && hasScenesJson) {
    cp.phases.plan.status = 'complete';
    cp.phases.plan.completedAt = Date.now();
  } else if (hasScenePlan) {
    cp.phases.plan.status = 'running';
  }

  // Animate phase
  const hasConstants = await exists('constants.ts');
  if (hasConstants) cp.phases.animate.artifacts.push('constants.ts');

  // Count completed scenes
  const scenesDir = join(workDir, 'scenes');
  try {
    const sceneFiles = await readdir(scenesDir);
    const sceneNums = sceneFiles
      .filter((f) => /^Scene\d+\.tsx$/.test(f))
      .map((f) => parseInt(f.match(/Scene(\d+)/)?.[1] ?? '0', 10))
      .filter((n) => n > 0)
      .sort((a, b) => a - b);

    cp.phases.animate.scenesComplete = sceneNums;
    for (const n of sceneNums) {
      cp.phases.animate.artifacts.push(`scenes/Scene${n}.tsx`);
    }

    // Read total scenes from scenes.json if available
    if (hasScenesJson) {
      try {
        const raw = await readFile(join(workDir, 'scenes.json'), 'utf-8');
        const data = JSON.parse(raw);
        cp.phases.animate.scenesTotal = data.scenes?.length ?? 0;
      } catch { /* malformed scenes.json */ }
    }

    if (cp.phases.animate.scenesTotal > 0 &&
        sceneNums.length >= cp.phases.animate.scenesTotal) {
      cp.phases.animate.status = 'complete';
      cp.phases.animate.completedAt = Date.now();
    } else if (sceneNums.length > 0 || hasConstants) {
      cp.phases.animate.status = 'running';
    }
  } catch {
    // scenes/ directory doesn't exist yet
  }

  // Verify phase
  const hasIndex = await exists('index.tsx');
  if (hasIndex) {
    cp.phases.verify.artifacts.push('index.tsx');
    cp.phases.verify.status = 'running';
  }

  // Bundle phase
  const hasMetadata = await exists('metadata.json');
  if (hasMetadata) {
    cp.phases.bundle.artifacts.push('metadata.json');
    cp.phases.bundle.status = 'running';
  }

  cp.updatedAt = Date.now();
  return cp;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/worker && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/monitor/types.ts packages/worker/src/monitor/checkpoint.ts
git commit -m "feat(worker): add checkpoint reader/writer and directory scanner"
```

---

### Task 5: Process Watcher (Layer 1)

**Files:**
- Create: `packages/worker/src/monitor/process-watcher.ts`

- [ ] **Step 1: Create process-watcher.ts**

```typescript
// packages/worker/src/monitor/process-watcher.ts

import type { ChildProcess } from 'child_process';
import { logger } from '../logger.js';

export interface ProcessWatcherConfig {
  healthCheckIntervalMs: number;
  onExit: (code: number | null, signal: string | null) => void;
  onHealthCheck: () => void;
}

/**
 * Layer 1: Process liveness monitor.
 * - Periodic health checks (is the process still alive?)
 * - Immediate exit detection via 'exit' event
 * - Escalation: SIGTERM → 10s wait → SIGKILL
 */
export class ProcessWatcher {
  private process: ChildProcess | null = null;
  private healthInterval: ReturnType<typeof setInterval> | null = null;
  private readonly config: ProcessWatcherConfig;
  private stopped = false;

  constructor(config: ProcessWatcherConfig) {
    this.config = config;
  }

  /** Attach to a child process */
  attach(proc: ChildProcess): void {
    this.process = proc;
    this.stopped = false;

    proc.on('exit', (code, signal) => {
      this.stopHealthCheck();
      if (!this.stopped) {
        this.config.onExit(code, signal);
      }
    });

    proc.on('error', (err) => {
      logger.error({ err }, 'Subprocess spawn error');
      this.stopHealthCheck();
      if (!this.stopped) {
        this.config.onExit(-1, null);
      }
    });

    this.startHealthCheck();
  }

  /** Kill the process with escalation: SIGTERM → 10s → SIGKILL */
  async kill(reason: string): Promise<void> {
    if (!this.process || this.process.exitCode !== null) return;

    logger.info({ reason, pid: this.process.pid }, 'Killing subprocess');
    this.process.kill('SIGTERM');

    // Wait up to 10s for graceful exit
    const killed = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 10_000);
      this.process!.once('exit', () => {
        clearTimeout(timeout);
        resolve(true);
      });
    });

    if (!killed && this.process.exitCode === null) {
      logger.warn({ pid: this.process.pid }, 'SIGTERM failed, sending SIGKILL');
      this.process.kill('SIGKILL');
    }
  }

  /** Stop watching without killing */
  detach(): void {
    this.stopped = true;
    this.stopHealthCheck();
  }

  get isAlive(): boolean {
    return this.process !== null && this.process.exitCode === null;
  }

  private startHealthCheck(): void {
    this.healthInterval = setInterval(() => {
      this.config.onHealthCheck();
    }, this.config.healthCheckIntervalMs);
  }

  private stopHealthCheck(): void {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/src/monitor/process-watcher.ts
git commit -m "feat(worker): add ProcessWatcher (Layer 1) — liveness check + exit detection"
```

---

### Task 6: Heartbeat Tracker (Layer 2)

**Files:**
- Create: `packages/worker/src/monitor/heartbeat-tracker.ts`

- [ ] **Step 1: Create heartbeat-tracker.ts**

```typescript
// packages/worker/src/monitor/heartbeat-tracker.ts

import type { HeartbeatEvent } from './types.js';
import { logger } from '../logger.js';

export interface HeartbeatTrackerConfig {
  timeoutMs: number;
  onHeartbeat: (event: HeartbeatEvent) => void;
  onHung: () => void;
}

/**
 * Layer 2: Heartbeat protocol tracker.
 * Parses HEARTBEAT lines from stdout, tracks last-seen time,
 * and reports hung process when timeout exceeded.
 */
export class HeartbeatTracker {
  private lastHeartbeatTime: number = Date.now();
  private readonly config: HeartbeatTrackerConfig;

  // Regex: HEARTBEAT:{unix_ms}:{phase}:{detail}
  private static readonly HEARTBEAT_RE = /^HEARTBEAT:(\d+):(\w+):(.*)$/;
  // Also treat PROGRESS lines as proof-of-life
  private static readonly PROGRESS_RE = /^PROGRESS:(\d+):(.+?)(?:\|(.+))?$/;

  constructor(config: HeartbeatTrackerConfig) {
    this.config = config;
  }

  /**
   * Feed a stdout line. Returns true if it was a heartbeat or progress line.
   */
  parseLine(line: string): boolean {
    const hbMatch = line.match(HeartbeatTracker.HEARTBEAT_RE);
    if (hbMatch) {
      this.lastHeartbeatTime = Date.now();
      this.config.onHeartbeat({
        timestamp: parseInt(hbMatch[1], 10),
        phase: hbMatch[2],
        detail: hbMatch[3],
      });
      return true;
    }

    const progMatch = line.match(HeartbeatTracker.PROGRESS_RE);
    if (progMatch) {
      // PROGRESS lines count as proof-of-life
      this.lastHeartbeatTime = Date.now();
      return false; // Let the caller handle PROGRESS parsing
    }

    return false;
  }

  /** Check if process is hung. Call this periodically (e.g., every 5s). */
  checkHung(): boolean {
    const elapsed = Date.now() - this.lastHeartbeatTime;
    if (elapsed > this.config.timeoutMs) {
      logger.warn(
        { elapsedMs: elapsed, timeoutMs: this.config.timeoutMs },
        'Subprocess heartbeat timeout — process appears hung',
      );
      this.config.onHung();
      return true;
    }
    return false;
  }

  /** Reset heartbeat timer (e.g., after retry spawns new process) */
  reset(): void {
    this.lastHeartbeatTime = Date.now();
  }

  get lastSeen(): number {
    return this.lastHeartbeatTime;
  }

  get msSinceLastHeartbeat(): number {
    return Date.now() - this.lastHeartbeatTime;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/src/monitor/heartbeat-tracker.ts
git commit -m "feat(worker): add HeartbeatTracker (Layer 2) — parse heartbeats, detect hung process"
```

---

### Task 7: File Observer (Layer 3)

**Files:**
- Create: `packages/worker/src/monitor/file-observer.ts`

- [ ] **Step 1: Create file-observer.ts**

```typescript
// packages/worker/src/monitor/file-observer.ts

import { watch, type FSWatcher } from 'fs';
import { readdir, stat } from 'fs/promises';
import { join, relative } from 'path';
import type { FileChangeEvent } from './types.js';
import { logger } from '../logger.js';

export interface FileObserverConfig {
  workDir: string;
  /** Debounce interval in ms — batches rapid writes */
  debounceMs: number;
  /** Called with batched file changes */
  onChange: (events: FileChangeEvent[]) => void;
}

/**
 * Layer 3: File system observer.
 * Watches a workspace directory for file changes.
 * Debounces rapid writes and emits batched events.
 *
 * Uses Node's native fs.watch — works on Windows, macOS, Linux.
 */
export class FileObserver {
  private watchers: FSWatcher[] = [];
  private pending: FileChangeEvent[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly config: FileObserverConfig;
  private stopped = false;

  constructor(config: FileObserverConfig) {
    this.config = config;
  }

  /** Start watching. Sets up recursive watcher. */
  async start(): Promise<void> {
    this.stopped = false;

    try {
      // Node's fs.watch with recursive option works on Windows + macOS.
      // On Linux, recursive may not work — fall back to watching key subdirs.
      const watcher = watch(
        this.config.workDir,
        { recursive: true },
        (eventType, filename) => {
          if (this.stopped || !filename) return;
          this.handleEvent(eventType, filename);
        },
      );

      watcher.on('error', (err) => {
        logger.warn({ err, workDir: this.config.workDir }, 'File watcher error');
      });

      this.watchers.push(watcher);
    } catch (err) {
      // recursive watch not supported — watch key subdirectories manually
      logger.info({ workDir: this.config.workDir }, 'Recursive watch unavailable, watching subdirs');
      await this.watchSubdirs();
    }
  }

  /** Stop all watchers and flush pending events */
  stop(): void {
    this.stopped = true;
    for (const w of this.watchers) {
      w.close();
    }
    this.watchers = [];
    this.flushPending();
  }

  private handleEvent(eventType: string, filename: string): void {
    // Filter noise: ignore hidden files, node_modules, .git
    if (filename.startsWith('.') && filename !== '.checkpoint.json') return;
    if (filename.includes('node_modules') || filename.includes('.git')) return;

    const event: FileChangeEvent = {
      type: eventType === 'rename' ? 'create' : 'modify',
      path: join(this.config.workDir, filename),
      relativePath: filename,
      timestamp: Date.now(),
    };

    this.pending.push(event);
    this.scheduleBatch();
  }

  private scheduleBatch(): void {
    if (this.debounceTimer) return;
    this.debounceTimer = setTimeout(() => {
      this.flushPending();
    }, this.config.debounceMs);
  }

  private flushPending(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.pending.length > 0) {
      const events = [...this.pending];
      this.pending = [];
      this.config.onChange(events);
    }
  }

  /** Fallback for Linux: watch known subdirectories */
  private async watchSubdirs(): Promise<void> {
    const dirs = [this.config.workDir];
    try {
      const scenesDir = join(this.config.workDir, 'scenes');
      await stat(scenesDir);
      dirs.push(scenesDir);
    } catch { /* scenes/ doesn't exist yet */ }
    try {
      const componentsDir = join(this.config.workDir, 'components');
      await stat(componentsDir);
      dirs.push(componentsDir);
    } catch { /* components/ doesn't exist yet */ }

    for (const dir of dirs) {
      try {
        const watcher = watch(dir, (eventType, filename) => {
          if (this.stopped || !filename) return;
          const relPath = relative(this.config.workDir, join(dir, filename));
          this.handleEvent(eventType, relPath);
        });
        watcher.on('error', () => { /* ignore */ });
        this.watchers.push(watcher);
      } catch {
        // Directory doesn't exist yet — skip
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/src/monitor/file-observer.ts
git commit -m "feat(worker): add FileObserver (Layer 3) — debounced fs.watch with cross-platform support"
```

---

### Task 8: Base ProgressMapper

**Files:**
- Create: `packages/worker/src/monitor/progress-mapper.ts`

- [ ] **Step 1: Create progress-mapper.ts with default phase-to-percent mapping**

```typescript
// packages/worker/src/monitor/progress-mapper.ts

import type { ProgressState, CheckpointState } from '@viona/shared';
import type { ProgressMapper } from './types.js';

/** Phase weight ranges — maps phase completion to progress percent */
export interface PhaseWeights {
  [phase: string]: { start: number; end: number; label: string };
}

export const DEFAULT_PHASE_WEIGHTS: PhaseWeights = {
  plan:    { start: 15, end: 35,  label: 'Planning scenes' },
  animate: { start: 35, end: 65,  label: 'Animating scenes' },
  verify:  { start: 65, end: 75,  label: 'Verifying scenes' },
  bundle:  { start: 75, end: 90,  label: 'Bundling' },
  upload:  { start: 90, end: 100, label: 'Uploading' },
};

/** Linear interpolation */
function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * Math.max(0, Math.min(1, t)));
}

/**
 * Base ProgressMapper with sensible defaults.
 * Extend or compose for processor-specific behavior.
 */
export class BaseProgressMapper implements ProgressMapper {
  protected weights: PhaseWeights;

  constructor(weights: PhaseWeights = DEFAULT_PHASE_WEIGHTS) {
    this.weights = weights;
  }

  mapFilesToProgress(checkpoint: CheckpointState): Partial<ProgressState> {
    // Determine current phase from checkpoint
    if (checkpoint.phases.bundle.status === 'running' || checkpoint.phases.bundle.status === 'complete') {
      const w = this.weights.bundle;
      return { percent: w.start, phase: 'bundle', phaseName: w.label };
    }

    if (checkpoint.phases.verify.status === 'running' || checkpoint.phases.verify.status === 'complete') {
      const w = this.weights.verify;
      return { percent: w.start, phase: 'verify', phaseName: w.label };
    }

    if (checkpoint.phases.animate.status === 'running') {
      const w = this.weights.animate;
      const total = checkpoint.phases.animate.scenesTotal;
      const done = checkpoint.phases.animate.scenesComplete.length;
      const t = total > 0 ? done / total : 0;
      return {
        percent: lerp(w.start, w.end, t),
        phase: 'animate',
        phaseName: w.label,
        detail: total > 0 ? `Scene ${done}/${total}` : undefined,
      };
    }

    if (checkpoint.phases.animate.status === 'complete') {
      const w = this.weights.animate;
      return { percent: w.end, phase: 'animate', phaseName: w.label };
    }

    if (checkpoint.phases.plan.status === 'running') {
      const w = this.weights.plan;
      return { percent: w.start, phase: 'plan', phaseName: w.label };
    }

    if (checkpoint.phases.plan.status === 'complete') {
      const w = this.weights.plan;
      return { percent: w.end, phase: 'plan', phaseName: w.label };
    }

    return { percent: 10, phase: 'starting', phaseName: 'Starting' };
  }

  mapHeartbeatToProgress(phase: string, detail: string): Partial<ProgressState> {
    const w = this.weights[phase];
    if (!w) return { phase, phaseName: phase, detail };
    return { phase, phaseName: w.label, detail };
  }

  mapStdoutToProgress(
    percent: number,
    message: string,
    meta?: Record<string, unknown>,
  ): Partial<ProgressState> {
    return {
      percent,
      message,
      phase: (meta?.phase as string) || undefined,
      phaseName: (meta?.phaseName as string) || undefined,
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/src/monitor/progress-mapper.ts
git commit -m "feat(worker): add BaseProgressMapper with phase-to-percent weight mapping"
```

---

### Task 9: SubprocessMonitor — core orchestrator

**Files:**
- Create: `packages/worker/src/monitor/subprocess-monitor.ts`

- [ ] **Step 1: Create subprocess-monitor.ts**

```typescript
// packages/worker/src/monitor/subprocess-monitor.ts

import { spawn, type ChildProcess } from 'child_process';
import type { ProgressState, CheckpointState, HealthState } from '@viona/shared';
import type { SubprocessMonitorConfig, SubprocessResult } from './types.js';
import { ProcessWatcher } from './process-watcher.js';
import { HeartbeatTracker } from './heartbeat-tracker.js';
import { FileObserver } from './file-observer.js';
import { scanCheckpointFromDisk, writeCheckpoint, readCheckpoint } from './checkpoint.js';
import { logger } from '../logger.js';

/**
 * Core subprocess monitor — wraps a child process with three monitoring layers.
 *
 * Usage:
 *   const monitor = new SubprocessMonitor(config);
 *   const result = await monitor.run(command, args, spawnOptions);
 */
export class SubprocessMonitor {
  private readonly config: SubprocessMonitorConfig;
  private processWatcher: ProcessWatcher;
  private heartbeatTracker: HeartbeatTracker;
  private fileObserver: FileObserver;
  private retriesUsed = 0;
  private currentProcess: ChildProcess | null = null;
  private lastProgressState: Partial<ProgressState> = {};

  constructor(config: SubprocessMonitorConfig) {
    this.config = config;

    // Layer 1: Process Health
    this.processWatcher = new ProcessWatcher({
      healthCheckIntervalMs: config.healthCheckIntervalSec * 1000,
      onExit: () => {}, // Set per-run
      onHealthCheck: () => this.onHealthCheck(),
    });

    // Layer 2: Heartbeat
    this.heartbeatTracker = new HeartbeatTracker({
      timeoutMs: config.heartbeatTimeoutSec * 1000,
      onHeartbeat: (event) => this.onHeartbeat(event),
      onHung: () => this.onHung(),
    });

    // Layer 3: File Observer
    this.fileObserver = new FileObserver({
      workDir: config.workDir,
      debounceMs: 200,
      onChange: (events) => this.onFileChange(events),
    });
  }

  /**
   * Run a subprocess with full monitoring.
   * Returns when process exits (or all retries exhausted).
   */
  async run(
    command: string,
    args: string[],
    spawnOptions: Parameters<typeof spawn>[2] = {},
  ): Promise<SubprocessResult> {
    let stdout = '';
    let stderr = '';

    // Start file observer
    await this.fileObserver.start();

    // Publish initial health
    await this.publishHealth(true);

    const runOnce = (cmd: string, a: string[]): Promise<{ code: number | null; signal: string | null }> => {
      return new Promise((resolve) => {
        const proc = spawn(cmd, a, {
          stdio: ['ignore', 'pipe', 'pipe'],
          ...spawnOptions,
        });

        this.currentProcess = proc;
        this.heartbeatTracker.reset();

        // Wire Layer 1
        this.processWatcher = new ProcessWatcher({
          healthCheckIntervalMs: this.config.healthCheckIntervalSec * 1000,
          onExit: (code, signal) => resolve({ code, signal }),
          onHealthCheck: () => this.onHealthCheck(),
        });
        this.processWatcher.attach(proc);

        // Wire stdout to Layer 2 (heartbeat) + PROGRESS parsing
        proc.stdout?.on('data', (chunk: Buffer) => {
          const text = chunk.toString('utf-8');
          stdout += text;

          for (const line of text.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Layer 2: try heartbeat parse first
            const wasHeartbeat = this.heartbeatTracker.parseLine(trimmed);
            if (wasHeartbeat) continue;

            // PROGRESS line — backward compat
            const match = trimmed.match(/^PROGRESS:(\d+):(.+?)(?:\|(.+))?$/);
            if (match) {
              const percent = parseInt(match[1], 10);
              const message = match[2];
              let meta: Record<string, unknown> | undefined;
              if (match[3]) {
                try { meta = JSON.parse(match[3]); } catch { /* ignore */ }
              }
              const partial = this.config.progressMapper.mapStdoutToProgress(percent, message, meta);
              this.emitProgress(partial);
            }
          }
        });

        proc.stderr?.on('data', (chunk: Buffer) => {
          stderr += chunk.toString('utf-8');
        });

        // Abort signal support
        if (this.config.signal) {
          const onAbort = () => {
            this.processWatcher.kill('User cancelled');
          };
          this.config.signal.addEventListener('abort', onAbort, { once: true });
          proc.on('exit', () => {
            this.config.signal?.removeEventListener('abort', onAbort);
          });
        }
      });
    };

    try {
      // First attempt
      let result = await runOnce(command, args);

      // Retry logic
      while (result.code !== 0 && this.retriesUsed < this.config.maxRetries) {
        this.retriesUsed++;
        logger.info(
          { jobId: this.config.jobId, retry: this.retriesUsed, maxRetries: this.config.maxRetries, exitCode: result.code },
          'Subprocess crashed — retrying from checkpoint',
        );

        await this.publishHealth(false);

        // Read checkpoint and build retry args
        const checkpoint = await scanCheckpointFromDisk(this.config.workDir, this.config.jobId);
        await writeCheckpoint(this.config.workDir, checkpoint);

        const retryArgs = this.config.buildRetryArgs(checkpoint);
        await this.config.progressStore.addActivity(this.config.jobId, {
          timestamp: Date.now(),
          type: 'health',
          detail: `Process crashed (exit ${result.code}), retrying from checkpoint (attempt ${this.retriesUsed})`,
          phase: checkpoint.phases.animate.status === 'running' ? 'animate' : 'plan',
        });

        // Reset trackers for new process
        this.heartbeatTracker.reset();
        stdout = '';
        stderr = '';

        await this.publishHealth(true);
        result = await runOnce(command, retryArgs);
      }

      // Final checkpoint
      const checkpoint = await scanCheckpointFromDisk(this.config.workDir, this.config.jobId);
      await writeCheckpoint(this.config.workDir, checkpoint);

      if (result.code !== 0) {
        await this.publishHealth(false);
      }

      return {
        exitCode: result.code ?? -1,
        stdout,
        stderr,
        checkpoint,
        retriesUsed: this.retriesUsed,
      };

    } finally {
      this.fileObserver.stop();
      this.processWatcher.detach();
    }
  }

  /** Periodic health check — called by ProcessWatcher timer */
  private onHealthCheck(): void {
    // Check Layer 2: heartbeat timeout
    this.heartbeatTracker.checkHung();
  }

  /** Layer 2: heartbeat received */
  private async onHeartbeat(event: { timestamp: number; phase: string; detail: string }): Promise<void> {
    const partial = this.config.progressMapper.mapHeartbeatToProgress(event.phase, event.detail);
    await this.emitProgress(partial);
    await this.publishHealth(true);
  }

  /** Layer 2: process appears hung */
  private async onHung(): Promise<void> {
    logger.warn({ jobId: this.config.jobId }, 'Subprocess heartbeat timeout — killing process');
    await this.config.progressStore.addActivity(this.config.jobId, {
      timestamp: Date.now(),
      type: 'health',
      detail: `No heartbeat for ${this.config.heartbeatTimeoutSec}s — process appears hung`,
    });
    await this.processWatcher.kill('heartbeat timeout');
  }

  /** Layer 3: file changes detected */
  private async onFileChange(events: Array<{ type: string; relativePath: string; timestamp: number }>): Promise<void> {
    // Scan disk for ground truth
    const checkpoint = await scanCheckpointFromDisk(this.config.workDir, this.config.jobId);
    await writeCheckpoint(this.config.workDir, checkpoint);

    // Derive progress from files
    const partial = this.config.progressMapper.mapFilesToProgress(checkpoint);
    await this.emitProgress(partial);

    // Log meaningful file events
    for (const event of events) {
      const file = event.relativePath;
      // Only log interesting files, not .checkpoint.json updates
      if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.json') || file.endsWith('.md')) {
        if (file === '.checkpoint.json') continue;
        await this.config.progressStore.addActivity(this.config.jobId, {
          timestamp: event.timestamp,
          type: 'file',
          detail: `${file} ${event.type === 'create' ? 'created' : 'modified'}`,
          phase: partial.phase,
        });
      }
    }

    // Update health with file change timestamp
    await this.publishHealth(true);
  }

  /** Emit a progress update (merges with last known state) */
  private async emitProgress(partial: Partial<ProgressState>): Promise<void> {
    this.lastProgressState = { ...this.lastProgressState, ...partial };
    const state: ProgressState = {
      percent: this.lastProgressState.percent ?? 0,
      message: this.lastProgressState.message ?? 'Processing...',
      phase: this.lastProgressState.phase ?? 'unknown',
      phaseName: this.lastProgressState.phaseName ?? 'Processing',
      detail: this.lastProgressState.detail,
      updatedAt: Date.now(),
      meta: this.lastProgressState.meta,
    };
    await this.config.progressStore.set(this.config.jobId, state);
  }

  /** Publish health state */
  private async publishHealth(alive: boolean): Promise<void> {
    const health: HealthState = {
      processAlive: alive,
      lastHeartbeat: this.heartbeatTracker.lastSeen,
      lastFileChange: Date.now(), // Approximation — updated on file events
      lastRedisUpdate: Date.now(),
      phase: this.lastProgressState.phase ?? 'unknown',
      retriesUsed: this.retriesUsed,
      retriesMax: this.config.maxRetries,
    };
    await this.config.progressStore.setHealth(this.config.jobId, health);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/worker && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/monitor/subprocess-monitor.ts
git commit -m "feat(worker): add SubprocessMonitor — 3-layer monitoring with auto-retry"
```

---

### Task 10: Visual Generation ProgressMapper

**Files:**
- Create: `packages/worker/src/processors/generate-visuals/visual-progress-mapper.ts`

- [ ] **Step 1: Create visual-progress-mapper.ts**

```typescript
// packages/worker/src/processors/generate-visuals/visual-progress-mapper.ts

import { BaseProgressMapper, DEFAULT_PHASE_WEIGHTS } from '../../monitor/progress-mapper.js';
import type { CheckpointState, ProgressState } from '@viona/shared';

/**
 * ProgressMapper specialized for visual generation.
 * Adds scene-level detail and smarter file-to-progress mapping.
 */
export class VisualProgressMapper extends BaseProgressMapper {
  constructor() {
    super(DEFAULT_PHASE_WEIGHTS);
  }

  override mapFilesToProgress(checkpoint: CheckpointState): Partial<ProgressState> {
    const base = super.mapFilesToProgress(checkpoint);

    // Enrich with scene detail for animate phase
    if (base.phase === 'animate' && checkpoint.phases.animate.scenesTotal > 0) {
      const done = checkpoint.phases.animate.scenesComplete.length;
      const total = checkpoint.phases.animate.scenesTotal;
      base.detail = `Scene ${done}/${total}`;
      base.message = `Animating scene ${done + 1} of ${total}`;
    }

    return base;
  }

  override mapHeartbeatToProgress(phase: string, detail: string): Partial<ProgressState> {
    const base = super.mapHeartbeatToProgress(phase, detail);
    // Use detail from heartbeat directly (e.g., "Scene 3/7", "Type-checking")
    base.detail = detail;
    return base;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/src/processors/generate-visuals/visual-progress-mapper.ts
git commit -m "feat(worker): add VisualProgressMapper for scene-level progress detail"
```

---

## Chunk 3: Python Heartbeat + Integration

### Task 11: Python HeartbeatEmitter

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py`

- [ ] **Step 1: Add HeartbeatEmitter class near top of file (after imports)**

Find the imports section and add after the last import:

```python
import threading

class HeartbeatEmitter:
    """Background thread heartbeat — keeps beating even if main thread hangs on API call."""

    def __init__(self, interval_sec: int = 10):
        self.phase = "starting"
        self.detail = ""
        self._interval = interval_sec
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def _run(self):
        while not self._stop.is_set():
            ts = int(time.time() * 1000)
            print(f"HEARTBEAT:{ts}:{self.phase}:{self.detail}", flush=True)
            self._stop.wait(self._interval)

    def update(self, phase: str, detail: str = ""):
        self.phase = phase
        self.detail = detail

    def stop(self):
        self._stop.set()
        self._thread.join(timeout=2)
```

- [ ] **Step 2: Wire HeartbeatEmitter into main() function**

Find `async def main()` and add near the start:

```python
heartbeat = HeartbeatEmitter(interval_sec=10)
```

Add `heartbeat.update()` calls before each major phase:
- Before Director: `heartbeat.update('plan', 'Director analyzing transcript')`
- Before each scene agent: `heartbeat.update('animate', f'Scene {n}/{total}')`
- Before tsc: `heartbeat.update('verify', 'Type-checking scenes')`
- Before bundle: `heartbeat.update('bundle', 'Remotion bundling')`
- Before upload/completion: `heartbeat.update('upload', 'Finalizing')`

In the `finally` block: `heartbeat.stop()`

- [ ] **Step 3: Test manually**

Run: `cd packages/worker && python src/agents/claude_visual_generator.py --help`
Expected: No import errors. Heartbeat class loads without starting (only starts in main()).

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/agents/claude_visual_generator.py
git commit -m "feat(worker): add HeartbeatEmitter to Python visual generator"
```

---

### Task 12: Wire SubprocessMonitor into generate-visuals

**Files:**
- Modify: `packages/worker/src/processors/generate-visuals/subprocess.ts`
- Modify: `packages/worker/src/processors/generate-visuals/index.ts`

- [ ] **Step 1: Update subprocess.ts to use SubprocessMonitor**

Add new function `runMonitoredClaudeGenerator` alongside existing `runClaudeCodeGenerator` (Phase 1 parallel deployment — both exist):

```typescript
import { SubprocessMonitor } from '../../monitor/subprocess-monitor.js';
import { progressStore } from '../../progress/progress-store.js';
import { VisualProgressMapper } from './visual-progress-mapper.js';
import type { CheckpointState } from '@viona/shared';

export async function runMonitoredClaudeGenerator(
  options: ClaudeCodeOptions
): Promise<ClaudeCodeResult> {
  const { projectId, jobId, ...rest } = options;
  const pythonPath = config.pythonPath;
  const agentScript = join(__dirname, '..', '..', 'agents', 'claude_visual_generator.py');
  const workspacePath = getWorkspacePath();
  const projectDir = join(workspacePath, 'src', projectId);

  const startTime = Date.now();

  // Build initial args (same as existing runClaudeCodeGenerator)
  const baseArgs = buildClaudeArgs(options, agentScript, workspacePath);

  const monitor = new SubprocessMonitor({
    jobId,
    workDir: projectDir,
    progressStore,
    heartbeatTimeoutSec: 60,
    healthCheckIntervalSec: 5,
    maxRetries: 1,
    buildRetryArgs: (checkpoint: CheckpointState) => {
      const retryArgs = [...baseArgs];
      // If plan is complete, skip Director
      if (checkpoint.phases.plan.status === 'complete') {
        retryArgs.push('--phase', 'animator');
      }
      // Pass completed scenes to skip
      if (checkpoint.phases.animate.scenesComplete.length > 0) {
        retryArgs.push('--skip-scenes', checkpoint.phases.animate.scenesComplete.join(','));
      }
      return retryArgs;
    },
    progressMapper: new VisualProgressMapper(),
  });

  // Register cancel handler
  registerCancelHandler(jobId, () => {
    // The monitor's abort signal handles this
  });

  const abortController = new AbortController();
  registerCancelHandler(jobId, () => abortController.abort());

  try {
    const result = await monitor.run(pythonPath, baseArgs, {
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
      },
    });

    if (result.exitCode !== 0) {
      throw new Error(`Claude Code generator exited with code ${result.exitCode}: ${result.stderr.slice(-500)}`);
    }

    // Parse result JSON from stdout (same logic as existing)
    const parsedResult = parseResultFromStdout(result.stdout);
    if (!parsedResult?.success) {
      throw new Error('Claude Code generator did not produce valid output');
    }

    return {
      bundleUrl: parsedResult.bundleUrl,
      bundlePath: parsedResult.bundlePath,
      filesWritten: parsedResult.filesWritten || 2,
      durationMs: Date.now() - startTime,
      status: 'completed',
    };
  } finally {
    unregisterCancelHandler(jobId);
    await progressStore.cleanup(jobId);
  }
}
```

Note: Extract the arg-building and result-parsing logic from `runClaudeCodeGenerator` into helper functions (`buildClaudeArgs`, `parseResultFromStdout`) so both the old and new paths can share them. Keep existing `runClaudeCodeGenerator` untouched for Phase 1.

- [ ] **Step 2: Update index.ts to use monitored generator**

In `packages/worker/src/processors/generate-visuals/index.ts`, replace:
```typescript
const claudeResult = await runClaudeCodeGenerator({...});
```
with:
```typescript
// Phase 1: Use monitored generator (old heartbeat-progress still runs as safety net)
const claudeResult = await runMonitoredClaudeGenerator({...});
```

Remove the `startHeartbeatProgress` call since SubprocessMonitor handles it now. Keep the import for Phase 1 but don't use it.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/worker && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/processors/generate-visuals/subprocess.ts packages/worker/src/processors/generate-visuals/index.ts
git commit -m "feat(worker): wire SubprocessMonitor into visual generation pipeline"
```

---

## Chunk 4: API Progress Relay + SSE Enhancement

### Task 13: ProgressRelay

**Files:**
- Create: `packages/api/src/progress/progress-relay.ts`

- [ ] **Step 1: Create progress-relay.ts**

```typescript
// packages/api/src/progress/progress-relay.ts

import type { ProgressState, HealthState, ActivityEvent } from '@viona/shared';
import { apiProgressStore } from './progress-store.js';

interface ProgressRelayConfig {
  jobId: string;
  sendSSE: (event: string, data: unknown) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
  jobType?: string;
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

  let highWaterMark = 0;

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
        // High-water mark: never regress
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
      // Activity callback
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

    // Also poll DB periodically as backup (in case Redis subscription fails)
    // This is the safety net — if Redis is down, we still detect completion via DB
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
    }, 10_000); // Check DB every 10s (not 2s like before — Redis is primary now)
    cleanups.push(() => clearInterval(dbPollInterval));
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/progress/progress-relay.ts
git commit -m "feat(api): add ProgressRelay — Redis subscription replaces DB polling"
```

---

### Task 14: Update agent-tools.ts to use ProgressRelay

**Files:**
- Modify: `packages/api/src/agent/agent-tools.ts`

- [ ] **Step 1: Add subscribeJobProgress alongside pollJobProgress**

Add new function after existing `pollJobProgress` (keep old for Phase 1 fallback):

```typescript
import { createProgressRelay } from '../progress/progress-relay.js';

/** New: Redis-subscription-based progress relay (replaces pollJobProgress) */
async function subscribeJobProgress(
  jobId: string,
  ctx: ToolContext,
  options?: { suppressJobId?: boolean; jobType?: string; initialPercent?: number },
): Promise<{ status: 'complete' | 'failed' | 'timeout' | 'aborted' }> {
  const sendJobId = options?.suppressJobId ? undefined : jobId;

  return createProgressRelay({
    jobId,
    sendSSE: (event, data) => {
      if (sendJobId === undefined && event === 'progress') {
        // Strip jobId from progress events when suppressed
        const d = data as Record<string, unknown>;
        delete d.jobId;
      }
      ctx.sendSSE(event, data);
    },
    signal: ctx.signal,
    jobType: options?.jobType,
  });
}
```

- [ ] **Step 2: Replace pollJobProgress calls with subscribeJobProgress**

In the `start_generation` and `edit_visuals` tool handlers, replace:
```typescript
const result = await pollJobProgress(jobId, ctx, { ... });
```
with:
```typescript
const result = await subscribeJobProgress(jobId, ctx, { ... });
```

Keep `pollJobProgress` function in the file (Phase 1 — can be deleted in Phase 3).

- [ ] **Step 3: Update SSE heartbeat in agent-router.ts**

In `packages/api/src/agent/agent-router.ts`, replace the heartbeat:

```typescript
// OLD:
const heartbeat = setInterval(() => {
  if (!sseStream.destroyed) sseStream.write(':\n\n');
}, 15_000);

// NEW:
const heartbeat = setInterval(() => {
  if (!sseStream.destroyed) {
    sendSSE('heartbeat', { ts: Date.now() });
  }
}, 10_000);
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/agent/agent-tools.ts packages/api/src/agent/agent-router.ts
git commit -m "feat(api): replace DB-polling pollJobProgress with Redis-based subscribeJobProgress"
```

---

### Task 15: Activity endpoint + WebSocket updates

**Files:**
- Modify: `packages/api/src/routes/jobs.ts`
- Modify: `packages/api/src/ws/handler.ts`

- [ ] **Step 1: Add GET /api/jobs/:id/activity endpoint**

Add to existing jobs route file:

```typescript
import { apiProgressStore } from '../progress/progress-store.js';

// GET /api/jobs/:id/activity
fastify.get<{ Params: { id: string } }>('/:id/activity', async (request, reply) => {
  const { id } = request.params;
  const [activity, progress] = await Promise.all([
    apiProgressStore.getActivity(id),
    apiProgressStore.get(id),
  ]);
  return { activity, progress };
});
```

- [ ] **Step 2: Update WebSocket handler to forward new event types**

The WebSocket handler already forwards all Redis messages via `psubscribe('job:*:*')`. The new `job:{id}:health` channel is automatically matched. No code changes needed — verify by reading the handler to confirm the pattern match works:

The existing `pmessage` handler checks:
- `channel.includes(':progress')` → matches `job:{id}:progress` ✅
- `channel.includes(':health')` → need to add this mapping

Add to `ws/handler.ts` message type detection:

```typescript
} else if (channel.includes(':health')) {
  type = 'job:health';
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routes/jobs.ts packages/api/src/ws/handler.ts
git commit -m "feat(api): add activity endpoint + WebSocket health event forwarding"
```

---

## Chunk 5: Frontend Progress UX

### Task 16: use-smooth-progress hook

**Files:**
- Create: `apps/web/src/features/editor-v2/hooks/use-smooth-progress.ts`

- [ ] **Step 1: Create use-smooth-progress.ts**

```typescript
// apps/web/src/features/editor-v2/hooks/use-smooth-progress.ts

import { useRef, useState, useEffect, useCallback } from 'react';

interface SmoothProgressOptions {
  /** Target percent (raw from server) */
  targetPercent: number;
  /** Is the job actively running? */
  isActive: boolean;
  /** Interpolation speed (0-1, higher = faster) */
  speed?: number;
  /** Creep rate per second between updates (percent) */
  creepRate?: number;
  /** Maximum creep above target before next real update */
  maxCreepAhead?: number;
}

interface SmoothProgressResult {
  /** Smoothed display percent */
  displayPercent: number;
  /** True when creeping between real updates */
  isCreeping: boolean;
}

/**
 * Smooth progress animation hook.
 * - Interpolates between checkpoints (800ms ease-out)
 * - Creeps forward slowly between updates (0.1%/sec)
 * - Never exceeds target + maxCreepAhead
 * - Resets to 0 when not active
 */
export function useSmoothProgress(options: SmoothProgressOptions): SmoothProgressResult {
  const {
    targetPercent,
    isActive,
    speed = 0.08,
    creepRate = 0.1,
    maxCreepAhead = 3,
  } = options;

  const [displayPercent, setDisplayPercent] = useState(0);
  const currentRef = useRef(0);
  const lastUpdateRef = useRef(Date.now());
  const animFrameRef = useRef<number | null>(null);
  const isCreepingRef = useRef(false);

  useEffect(() => {
    if (!isActive) {
      currentRef.current = 0;
      setDisplayPercent(0);
      return;
    }

    lastUpdateRef.current = Date.now();

    const animate = () => {
      const now = Date.now();
      const target = targetPercent;
      const current = currentRef.current;

      // Ease toward target
      const diff = target - current;
      if (Math.abs(diff) > 0.1) {
        currentRef.current += diff * speed;
        isCreepingRef.current = false;
      } else {
        // At target — creep forward slowly
        const elapsedSec = (now - lastUpdateRef.current) / 1000;
        const creep = elapsedSec * creepRate;
        const maxPercent = Math.min(target + maxCreepAhead, 99);
        currentRef.current = Math.min(current + creep * 0.016, maxPercent); // 0.016 = ~1 frame at 60fps
        isCreepingRef.current = true;
      }

      setDisplayPercent(Math.min(Math.round(currentRef.current * 10) / 10, 100));
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isActive, targetPercent, speed, creepRate, maxCreepAhead]);

  // Snap to 100 on completion
  useEffect(() => {
    if (targetPercent >= 100) {
      currentRef.current = 100;
      setDisplayPercent(100);
    }
  }, [targetPercent]);

  return {
    displayPercent,
    isCreeping: isCreepingRef.current,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/hooks/use-smooth-progress.ts
git commit -m "feat(web): add use-smooth-progress hook with interpolation + creep"
```

---

### Task 17: use-progress hook (merge SSE + WS + HTTP)

**Files:**
- Create: `apps/web/src/features/editor-v2/hooks/use-progress.ts`

- [ ] **Step 1: Create use-progress.ts**

```typescript
// apps/web/src/features/editor-v2/hooks/use-progress.ts

import { useState, useRef, useCallback } from 'react';
import type { ProgressState, HealthState, ActivityEvent } from '@viona/shared';

type ProgressSource = 'sse' | 'ws' | 'http' | null;

interface UseProgressResult {
  progress: ProgressState | null;
  health: HealthState | null;
  activity: ActivityEvent[];
  source: ProgressSource;
  /** Call from SSE handler */
  onSSEProgress: (data: Record<string, unknown>) => void;
  /** Call from SSE handler for activity events */
  onSSEActivity: (data: Record<string, unknown>) => void;
  /** Call from SSE handler for health events */
  onSSEHealth: (data: Record<string, unknown>) => void;
  /** Call from WebSocket handler */
  onWSProgress: (data: Record<string, unknown>) => void;
  /** Call from WebSocket handler */
  onWSHealth: (data: Record<string, unknown>) => void;
  /** Call from HTTP poll */
  onHTTPProgress: (data: Record<string, unknown>) => void;
  /** Reset all state (e.g., job complete) */
  reset: () => void;
}

/**
 * Merges progress from SSE, WebSocket, and HTTP polling into a single state.
 * Priority: SSE > WebSocket > HTTP. High-water mark prevents regression.
 */
export function useProgress(): UseProgressResult {
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [health, setHealth] = useState<HealthState | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [source, setSource] = useState<ProgressSource>(null);
  const highWaterRef = useRef(0);
  const sourceRef = useRef<ProgressSource>(null);

  const updateProgress = useCallback((data: Record<string, unknown>, src: ProgressSource) => {
    // SSE takes priority over WS, which takes priority over HTTP
    const priority: Record<string, number> = { sse: 3, ws: 2, http: 1 };
    const currentPriority = priority[sourceRef.current ?? ''] ?? 0;
    const newPriority = priority[src ?? ''] ?? 0;

    // Only accept if same or higher priority source
    if (newPriority < currentPriority) return;

    const percent = Math.max(
      (data.percent as number) ?? 0,
      highWaterRef.current,
    );
    highWaterRef.current = percent;

    sourceRef.current = src;
    setSource(src);
    setProgress({
      percent,
      message: (data.message as string) || 'Processing...',
      phase: (data.phase as string) || 'unknown',
      phaseName: (data.phaseName as string) || 'Processing',
      detail: (data.detail as string) || undefined,
      updatedAt: Date.now(),
      meta: (data.meta as Record<string, unknown>) || undefined,
    });
  }, []);

  const onSSEProgress = useCallback((data: Record<string, unknown>) => updateProgress(data, 'sse'), [updateProgress]);
  const onWSProgress = useCallback((data: Record<string, unknown>) => updateProgress(data, 'ws'), [updateProgress]);
  const onHTTPProgress = useCallback((data: Record<string, unknown>) => updateProgress(data, 'http'), [updateProgress]);

  const onSSEActivity = useCallback((data: Record<string, unknown>) => {
    const event = data as unknown as ActivityEvent;
    setActivity((prev) => [...prev.slice(-99), event]); // Cap at 100
  }, []);

  const onSSEHealth = useCallback((data: Record<string, unknown>) => {
    setHealth(data as unknown as HealthState);
  }, []);

  const onWSHealth = useCallback((data: Record<string, unknown>) => {
    setHealth(data as unknown as HealthState);
  }, []);

  const reset = useCallback(() => {
    setProgress(null);
    setHealth(null);
    setActivity([]);
    setSource(null);
    sourceRef.current = null;
    highWaterRef.current = 0;
  }, []);

  return {
    progress,
    health,
    activity,
    source,
    onSSEProgress,
    onSSEActivity,
    onSSEHealth,
    onWSProgress,
    onWSHealth,
    onHTTPProgress,
    reset,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/hooks/use-progress.ts
git commit -m "feat(web): add use-progress hook — merges SSE + WS + HTTP with priority"
```

---

### Task 18: ProgressBar component

**Files:**
- Create: `apps/web/src/features/editor-v2/components/ProgressBar.tsx`

- [ ] **Step 1: Create ProgressBar.tsx**

```tsx
// apps/web/src/features/editor-v2/components/ProgressBar.tsx

import React from 'react';
import { useSmoothProgress } from '../hooks/use-smooth-progress';

interface ProgressBarProps {
  percent: number;
  phase: string;
  phaseName: string;
  detail?: string;
  isActive: boolean;
  error?: boolean;
}

const PHASE_ORDER = ['plan', 'animate', 'verify', 'bundle', 'upload', 'done'];
const PHASE_LABELS: Record<string, string> = {
  plan: 'Plan',
  animate: 'Animate',
  verify: 'Verify',
  bundle: 'Bundle',
  upload: 'Upload',
  done: 'Done',
};

/**
 * Smooth-animated progress bar with shimmer effect and phase timeline.
 * Always feels alive — interpolates between checkpoints and creeps forward.
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  percent,
  phase,
  phaseName,
  detail,
  isActive,
  error,
}) => {
  const { displayPercent } = useSmoothProgress({
    targetPercent: percent,
    isActive,
  });

  const barColor = error
    ? 'rgb(239, 68, 68)'       // red-500
    : phase === 'done'
      ? 'rgb(34, 197, 94)'     // green-500
      : 'rgb(99, 102, 241)';   // indigo-500

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0' }}>
      {/* Progress bar */}
      <div style={{
        position: 'relative',
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
      }}>
        {/* Filled portion */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${displayPercent}%`,
          backgroundColor: barColor,
          borderRadius: 3,
          transition: 'background-color 300ms ease',
        }}>
          {/* Shimmer effect — only when active */}
          {isActive && !error && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)`,
              animation: 'shimmer 2s infinite',
            }} />
          )}
        </div>
      </div>

      {/* Phase text + percent */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 12,
        color: error ? 'rgb(239, 68, 68)' : 'rgba(255, 255, 255, 0.6)',
      }}>
        <span>
          {phaseName}
          {detail ? ` — ${detail}` : ''}
        </span>
        <span>{Math.round(displayPercent)}%</span>
      </div>

      {/* Phase timeline */}
      <div style={{
        display: 'flex',
        gap: 4,
        alignItems: 'center',
        fontSize: 10,
        color: 'rgba(255, 255, 255, 0.4)',
      }}>
        {PHASE_ORDER.filter(p => p !== 'done').map((p, i) => {
          const phaseIdx = PHASE_ORDER.indexOf(phase);
          const thisIdx = PHASE_ORDER.indexOf(p);
          const isComplete = thisIdx < phaseIdx || phase === 'done';
          const isCurrent = p === phase;

          return (
            <React.Fragment key={p}>
              {i > 0 && (
                <div style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: isComplete ? barColor : 'rgba(255, 255, 255, 0.1)',
                }} />
              )}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                color: isComplete
                  ? barColor
                  : isCurrent
                    ? 'rgba(255, 255, 255, 0.8)'
                    : 'rgba(255, 255, 255, 0.3)',
                fontWeight: isCurrent ? 600 : 400,
              }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: isComplete
                    ? barColor
                    : isCurrent
                      ? 'rgba(255, 255, 255, 0.8)'
                      : 'rgba(255, 255, 255, 0.15)',
                  ...(isCurrent && !error ? { animation: 'pulse 2s infinite' } : {}),
                }} />
                {PHASE_LABELS[p]}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* CSS animations (injected via style tag — simple, no build dep) */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/components/ProgressBar.tsx
git commit -m "feat(web): add ProgressBar with smooth animation, shimmer, and phase timeline"
```

---

### Task 19: ActivityLog + HealthIndicator components

**Files:**
- Create: `apps/web/src/features/editor-v2/components/ActivityLog.tsx`
- Create: `apps/web/src/features/editor-v2/components/HealthIndicator.tsx`

- [ ] **Step 1: Create ActivityLog.tsx**

```tsx
// apps/web/src/features/editor-v2/components/ActivityLog.tsx

import React, { useState } from 'react';
import type { ActivityEvent } from '@viona/shared';

interface ActivityLogProps {
  events: ActivityEvent[];
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ events }) => {
  const [expanded, setExpanded] = useState(false);

  if (events.length === 0) return null;

  return (
    <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.5)' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255, 255, 255, 0.5)',
          cursor: 'pointer',
          padding: '4px 0',
          fontSize: 11,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span style={{
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 150ms ease',
          display: 'inline-block',
        }}>
          ▶
        </span>
        Activity Log ({events.length})
      </button>

      {expanded && (
        <div style={{
          maxHeight: 200,
          overflowY: 'auto',
          paddingLeft: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          {events.map((event, i) => {
            const time = new Date(event.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
            const icon = event.type === 'error' ? '✗' :
                         event.type === 'health' ? '⚡' :
                         event.type === 'phase' ? '●' : '✓';
            const color = event.type === 'error' ? 'rgb(239, 68, 68)' :
                          event.type === 'health' ? 'rgb(250, 204, 21)' :
                          'rgba(255, 255, 255, 0.4)';

            return (
              <div key={i} style={{ display: 'flex', gap: 8, color }}>
                <span style={{ opacity: 0.6, flexShrink: 0 }}>{time}</span>
                <span style={{ flexShrink: 0 }}>{icon}</span>
                <span>{event.detail}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Create HealthIndicator.tsx**

```tsx
// apps/web/src/features/editor-v2/components/HealthIndicator.tsx

import React from 'react';
import type { HealthState } from '@viona/shared';

interface HealthIndicatorProps {
  health: HealthState | null;
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
  isActive: boolean;
}

export const HealthIndicator: React.FC<HealthIndicatorProps> = ({
  health,
  connectionStatus,
  isActive,
}) => {
  if (!isActive) return null;

  let color: string;
  let label: string;

  if (connectionStatus === 'disconnected') {
    color = 'rgb(250, 204, 21)'; // yellow
    label = 'Reconnecting...';
  } else if (connectionStatus === 'reconnecting') {
    color = 'rgb(251, 146, 60)'; // orange
    label = 'Reconnecting...';
  } else if (!health) {
    color = 'rgb(34, 197, 94)';  // green
    label = 'Connected';
  } else if (!health.processAlive && health.retriesUsed >= health.retriesMax) {
    color = 'rgb(239, 68, 68)';  // red
    label = 'Process failed';
  } else if (!health.processAlive && health.retriesUsed < health.retriesMax) {
    color = 'rgb(251, 146, 60)'; // orange
    label = `Restarting (attempt ${health.retriesUsed + 1})...`;
  } else {
    const msSinceHeartbeat = Date.now() - health.lastHeartbeat;
    if (msSinceHeartbeat > 30_000) {
      color = 'rgb(250, 204, 21)'; // yellow
      label = 'Waiting on AI response...';
    } else {
      color = 'rgb(34, 197, 94)';  // green
      label = 'Agent working';
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 11,
      color: 'rgba(255, 255, 255, 0.5)',
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: color,
        animation: connectionStatus === 'reconnecting' ? 'pulse 1s infinite' : undefined,
      }} />
      {label}
    </div>
  );
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/components/ActivityLog.tsx apps/web/src/features/editor-v2/components/HealthIndicator.tsx
git commit -m "feat(web): add ActivityLog and HealthIndicator components"
```

---

### Task 20: Integrate new components into AIAssistantPanel

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx`
- Modify: `apps/web/src/features/editor-v2/hooks/use-job-websocket.ts`
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Add getJobActivity to api.ts**

Add to the API client:

```typescript
async getJobActivity(jobId: string): Promise<{ activity: any[]; progress: any }> {
  const res = await this.fetch(`/api/jobs/${jobId}/activity`);
  return res.json();
},
```

- [ ] **Step 2: Update use-job-websocket to handle new event types**

Add `job:health` and `job:activity` handling to the switch statement:

```typescript
case 'job:health':
  handlersRef.current.onHealth?.(payload);
  break;
case 'job:activity':
  handlersRef.current.onActivity?.(payload);
  break;
```

Add to `MessageHandler` type:
```typescript
onHealth?: (data: HealthState) => void;
onActivity?: (data: ActivityEvent) => void;
```

- [ ] **Step 3: Wire useProgress hook into AIAssistantPanel**

Import and use the new hooks:
```typescript
import { useProgress } from '../hooks/use-progress';
import { ProgressBar } from './ProgressBar';
import { ActivityLog } from './ActivityLog';
import { HealthIndicator } from './HealthIndicator';
```

In the component:
```typescript
const progressState = useProgress();
```

Wire SSE handler to call `progressState.onSSEProgress()` on `progress` events, `progressState.onSSEActivity()` on `activity` events, `progressState.onSSEHealth()` on `health` events.

Wire WebSocket handlers similarly.

Replace old progress block rendering in the message list with the new `<ProgressBar>`, `<ActivityLog>`, and `<HealthIndicator>` components.

Remove old `stallState`, `slowThreshold`, `stuckThreshold` logic — replaced by `HealthIndicator` which reads actual process health.

- [ ] **Step 4: Verify frontend builds**

Run: `cd apps/web && pnpm build`
Expected: Clean build

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx apps/web/src/features/editor-v2/hooks/use-job-websocket.ts apps/web/src/lib/api.ts
git commit -m "feat(web): integrate ProgressBar, ActivityLog, HealthIndicator into AIAssistantPanel"
```

---

## Chunk 6: Cleanup + index.ts fix

### Task 21: Fix workspace index.ts JSX bug (from earlier session)

**Files:**
- Modify: `packages/worker/src/processors/generate-visuals/index.ts`

- [ ] **Step 1: Fix index.ts JSX write (line 246)**

The `processGenerateVisualsJob` function writes JSX to `src/index.ts` (a `.ts` file). esbuild can't parse JSX in `.ts` files. Change the file path from `index.ts` to `index.tsx`:

```typescript
// OLD (line 224):
const indexTs = join(workspacePath, 'src', 'index.ts');

// NEW:
const indexTsx = join(workspacePath, 'src', 'index.tsx');
```

Update the `writeFile` call on line 246 to use `indexTsx` instead of `indexTs`.

Also add cleanup of stale `.ts` file:
```typescript
// Remove old .ts if it exists (template ships index.ts, we write index.tsx)
const oldIndexTs = join(workspacePath, 'src', 'index.ts');
try { await rm(oldIndexTs, { force: true }); } catch { /* may not exist */ }
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/src/processors/generate-visuals/index.ts
git commit -m "fix(worker): write JSX entry point as index.tsx, not index.ts (esbuild compat)"
```

---

### Task 22: Build shared package + verify full pipeline

- [ ] **Step 1: Build @viona/shared**

Run: `cd packages/shared && pnpm build`
Expected: Clean build with `dist/progress-types.d.ts`

- [ ] **Step 2: Verify worker compiles**

Run: `cd packages/worker && npx tsc --noEmit`

- [ ] **Step 3: Verify API compiles**

Run: `cd packages/api && npx tsc --noEmit`

- [ ] **Step 4: Verify frontend builds**

Run: `cd apps/web && pnpm build`

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: verify full pipeline compiles with new progress system"
```

---

## Phase 3 Cleanup (separate future task)

After validating in production for 1-2 days:

- [ ] Delete `packages/worker/src/utils/heartbeat-progress.ts`
- [ ] Delete `pollJobProgress` from `packages/api/src/agent/agent-tools.ts`
- [ ] Delete old `publishJobProgress` from `packages/api/src/services/redis.ts`
- [ ] Remove old stall detection (`stallState`, `slowThreshold`, `stuckThreshold`) from `AIAssistantPanel.tsx`
- [ ] Remove old progress block rendering from message list
