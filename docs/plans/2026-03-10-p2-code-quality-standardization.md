# P2: Code Quality & Standardization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize code patterns for long-term maintainability — eliminate type duplication across packages, reduce `any` types at API boundaries, extract subprocess boilerplate into shared helper, cap WebSocket reconnection, cap SSE event buffer memory, and add missing DB indexes on hot query paths.

**Architecture:** Changes span all 3 packages. Tasks are independent. The shared types task should ideally be done first since other packages reference the shared types, but each task can be done standalone. No data migrations needed — only additive schema changes (indexes).

**Tech Stack:** TypeScript, Zod, BullMQ, pg, Drizzle ORM, React

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/shared/src/queue-types.ts` | Create | Shared queue job data types + Zod schemas |
| `packages/shared/src/index.ts` | Modify | Re-export new module |
| `packages/api/src/services/queue.ts` | Modify | Import shared types, remove duplicates |
| `packages/worker/src/processors/generate-visuals/types.ts` | Modify | Import shared types |
| `apps/web/src/lib/api.ts` | Modify | Import shared types, remove duplicates, remove `any` from renderProject |
| `packages/worker/src/utils/subprocess.ts` | Create | Shared subprocess spawn helper |
| `packages/worker/src/processors/plan-visuals.ts` | Modify | Use subprocess helper |
| `packages/worker/src/processors/head-tracking.ts` | Modify | Use subprocess helper |
| `packages/api/src/agent/agent-router.ts` | Modify | Cap event buffer memory |
| `apps/web/src/lib/ws.ts` | Modify | Add max backoff cap to WebSocket reconnect |
| `packages/api/drizzle/0020_add_hot_path_indexes.sql` | Create | Missing indexes on frequently-queried columns |

---

### Task 1: Create Shared Queue Types Package

**Files:**
- Create: `packages/shared/src/queue-types.ts`
- Modify: `packages/shared/src/index.ts`

**Why:** `VisualsLayoutMode`, `VisualsDimensions`, and `GenerateVisualsJobData` are defined in 3 places (API queue service, Worker types, Web API client). When fields are added to one, the others silently diverge.

- [ ] **Step 1: Create the shared queue types**

```typescript
// packages/shared/src/queue-types.ts

import { z } from 'zod';

// ---- Shared Layout Types ----

export type VisualsLayoutMode = 'pip' | 'stacked';

export const visualsDimensionsSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type VisualsDimensions = z.infer<typeof visualsDimensionsSchema>;

// ---- Style Preset ----

export type StylePreset = string;

// ---- Job Data Types ----

export const generateVisualsOptionsSchema = z.object({
  stylePreset: z.string().min(1),
  layoutMode: z.enum(['pip', 'stacked']),
  dimensions: visualsDimensionsSchema,
  styleGuide: z.string().optional(),
});
export type GenerateVisualsOptions = z.infer<typeof generateVisualsOptionsSchema>;

export interface GenerateVisualsJobData extends GenerateVisualsOptions {
  projectId: string;
  jobId: string;
  pipEffective?: VisualsDimensions;
  planJobId?: string;
  selectedVideos?: Record<number, Record<string, unknown>>;
  /** Enable verbose logging for debugging */
  verbose?: boolean;
}

export interface PlanVisualsJobData {
  projectId: string;
  jobId: string;
  stylePreset: string;
  layoutMode: VisualsLayoutMode;
  dimensions: VisualsDimensions;
  pipEffective?: VisualsDimensions;
  styleGuide?: string;
  sourceWidth?: number;
  sourceHeight?: number;
}

export interface EditVisualsJobData {
  projectId: string;
  jobId: string;
  compositionId: string;
  prompt: string;
  sceneId?: number;
  elementName?: string;
  transcript?: string;
  scenePlan?: string;
}

// ---- Layout Settings (for render) ----

export const pipSettingsSchema = z.object({
  position: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']),
  offsetX: z.number(),
  offsetY: z.number(),
  size: z.enum(['small', 'medium', 'large', 'custom']),
  customSize: z.number(),
  shape: z.enum(['square', 'circle', 'rounded']),
  borderRadius: z.number(),
  borderWidth: z.number(),
  borderColor: z.string(),
  shadowEnabled: z.boolean(),
  shadowColor: z.string(),
  shadowBlur: z.number(),
  opacity: z.number(),
});

export const splitSettingsSchema = z.object({
  position: z.enum(['visuals-first', 'video-first']),
  ratio: z.number(),
  gap: z.number(),
});

export const layoutSettingsSchema = z.object({
  mode: z.enum(['pip', 'stacked']),
  pip: pipSettingsSchema,
  split: splitSettingsSchema,
});
export type LayoutSettings = z.infer<typeof layoutSettingsSchema>;

export const renderOptionsSchema = z.object({
  layoutSettings: layoutSettingsSchema.optional(),
  fullscreenSegments: z.array(z.object({
    startMs: z.number(),
    endMs: z.number(),
  })).optional(),
  visualDisplayData: z.array(z.object({
    startMs: z.number(),
    endMs: z.number(),
    displayMode: z.string().optional(),
    transition: z.object({
      enter: z.object({ type: z.string(), durationMs: z.number() }),
      exit: z.object({ type: z.string(), durationMs: z.number() }),
    }).optional(),
    overlayOpacity: z.number().optional(),
  })).optional(),
});
export type RenderOptions = z.infer<typeof renderOptionsSchema>;
```

- [ ] **Step 2: Add zod dependency to shared package**

Check if zod is already a dependency. If not:
```bash
cd packages/shared && pnpm add zod
```

- [ ] **Step 3: Re-export from shared index**

In `packages/shared/src/index.ts`, add:
```typescript
export * from './queue-types';
```

- [ ] **Step 4: Update shared package.json exports**

In `packages/shared/package.json`, add to the `exports` field:
```json
    "./queue-types": {
      "types": "./dist/queue-types.d.ts",
      "import": "./dist/queue-types.mjs",
      "require": "./dist/queue-types.js"
    }
```

- [ ] **Step 5: Build shared package**
```bash
pnpm --filter @viona/shared build
```

- [ ] **Step 6: Commit**
```bash
git add packages/shared/
git commit -m "feat(shared): add shared queue job data types with Zod schemas"
```

---

### Task 2: Consume Shared Types in API Queue Service

**Files:**
- Modify: `packages/api/src/services/queue.ts`

**Why:** Remove duplicate type definitions that now live in `@viona/shared`.

- [ ] **Step 1: Replace local types with shared imports**

At the top of `packages/api/src/services/queue.ts`, add:
```typescript
import type {
  VisualsLayoutMode,
  VisualsDimensions,
  GenerateVisualsJobData,
  PlanVisualsJobData,
  EditVisualsJobData,
  LayoutSettings,
} from '@viona/shared';
```

- [ ] **Step 2: Remove the local type definitions**

Delete these local definitions from the file (they now come from shared):
- `VisualsLayoutMode` (line 104)
- `VisualsDimensions` (lines 106-109)
- `GenerateVisualsJobData` (lines 119-131)
- `PlanVisualsJobData` (lines 142-153)
- `EditVisualsJobData` (lines 165-174)

Keep queue-specific types that don't need to be shared (e.g., `TranscribeJobData`, `RenderJobData`, `SvgAnimationJobData`).

For `RenderJobData`, replace the inline `layoutSettings` type with the shared `LayoutSettings`:
```typescript
export interface RenderJobData {
  projectId: string;
  jobId: string;
  projectType?: string;
  layoutSettings?: LayoutSettings;
  // ... rest stays the same
}
```

- [ ] **Step 3: Verify** — `pnpm --filter @viona/api build` passes.

- [ ] **Step 4: Commit**
```bash
git add packages/api/src/services/queue.ts
git commit -m "refactor(api): use shared queue types from @viona/shared, remove duplicates"
```

---

### Task 3: Remove `any` from renderProject and Web API Client

**Files:**
- Modify: `apps/web/src/lib/api.ts`

**Why:** `renderProject` has `layoutSettings?: any` — the only `any` at the API boundary. Also, several types duplicated from queue service can be imported from shared.

- [ ] **Step 1: Add shared import**

```typescript
import type {
  VisualsLayoutMode,
  VisualsDimensions,
  StylePreset,
  RenderOptions,
} from '@viona/shared';
```

- [ ] **Step 2: Fix renderProject signature**

Replace (around line 348):
```typescript
// Before:
async renderProject(projectId: string, options?: { layoutSettings?: any; fullscreenSegments?: Array<{ startMs: number; endMs: number }>; visualDisplayData?: Array<{ startMs: number; endMs: number; displayMode?: string; transition?: { enter: { type: string; durationMs: number }; exit: { type: string; durationMs: number } } }> }): Promise<ProcessProjectResponse> {

// After:
async renderProject(projectId: string, options?: RenderOptions): Promise<ProcessProjectResponse> {
```

- [ ] **Step 3: Remove local duplicate type definitions**

Remove these from the file (now imported from shared):
- `StylePreset` (line 134)
- `VisualsLayoutMode` (line 136)
- `VisualsDimensions` (lines 138-141)
- `GenerateVisualsOptions` (lines 143-148) — replace with shared import

- [ ] **Step 4: Verify** — `pnpm --filter @viona/web build` passes (or equivalent filter name).

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/lib/api.ts
git commit -m "refactor(web): use shared types, remove any from renderProject"
```

---

### Task 4: Create Shared Subprocess Helper for Worker

**Files:**
- Create: `packages/worker/src/utils/subprocess.ts`

**Why:** The spawn + timeout + stderr collection + SIGTERM→SIGKILL escalation pattern is duplicated across `subprocess.ts`, `plan-visuals.ts`, and `head-tracking.ts` (250+ lines of identical boilerplate). Bug fixes in one copy are missed in others.

- [ ] **Step 1: Create the helper**

```typescript
// packages/worker/src/utils/subprocess.ts

import { spawn, type ChildProcess, type SpawnOptions } from 'child_process';
import { logger } from '../logger.js';

export interface SubprocessResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface SubprocessOptions {
  /** Command to run */
  command: string;
  /** Arguments */
  args: string[];
  /** Spawn options (cwd, env, etc.) */
  spawnOptions?: SpawnOptions;
  /** Timeout in ms (default: 5 minutes) */
  timeoutMs?: number;
  /** Max bytes of stdout/stderr to buffer (default: 10MB) */
  maxOutputBytes?: number;
  /** Name for logging (e.g. "ffmpeg", "python") */
  name?: string;
  /** Callback for each stdout line (for progress parsing) */
  onStdoutLine?: (line: string) => void;
  /** Callback for each stderr line */
  onStderrLine?: (line: string) => void;
  /** AbortSignal for external cancellation */
  signal?: AbortSignal;
}

/**
 * Spawn a subprocess with timeout, graceful kill escalation, and output buffering.
 *
 * On timeout or abort:
 *   1. SIGTERM → wait 10s
 *   2. SIGKILL → wait 5s
 *   3. Log error if still alive
 *
 * Returns stdout/stderr on success. Throws on non-zero exit or timeout.
 */
export function runSubprocess(options: SubprocessOptions): Promise<SubprocessResult> {
  const {
    command,
    args,
    spawnOptions = {},
    timeoutMs = 5 * 60 * 1000,
    maxOutputBytes = 10 * 1024 * 1024,
    name = command,
    onStdoutLine,
    onStderrLine,
    signal,
  } = options;

  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      ...spawnOptions,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let killed = false;
    let settled = false;

    // Handle abort signal
    const abortHandler = () => {
      if (!settled) killGracefully(`abort signal`);
    };
    signal?.addEventListener('abort', abortHandler, { once: true });

    // Timeout
    const timer = setTimeout(() => {
      if (!settled) killGracefully(`timeout (${timeoutMs / 1000}s)`);
    }, timeoutMs);

    function killGracefully(reason: string) {
      if (killed) return;
      killed = true;
      logger.warn({ name, pid: proc.pid, reason }, `Killing subprocess: ${reason}`);

      proc.kill('SIGTERM');
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGKILL');
          setTimeout(() => {
            if (!proc.killed) {
              logger.error({ name, pid: proc.pid }, 'Subprocess survived SIGKILL');
            }
          }, 5000);
        }
      }, 10_000);
    }

    // Buffer stdout
    proc.stdout?.on('data', (chunk: Buffer) => {
      const str = chunk.toString();
      if (stdoutBytes < maxOutputBytes) {
        stdout += str;
        stdoutBytes += chunk.length;
      }
      if (onStdoutLine) {
        for (const line of str.split('\n')) {
          if (line.trim()) onStdoutLine(line);
        }
      }
    });

    // Buffer stderr
    proc.stderr?.on('data', (chunk: Buffer) => {
      const str = chunk.toString();
      if (stderrBytes < maxOutputBytes) {
        stderr += str;
        stderrBytes += chunk.length;
      }
      if (onStderrLine) {
        for (const line of str.split('\n')) {
          if (line.trim()) onStderrLine(line);
        }
      }
    });

    proc.on('error', (err) => {
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abortHandler);
      reject(new Error(`${name} failed to spawn: ${err.message}`));
    });

    proc.on('close', (code) => {
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abortHandler);

      const exitCode = code ?? 1;

      if (killed) {
        reject(new Error(`${name} was killed (${exitCode}): ${stderr.slice(-500)}`));
        return;
      }

      if (exitCode !== 0) {
        reject(new Error(`${name} exited with code ${exitCode}: ${stderr.slice(-500)}`));
        return;
      }

      resolve({ code: exitCode, stdout, stderr });
    });
  });
}
```

- [ ] **Step 2: Commit**
```bash
git add packages/worker/src/utils/subprocess.ts
git commit -m "feat(worker): add shared subprocess helper with timeout and kill escalation"
```

---

### Task 5: Adopt Subprocess Helper in head-tracking Processor

**Files:**
- Modify: `packages/worker/src/processors/head-tracking.ts`

**Why:** Demonstrate the helper on the simplest subprocess call site. The `head-tracking.ts` processor spawns a Python script with manual timeout/kill logic that can be replaced with `runSubprocess()`.

- [ ] **Step 1: Import the helper**

```typescript
import { runSubprocess } from '../utils/subprocess.js';
```

- [ ] **Step 2: Replace the manual spawn + timeout block**

Find the section where `spawn(pythonPath, args, ...)` is called with manual timeout handling. Replace with:

```typescript
const result = await runSubprocess({
  command: pythonPath,
  args,
  spawnOptions: { cwd: workDir, env: { ...process.env } },
  timeoutMs: 5 * 60 * 1000,
  name: 'head-tracking',
  onStderrLine: (line) => {
    // Parse progress if the Python script outputs it
    logger.debug({ line }, 'head-tracking stderr');
  },
});
```

Remove the manual `setTimeout`, `proc.kill('SIGTERM')`, and `proc.kill('SIGKILL')` blocks that this replaces.

- [ ] **Step 3: Verify** — `pnpm --filter @viona/worker build` passes.

- [ ] **Step 4: Commit**
```bash
git add packages/worker/src/processors/head-tracking.ts
git commit -m "refactor(worker): use shared subprocess helper in head-tracking processor"
```

---

### Task 6: Cap WebSocket Reconnection Backoff

**Files:**
- Modify: `apps/web/src/lib/ws.ts`

**Why:** Current exponential backoff has no cap. After 5 failed attempts: 1s, 2s, 4s, 8s, 16s. If we increase `maxReconnectAttempts`, the delay grows unbounded (32s, 64s, 128s...). Add a max backoff of 10 seconds.

- [ ] **Step 1: Cap the reconnect delay (line 136)**

```typescript
// Before:
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

// After:
        const delay = Math.min(
          this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
          10_000, // Cap at 10 seconds
        );
```

- [ ] **Step 2: Increase max attempts from 5 to 10**

```typescript
// Before (line 86):
  private maxReconnectAttempts = 5;

// After:
  private maxReconnectAttempts = 10;
```

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/lib/ws.ts
git commit -m "fix(web): cap WebSocket reconnect backoff at 10s, increase max attempts to 10"
```

---

### Task 7: Cap Agent Event Buffer Memory

**Files:**
- Modify: `packages/api/src/agent/agent-router.ts`

**Why:** `projectEventBuffers` Map grows unbounded — one buffer per project per SSE connection. The sweep runs every 5 minutes but active projects never get cleaned. With 50 concurrent users, this accumulates indefinitely.

- [ ] **Step 1: Add a max buffer count to the sweep (around line 31)**

```typescript
// Before:
setInterval(() => {
  const now = Date.now();
  for (const [key, buffer] of projectEventBuffers) {
    if (now - buffer.lastUpdated > 5 * 60 * 1000) {
      projectEventBuffers.delete(key);
    }
  }
}, 5 * 60 * 1000);

// After:
const MAX_EVENT_BUFFERS = 200; // Safety cap — at 50 users, max ~50 active
setInterval(() => {
  const now = Date.now();
  // Remove stale buffers
  for (const [key, buffer] of projectEventBuffers) {
    if (now - buffer.lastUpdated > 5 * 60 * 1000) {
      projectEventBuffers.delete(key);
    }
  }
  // If still over cap, evict oldest
  if (projectEventBuffers.size > MAX_EVENT_BUFFERS) {
    const sorted = [...projectEventBuffers.entries()]
      .sort((a, b) => a[1].lastUpdated - b[1].lastUpdated);
    const toRemove = sorted.slice(0, sorted.length - MAX_EVENT_BUFFERS);
    for (const [key] of toRemove) {
      projectEventBuffers.delete(key);
    }
  }
}, 60 * 1000); // Run every minute instead of every 5 minutes
```

- [ ] **Step 2: Commit**
```bash
git add packages/api/src/agent/agent-router.ts
git commit -m "fix(api): cap event buffer memory with max count and faster sweep"
```

---

### Task 8: Add Missing Database Indexes

**Files:**
- Create: `packages/api/drizzle/0020_add_hot_path_indexes.sql`

**Why:** Several frequently-queried columns lack indexes. At 50 concurrent users:
- `projects.user_id` — every project list query does a full table scan
- `jobs.project_id + jobs.status` — agent tools query this on every chat message
- `conversations.project_id` — queried on every editor open

- [ ] **Step 1: Create the migration**

```sql
-- Add indexes for frequently-queried columns to support 50+ concurrent users

-- Projects by user (dashboard project list)
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects (user_id);

-- Jobs by project + status (agent polling, job status checks)
CREATE INDEX IF NOT EXISTS idx_jobs_project_id_status ON jobs (project_id, status);

-- Conversations by project (agent chat load)
CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON conversations (project_id);

-- Timeline items by track (editor load)
CREATE INDEX IF NOT EXISTS idx_timeline_items_track_id ON timeline_items (track_id);

-- Project assets by project (media panel)
CREATE INDEX IF NOT EXISTS idx_project_assets_project_id ON project_assets (project_id);
```

- [ ] **Step 2: Verify** — Check existing indexes to avoid duplicates:
```bash
# If you have psql access locally:
psql $DATABASE_URL -c "\di" | grep idx_
```

Some of these may already exist from `0015_add_indexes_and_status.sql`. Review that file first and remove any that already exist from the new migration.

- [ ] **Step 3: Commit**
```bash
git add packages/api/drizzle/0020_add_hot_path_indexes.sql
git commit -m "perf(db): add indexes on hot query paths for projects, jobs, conversations"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `pnpm --filter @viona/shared build` passes
- [ ] `pnpm --filter @viona/api build` passes
- [ ] `pnpm --filter @viona/worker build` passes
- [ ] `pnpm --filter @viona/web build` passes (or equivalent)
- [ ] No `any` types in `apps/web/src/lib/api.ts` (`grep ": any" apps/web/src/lib/api.ts` returns empty)
- [ ] `VisualsLayoutMode` defined only in `packages/shared/` (`grep -r "type VisualsLayoutMode" packages/ apps/ --include="*.ts" | grep -v node_modules | grep -v dist` — should show only shared)
- [ ] Migration file `0020_add_hot_path_indexes.sql` is idempotent (uses `IF NOT EXISTS`)
- [ ] WebSocket reconnect caps at 10s delay (test by stopping API while editor is open)
