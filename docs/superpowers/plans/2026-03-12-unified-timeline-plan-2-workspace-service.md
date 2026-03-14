# Unified Timeline Plan 2: Workspace Service + Bundler + API

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend workspace lifecycle (spin-up, teardown, idle timeout), bundler service, manifest API endpoints, edit lock, and WebSocket events — so that a project workspace can be created, edited, and synced.

**Architecture:** When a user opens a project, the API spins up a workspace directory containing manifest.json + composition infrastructure + scene sources. A shared bundler service builds the Remotion bundle. The manifest is editable via PATCH operations. An edit lock prevents concurrent user/AI edits. WebSocket events notify the frontend of workspace state changes. Idle timeout tears down inactive workspaces.

**Tech Stack:** TypeScript, Fastify, Remotion bundler, Redis (pub/sub + lock), MinIO/S3, BullMQ

**Spec:** `docs/superpowers/specs/2026-03-12-unified-timeline-architecture-design.md`

**Depends on:** Plan 1 (manifest types, ops, DB schema) — already implemented.

---

## File Structure

```
packages/api/src/
  workspace/
    workspace-service.ts     — Spin-up, teardown, idle timeout, manifest read/write
    workspace-lock.ts        — Redis-based mutual exclusion lock
    bundler-service.ts       — Queue-based Remotion bundle builds
    workspace-routes.ts      — Fastify route plugin (REST endpoints)
    workspace-ws.ts          — WebSocket event helpers
    workspace-config.ts      — Workspace paths, timeouts, constants
```

Each file has one clear responsibility:
- **workspace-config.ts**: paths and constants (no logic)
- **workspace-lock.ts**: acquire/release/check lock (Redis only)
- **bundler-service.ts**: build queue, hash check, debounce (Remotion CLI)
- **workspace-service.ts**: orchestrates spin-up/teardown using the above
- **workspace-routes.ts**: HTTP handlers calling workspace-service
- **workspace-ws.ts**: send workspace WebSocket events via Redis pub/sub

---

## Chunk 1: Workspace Config + Lock + WebSocket Helpers

### Task 1: Workspace configuration

**Files:**
- Create: `packages/api/src/workspace/workspace-config.ts`

- [ ] **Step 1: Create workspace config module**

```typescript
import { resolve, join } from 'path';

const isProduction = !!process.env.RAILWAY_ENVIRONMENT;

export const workspaceConfig = {
  /** Root directory for all workspace directories */
  rootDir: resolve(process.env.WORKSPACE_ROOT_DIR || (isProduction ? '/tmp/workspaces' : join(process.cwd(), '..', 'workspaces'))),

  /** How long before an idle workspace is torn down (ms) */
  idleTimeoutMs: parseInt(process.env.WORKSPACE_IDLE_TIMEOUT_MS || '600000', 10), // 10 min

  /** How often to checkpoint manifest to DB (ms) */
  checkpointIntervalMs: parseInt(process.env.WORKSPACE_CHECKPOINT_MS || '60000', 10), // 60s

  /** Edit lock TTL before auto-release (ms) */
  lockTtlMs: 30_000, // 30s

  /** AI heartbeat interval for extending lock TTL (ms) */
  lockHeartbeatMs: 10_000, // 10s

  /** Bundler debounce time (ms) — batch rapid file changes */
  bundlerDebounceMs: 500,

  /** Redis key prefixes */
  redis: {
    lockPrefix: 'workspace:lock:',
    activityPrefix: 'workspace:activity:',
  },

  /** S3 prefixes */
  s3: {
    bundlePrefix: 'bundles/',
    sceneSourcePrefix: 'sources/',
  },
} as const;

/** Get the workspace directory path for a project */
export function getWorkspacePath(projectId: string): string {
  return join(workspaceConfig.rootDir, projectId);
}

/** Get path to manifest.json inside a workspace */
export function getManifestPath(projectId: string): string {
  return join(getWorkspacePath(projectId), 'manifest.json');
}

/** Get path to the src/ directory inside a workspace */
export function getWorkspaceSrcPath(projectId: string): string {
  return join(getWorkspacePath(projectId), 'src');
}

/** Get path to the scenes directory inside a workspace */
export function getScenesPath(projectId: string): string {
  return join(getWorkspacePath(projectId), 'src', 'scenes');
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/workspace/workspace-config.ts
git commit -m "feat(api): add workspace configuration module"
```

---

### Task 2: Workspace edit lock (Redis-based)

**Files:**
- Create: `packages/api/src/workspace/workspace-lock.ts`

- [ ] **Step 1: Create the lock module**

The lock uses Redis SET with NX (not-exists) and PX (TTL in ms). This is atomic and handles crashes (auto-expiry).

```typescript
import { redis } from '../services/redis.js';
import { workspaceConfig } from './workspace-config.js';

export type LockHolder = 'user' | 'ai';

export interface LockInfo {
  holder: LockHolder;
  acquiredAt: string;
}

/**
 * Try to acquire the workspace edit lock.
 * Returns true if acquired, false if held by another party.
 */
export async function acquireLock(projectId: string, holder: LockHolder): Promise<boolean> {
  const key = workspaceConfig.redis.lockPrefix + projectId;
  const value = JSON.stringify({ holder, acquiredAt: new Date().toISOString() } satisfies LockInfo);
  const result = await redis.set(key, value, 'PX', workspaceConfig.lockTtlMs, 'NX');
  return result === 'OK';
}

/**
 * Release the workspace edit lock (atomic via Lua script).
 * Only releases if the current holder matches.
 */
export async function releaseLock(projectId: string, holder: LockHolder): Promise<boolean> {
  const key = workspaceConfig.redis.lockPrefix + projectId;
  // Atomic check-and-delete: only delete if holder matches
  const script = `
    local val = redis.call("get", KEYS[1])
    if not val then return 1 end
    local info = cjson.decode(val)
    if info.holder == ARGV[1] then
      redis.call("del", KEYS[1])
      return 1
    end
    return 0
  `;
  const result = await redis.eval(script, 1, key, holder);
  return result === 1;
}

/**
 * Extend the lock TTL (heartbeat, atomic via Lua script).
 * Only extends if the current holder matches.
 */
export async function extendLock(projectId: string, holder: LockHolder): Promise<boolean> {
  const key = workspaceConfig.redis.lockPrefix + projectId;
  const script = `
    local val = redis.call("get", KEYS[1])
    if not val then return 0 end
    local info = cjson.decode(val)
    if info.holder == ARGV[1] then
      redis.call("pexpire", KEYS[1], ARGV[2])
      return 1
    end
    return 0
  `;
  const result = await redis.eval(script, 1, key, holder, String(workspaceConfig.lockTtlMs));
  return result === 1;
}

/**
 * Get current lock status. Returns null if no lock held.
 */
export async function getLockInfo(projectId: string): Promise<LockInfo | null> {
  const key = workspaceConfig.redis.lockPrefix + projectId;
  const current = await redis.get(key);
  if (!current) return null;
  return JSON.parse(current) as LockInfo;
}

/**
 * Force-release lock (admin/cleanup only). Used during workspace teardown.
 */
export async function forceReleaseLock(projectId: string): Promise<void> {
  const key = workspaceConfig.redis.lockPrefix + projectId;
  await redis.del(key);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/workspace/workspace-lock.ts
git commit -m "feat(api): add Redis-based workspace edit lock"
```

---

### Task 3: WebSocket event helpers

**Files:**
- Create: `packages/api/src/workspace/workspace-ws.ts`

The existing WebSocket system uses Redis pub/sub with channel pattern `project:{projectId}:{event}`. We add workspace-specific events that follow the same pattern.

- [ ] **Step 1: Create WebSocket helper module**

```typescript
import { redis } from '../services/redis.js';

/** Publish a workspace event via Redis pub/sub.
 * Channel format: `project:{projectId}:{event}` — matches existing psubscribe('project:*:*')
 * Automatically injects `projectId` into the payload for WS broadcast routing.
 */
async function publishWorkspaceEvent(projectId: string, event: string, data: unknown): Promise<void> {
  const channel = `project:${projectId}:${event}`;
  const payload = { ...(data as object), projectId };
  await redis.publish(channel, JSON.stringify(payload));
}

// ---- Specific event publishers ----

export async function emitWorkspaceReady(projectId: string, data: { bundleUrl: string }): Promise<void> {
  await publishWorkspaceEvent(projectId, 'workspace:ready', data);
}

export async function emitManifestUpdated(projectId: string, data: { source: 'user' | 'ai'; ops?: unknown[] }): Promise<void> {
  await publishWorkspaceEvent(projectId, 'manifest:updated', data);
}

export async function emitBundleReady(projectId: string, data: { bundleUrl: string }): Promise<void> {
  await publishWorkspaceEvent(projectId, 'bundle:ready', data);
}

export async function emitBundleError(projectId: string, data: { error: string }): Promise<void> {
  await publishWorkspaceEvent(projectId, 'bundle:error', data);
}

export async function emitLockAcquired(projectId: string, data: { holder: 'user' | 'ai' }): Promise<void> {
  await publishWorkspaceEvent(projectId, 'workspace:lock_acquired', data);
}

export async function emitLockReleased(projectId: string, data: { holder: 'user' | 'ai' }): Promise<void> {
  await publishWorkspaceEvent(projectId, 'workspace:lock_released', data);
}

export async function emitWorkspaceTeardown(projectId: string): Promise<void> {
  await publishWorkspaceEvent(projectId, 'workspace:teardown', {});
}
```

- [ ] **Step 2: Wire workspace events into the existing WebSocket handler**

Modify `packages/api/src/ws/handler.ts` to handle the new workspace event channels. The existing handler uses `channel.includes(':suffix')` if/else chains inside the `redisSub.on('pmessage', ...)` callback (lines 28-44). Add branches for workspace events **before** the final `else { return; }`.

**IMPORTANT ordering:** Workspace channels like `project:{id}:bundle:error` contain `:error` and `project:{id}:manifest:updated` contains `:updated`, so they would match the existing generic branches first. The new workspace branches must go **BEFORE** the existing `channel.includes(':error')` branch (line 35). Insert them at the top of the if/else chain, right after `channel.includes(':progress')`:

```typescript
// Insert AFTER the ':progress' branch (line 32) and BEFORE ':complete' (line 33):
} else if (channel.includes(':workspace:ready')) {
  type = 'workspace:ready';
} else if (channel.includes(':manifest:updated')) {
  type = 'manifest:updated';
} else if (channel.includes(':bundle:ready')) {
  type = 'bundle:ready';
} else if (channel.includes(':bundle:error')) {
  type = 'bundle:error';
} else if (channel.includes(':workspace:lock_acquired')) {
  type = 'workspace:lock_acquired';
} else if (channel.includes(':workspace:lock_released')) {
  type = 'workspace:lock_released';
} else if (channel.includes(':workspace:teardown')) {
  type = 'workspace:teardown';
// Then the existing ':complete', ':error', ':health', ':logs', ':updated' branches follow
```

This prevents `bundle:error` from being caught by `:error` and `manifest:updated` from being caught by `:updated`.

These workspace events are project-scoped (not job-scoped), so they'll be routed to connections with matching `projectId` by the existing broadcast logic (line 58: `data.projectId && conn.projectId === data.projectId`).

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/workspace/workspace-ws.ts packages/api/src/ws/handler.ts
git commit -m "feat(api): add workspace WebSocket event helpers"
```

---

### Task 4: Write lock + config tests

**Files:**
- Create: `scripts/temp/test-workspace-lock.ts`

These tests verify the lock logic in isolation using a mock Redis approach. Since we can't guarantee a Redis connection in test, we test the serialization/logic patterns.

- [ ] **Step 1: Write lock tests**

```typescript
// Test workspace-config path helpers
import { getWorkspacePath, getManifestPath, getScenesPath } from '@viona/api/workspace/workspace-config';

console.log('Test 1: getWorkspacePath...');
const wp = getWorkspacePath('test-project-123');
console.assert(wp.includes('test-project-123'), `Path should contain project ID: ${wp}`);
console.assert(!wp.endsWith('/'), 'Path should not end with slash');
console.log('  PASS');

console.log('Test 2: getManifestPath...');
const mp = getManifestPath('test-project-123');
console.assert(mp.endsWith('manifest.json'), `Path should end with manifest.json: ${mp}`);
console.assert(mp.startsWith(wp), 'Manifest path should be inside workspace');
console.log('  PASS');

console.log('Test 3: getScenesPath...');
const sp = getScenesPath('test-project-123');
console.assert(sp.includes('scenes'), `Path should contain scenes: ${sp}`);
console.assert(sp.includes('src'), 'Scenes should be inside src/');
console.log('  PASS');

console.log('\nAll tests passed!');
```

- [ ] **Step 2: Run tests**

Run: `cd packages/api && npx tsx ../../scripts/temp/test-workspace-lock.ts`
Expected: All 3 tests pass

- [ ] **Step 3: Commit**

```bash
git add -f scripts/temp/test-workspace-lock.ts
git commit -m "test: add workspace config path helper tests"
```

---

## Chunk 2: Bundler Service

### Task 5: Bundler service

**Files:**
- Create: `packages/api/src/workspace/bundler-service.ts`

The bundler is a singleton that processes build requests sequentially. It debounces rapid changes and skips rebuilds when files haven't changed.

- [ ] **Step 1: Create bundler service**

```typescript
import { resolve, join } from 'path';
import { createHash } from 'crypto';
import { readdir, readFile, stat, mkdir } from 'fs/promises';
import { spawn } from 'child_process';
import { workspaceConfig, getWorkspacePath, getWorkspaceSrcPath } from './workspace-config.js';
import { emitBundleReady, emitBundleError } from './workspace-ws.js';

interface BuildRequest {
  projectId: string;
  priority: 'user' | 'background';
  resolve: (bundlePath: string) => void;
  reject: (error: Error) => void;
}

interface CacheEntry {
  bundlePath: string;
  hash: string;
  builtAt: number;
}

class BundlerService {
  private queue: BuildRequest[] = [];
  private processing = false;
  private cache = new Map<string, CacheEntry>();
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private bundleOutputDir: string;

  constructor() {
    const isProduction = !!process.env.RAILWAY_ENVIRONMENT;
    this.bundleOutputDir = resolve(
      process.env.BUNDLE_OUTPUT_DIR ||
      (isProduction ? '/tmp/bundles' : join(process.cwd(), '..', 'bundles'))
    );
  }

  /**
   * Enqueue a build for a project. Debounces rapid requests.
   * Returns the bundle output path when the build completes.
   */
  enqueueBuild(projectId: string, priority: 'user' | 'background' = 'background'): Promise<string> {
    return new Promise((resolve, reject) => {
      // Clear existing debounce timer for this project
      const existing = this.debounceTimers.get(projectId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        this.debounceTimers.delete(projectId);

        // Remove any existing queued build for this project
        this.queue = this.queue.filter(r => r.projectId !== projectId);

        const request: BuildRequest = { projectId, priority, resolve, reject };

        if (priority === 'user') {
          // User-triggered builds go to front of queue
          this.queue.unshift(request);
        } else {
          this.queue.push(request);
        }

        this.processNext();
      }, workspaceConfig.bundlerDebounceMs);

      this.debounceTimers.set(projectId, timer);
    });
  }

  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const request = this.queue.shift()!;

    try {
      const bundlePath = await this.buildBundle(request.projectId);
      request.resolve(bundlePath);
      await emitBundleReady(request.projectId, { bundleUrl: `/api/workspace/${request.projectId}/bundle/` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown build error';
      request.reject(error instanceof Error ? error : new Error(message));
      await emitBundleError(request.projectId, { error: message });
    } finally {
      this.processing = false;
      this.processNext(); // Process next in queue
    }
  }

  private async buildBundle(projectId: string): Promise<string> {
    const workspacePath = getWorkspacePath(projectId);
    const srcPath = getWorkspaceSrcPath(projectId);
    const outDir = join(this.bundleOutputDir, projectId);

    // Compute hash of all source files
    const hash = await this.computeSourceHash(srcPath);
    const cached = this.cache.get(projectId);
    if (cached && cached.hash === hash) {
      return cached.bundlePath; // Skip rebuild
    }

    // Ensure output directory exists
    await mkdir(outDir, { recursive: true });

    // Run Remotion bundle
    const entryPoint = join(srcPath, 'index.tsx');
    await this.runRemotionBundle(entryPoint, outDir, workspacePath);

    // Update cache
    this.cache.set(projectId, { bundlePath: outDir, hash, builtAt: Date.now() });

    return outDir;
  }

  private runRemotionBundle(entryPoint: string, outDir: string, cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        'remotion', 'bundle',
        entryPoint,
        '--out-dir', outDir,
        '--log', 'error',
      ];

      const proc = spawn('npx', args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      });

      let stderr = '';
      proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Remotion bundle failed (exit ${code}): ${stderr.slice(0, 500)}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn Remotion bundle: ${err.message}`));
      });

      // Timeout: 2 minutes max
      setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error('Remotion bundle timed out after 120s'));
      }, 120_000);
    });
  }

  private async computeSourceHash(srcDir: string): Promise<string> {
    const hash = createHash('sha256');

    try {
      await this.hashDir(srcDir, hash);
    } catch {
      // If dir doesn't exist, return empty hash
      return 'empty';
    }

    return hash.digest('hex').slice(0, 16);
  }

  private async hashDir(dir: string, hash: ReturnType<typeof createHash>): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    // Sort for deterministic hash
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules
        if (entry.name === 'node_modules') continue;
        await this.hashDir(fullPath, hash);
      } else if (entry.isFile() && /\.(tsx?|jsx?|css|json)$/.test(entry.name)) {
        const content = await readFile(fullPath);
        hash.update(entry.name);
        hash.update(content);
      }
    }
  }

  /**
   * Remove cached bundle for a project. Called on workspace teardown.
   */
  cleanup(projectId: string): void {
    this.cache.delete(projectId);
    const timer = this.debounceTimers.get(projectId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(projectId);
    }
    // Remove queued builds
    this.queue = this.queue.filter(r => r.projectId !== projectId);
  }

  /** Get the bundle output directory for a project (may not exist yet) */
  getBundlePath(projectId: string): string {
    return join(this.bundleOutputDir, projectId);
  }
}

// Singleton
export const bundlerService = new BundlerService();
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/workspace/bundler-service.ts
git commit -m "feat(api): add workspace bundler service with queue, debounce, and hash caching"
```

---

## Chunk 3: Workspace Service

### Task 6: Workspace service (spin-up, teardown, manifest I/O)

**Files:**
- Create: `packages/api/src/workspace/workspace-service.ts`

This is the core orchestrator. It handles:
1. **Spin-up**: create directory, copy infrastructure, generate manifest from DB, copy scene sources from S3
2. **Teardown**: sync manifest back to DB, upload scene sources to S3, clean up directory
3. **Manifest read/write**: read manifest.json, apply operations to it
4. **Idle tracking**: record activity timestamps for timeout

- [ ] **Step 1: Create workspace service**

```typescript
import { mkdir, writeFile, readFile, rm, cp, access } from 'fs/promises';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import {
  workspaceConfig,
  getWorkspacePath,
  getManifestPath,
  getWorkspaceSrcPath,
  getScenesPath,
} from './workspace-config.js';
import { bundlerService } from './bundler-service.js';
import { forceReleaseLock } from './workspace-lock.js';
import { emitWorkspaceReady, emitWorkspaceTeardown } from './workspace-ws.js';
import { dbToManifest, manifestToDb, validateManifest, applyManifestOp } from '@viona/shared';
import type { Manifest, ManifestOp, DbToManifestInput } from '@viona/shared';
import { db, projects, tracks, timelineItems } from '../db/index.js';

// Track active workspaces and their idle timers
const activeWorkspaces = new Map<string, { idleTimer: ReturnType<typeof setTimeout> }>();

/**
 * Spin up a workspace for a project.
 * Creates directory structure, generates manifest from DB, copies scene sources.
 */
export async function spinUpWorkspace(projectId: string): Promise<{ manifest: Manifest; bundleUrl: string | null }> {
  const workspacePath = getWorkspacePath(projectId);
  const srcPath = getWorkspaceSrcPath(projectId);
  const scenesPath = getScenesPath(projectId);
  const manifestPath = getManifestPath(projectId);

  // 1. Create directory structure
  await mkdir(join(srcPath, 'scenes'), { recursive: true });
  await mkdir(join(srcPath, 'captions'), { recursive: true });
  await mkdir(join(srcPath, 'layout'), { recursive: true });
  await mkdir(join(workspacePath, 'public'), { recursive: true });

  // 2. Generate manifest from DB
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const projectTracks = await db.select().from(tracks).where(eq(tracks.projectId, projectId));
  const projectItems = await db.select().from(timelineItems)
    .where(eq(timelineItems.trackId, projectTracks[0]?.id ?? ''));

  // Get ALL items for all tracks in this project
  const allItems = [];
  for (const track of projectTracks) {
    const items = await db.select().from(timelineItems).where(eq(timelineItems.trackId, track.id));
    allItems.push(...items);
  }

  const dbInput: DbToManifestInput = {
    project: {
      fps: project.fps ?? 30,
      durationMs: project.durationMs ?? 0,
      sourceWidth: project.sourceWidth ?? 1920,
      sourceHeight: project.sourceHeight ?? 1080,
      videoSettings: (project.videoSettings as Record<string, unknown>) ?? null,
    },
    tracks: projectTracks.map(t => ({
      id: t.id,
      type: t.type,
      name: t.name,
      position: t.position,
      locked: t.locked,
      visible: t.visible,
    })),
    items: allItems.map(item => ({
      id: item.id,
      trackId: item.trackId,
      type: item.type,
      startMs: item.startMs,
      endMs: item.endMs,
      data: (item.data as Record<string, unknown>) ?? {},
    })),
  };

  const manifest = dbToManifest(dbInput);

  // 3. Copy scene sources from S3 (if project has existing visuals)
  // TODO (Plan 3+): Download scene .tsx files from S3 sources/{compositionId}/ into workspace src/scenes/
  // For now, scenes are empty — they'll be generated fresh or loaded in a later plan.

  // 4. Write manifest.json
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  // 4. Update project workspace status
  await db.update(projects)
    .set({
      workspaceStatus: 'active',
      workspaceLastActivity: new Date(),
    })
    .where(eq(projects.id, projectId));

  // 5. Start idle timer
  resetIdleTimer(projectId);

  // 6. Queue bundle build (non-blocking)
  const cachedBundleUrl = project.activeBundleUrl ?? null;
  bundlerService.enqueueBuild(projectId, 'user').then(async () => {
    await emitWorkspaceReady(projectId, {
      bundleUrl: `/api/workspace/${projectId}/bundle/`,
    });
  }).catch((err) => {
    console.error(`[workspace] Bundle build failed for ${projectId}:`, err);
  });

  return { manifest, bundleUrl: cachedBundleUrl };
}

/**
 * Tear down a workspace. Syncs manifest to DB, cleans up directory.
 */
export async function tearDownWorkspace(projectId: string): Promise<void> {
  const workspacePath = getWorkspacePath(projectId);
  const manifestPath = getManifestPath(projectId);

  try {
    // 1. Read current manifest
    const manifestJson = await readFile(manifestPath, 'utf-8');
    const manifest = validateManifest(JSON.parse(manifestJson));

    // 2. Sync manifest back to DB
    await syncManifestToDb(projectId, manifest);
  } catch (err) {
    console.error(`[workspace] Failed to sync manifest for ${projectId}:`, err);
    // Continue with teardown even if sync fails — DB still has last checkpoint
  }

  // 3. Clean up
  clearIdleTimer(projectId);
  bundlerService.cleanup(projectId);
  await forceReleaseLock(projectId);

  // 4. Update project status
  await db.update(projects)
    .set({ workspaceStatus: 'inactive' })
    .where(eq(projects.id, projectId));

  // 5. Remove workspace directory
  try {
    await rm(workspacePath, { recursive: true, force: true });
  } catch {
    // Best effort cleanup
  }

  // 6. Notify
  await emitWorkspaceTeardown(projectId);
  activeWorkspaces.delete(projectId);
}

/**
 * Read the current manifest from a workspace.
 */
export async function readManifest(projectId: string): Promise<Manifest> {
  const manifestPath = getManifestPath(projectId);
  const json = await readFile(manifestPath, 'utf-8');
  return validateManifest(JSON.parse(json));
}

/**
 * Apply a manifest operation. Validates, writes to disk, returns updated manifest.
 */
export async function applyManifestOperation(projectId: string, op: ManifestOp): Promise<Manifest> {
  const manifest = await readManifest(projectId);
  const updated = applyManifestOp(manifest, op);
  const manifestPath = getManifestPath(projectId);
  await writeFile(manifestPath, JSON.stringify(updated, null, 2), 'utf-8');
  touchActivity(projectId);
  return updated;
}

/**
 * Check if a workspace is currently active.
 */
export async function isWorkspaceActive(projectId: string): Promise<boolean> {
  const workspacePath = getWorkspacePath(projectId);
  try {
    await access(workspacePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Record activity on a workspace (resets idle timer).
 */
export function touchActivity(projectId: string): void {
  resetIdleTimer(projectId);
}

// ---- Internal helpers ----

function resetIdleTimer(projectId: string): void {
  clearIdleTimer(projectId);
  const idleTimer = setTimeout(async () => {
    console.log(`[workspace] Idle timeout for ${projectId}, tearing down...`);
    try {
      await tearDownWorkspace(projectId);
    } catch (err) {
      console.error(`[workspace] Idle teardown failed for ${projectId}:`, err);
    }
  }, workspaceConfig.idleTimeoutMs);
  activeWorkspaces.set(projectId, { idleTimer });
}

function clearIdleTimer(projectId: string): void {
  const entry = activeWorkspaces.get(projectId);
  if (entry) {
    clearTimeout(entry.idleTimer);
  }
}

/**
 * Sync manifest data back to DB.
 * Updates tracks, timeline items, and video settings.
 */
async function syncManifestToDb(projectId: string, manifest: Manifest): Promise<void> {
  const { tracks: manifestTracks, items: manifestItems, videoSettings } = manifestToDb(manifest);

  // Update video settings on project
  await db.update(projects)
    .set({
      videoSettings: videoSettings as any,
      durationMs: Math.round(manifest.durationMs),
    })
    .where(eq(projects.id, projectId));

  // Sync tracks: delete existing, insert from manifest
  const existingTracks = await db.select().from(tracks).where(eq(tracks.projectId, projectId));
  for (const t of existingTracks) {
    // Timeline items cascade-delete with tracks
    await db.delete(tracks).where(eq(tracks.id, t.id));
  }

  for (const t of manifestTracks) {
    await db.insert(tracks).values({
      id: t.id,
      projectId,
      type: t.type,
      name: t.name,
      position: t.position,
      locked: false,  // Default — manifest doesn't track lock/visibility state
      visible: true,
    });
  }

  // Insert items
  for (const item of manifestItems) {
    await db.insert(timelineItems).values({
      id: item.id,
      trackId: item.trackId,
      type: item.type,
      startMs: item.startMs,
      endMs: item.endMs,
      data: item.data as any,
    });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit`
Expected: No errors (may need to fix import paths based on actual DB module exports)

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/workspace/workspace-service.ts
git commit -m "feat(api): add workspace service with spin-up, teardown, manifest I/O, and idle timeout"
```

---

## Chunk 4: API Routes

### Task 7: Workspace REST API routes

**Files:**
- Create: `packages/api/src/workspace/workspace-routes.ts`
- Modify: `packages/api/src/index.ts` (register route plugin)

- [ ] **Step 1: Create workspace routes**

```typescript
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { join } from 'path';
import { stat, readFile } from 'fs/promises';
import { createReadStream } from 'fs';
import { manifestOpSchema } from '@viona/shared';
import {
  spinUpWorkspace,
  tearDownWorkspace,
  readManifest,
  applyManifestOperation,
  isWorkspaceActive,
  touchActivity,
} from './workspace-service.js';
import { acquireLock, releaseLock, extendLock, getLockInfo } from './workspace-lock.js';
import { emitManifestUpdated, emitLockAcquired, emitLockReleased } from './workspace-ws.js';
import { bundlerService } from './bundler-service.js';

// Assume authMiddleware is imported from the auth module
import { authMiddleware } from '../middleware/auth.js';

// MIME types for bundle file serving
const MIME_TYPES: Record<string, string> = {
  '.js': 'application/javascript',
  '.js.map': 'application/json',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

export async function workspaceRoutes(fastify: FastifyInstance): Promise<void> {

  // ---- Workspace lifecycle ----

  /** Spin up workspace for a project */
  fastify.post('/projects/:id/workspace', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // Check if already active
    if (await isWorkspaceActive(id)) {
      const manifest = await readManifest(id);
      touchActivity(id);
      return reply.send({ manifest, workspaceStatus: 'active', bundleUrl: null });
    }

    try {
      const result = await spinUpWorkspace(id);
      return reply.send({
        manifest: result.manifest,
        workspaceStatus: 'initializing',
        cachedBundleUrl: result.bundleUrl,
      });
    } catch (error: any) {
      return reply.status(500).send({ error: `Failed to spin up workspace: ${error.message}` });
    }
  });

  /** Tear down workspace */
  fastify.delete('/projects/:id/workspace', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!(await isWorkspaceActive(id))) {
      return reply.status(404).send({ error: 'No active workspace' });
    }

    await tearDownWorkspace(id);
    return reply.send({ status: 'torn_down' });
  });

  // ---- Manifest operations ----

  /** Read current manifest */
  fastify.get('/projects/:id/workspace/manifest', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!(await isWorkspaceActive(id))) {
      return reply.status(404).send({ error: 'No active workspace' });
    }

    touchActivity(id);
    const manifest = await readManifest(id);
    return reply.send(manifest);
  });

  /** Apply a manifest operation */
  fastify.patch('/projects/:id/workspace/manifest', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!(await isWorkspaceActive(id))) {
      return reply.status(404).send({ error: 'No active workspace' });
    }

    // Validate the operation
    const parseResult = manifestOpSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid operation', details: parseResult.error.issues });
    }

    try {
      const updated = await applyManifestOperation(id, parseResult.data);
      await emitManifestUpdated(id, { source: 'user', ops: [parseResult.data] });
      return reply.send(updated);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // ---- Edit lock ----

  /** Acquire edit lock */
  fastify.post('/projects/:id/workspace/lock', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { holder?: string } | undefined;
    const holder = (body?.holder === 'ai' ? 'ai' : 'user') as 'user' | 'ai';

    if (!(await isWorkspaceActive(id))) {
      return reply.status(404).send({ error: 'No active workspace' });
    }

    const acquired = await acquireLock(id, holder);
    if (!acquired) {
      const current = await getLockInfo(id);
      return reply.status(409).send({ error: 'Lock held', holder: current?.holder });
    }

    await emitLockAcquired(id, { holder });
    return reply.send({ acquired: true, holder });
  });

  /** Release edit lock */
  fastify.delete('/projects/:id/workspace/lock', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { holder?: string } | undefined;
    const holder = (body?.holder === 'ai' ? 'ai' : 'user') as 'user' | 'ai';

    const released = await releaseLock(id, holder);
    if (!released) {
      return reply.status(409).send({ error: 'Lock held by other party' });
    }

    await emitLockReleased(id, { holder });
    return reply.send({ released: true });
  });

  /** Extend lock TTL (heartbeat) */
  fastify.post('/projects/:id/workspace/lock/heartbeat', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { holder?: string } | undefined;
    const holder = (body?.holder === 'ai' ? 'ai' : 'user') as 'user' | 'ai';

    const extended = await extendLock(id, holder);
    if (!extended) {
      return reply.status(409).send({ error: 'Lock expired or held by other party' });
    }

    return reply.send({ extended: true });
  });

  /** Get lock status */
  fastify.get('/projects/:id/workspace/lock', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const info = await getLockInfo(id);
    return reply.send({ locked: !!info, info });
  });

  // ---- Bundle serving ----

  /** Serve bundle files from the workspace build output */
  fastify.get('/projects/:id/workspace/bundle/*', async (request, reply) => {
    const { id } = request.params as { id: string };
    const filePath = (request.params as any)['*'] || 'index.html';

    const bundlePath = bundlerService.getBundlePath(id);
    const fullPath = join(bundlePath, filePath);

    // Security: prevent path traversal
    if (!fullPath.startsWith(bundlePath)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    try {
      const fileStat = await stat(fullPath);
      if (!fileStat.isFile()) {
        return reply.status(404).send({ error: 'Not found' });
      }

      // Determine MIME type
      const ext = Object.keys(MIME_TYPES).find(e => fullPath.endsWith(e)) || '';
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'no-cache'); // Always fresh during development
      return reply.send(createReadStream(fullPath));
    } catch {
      return reply.status(404).send({ error: 'Not found' });
    }
  });
}
```

- [ ] **Step 2: Register routes in API server**

Add to `packages/api/src/index.ts`, after the existing route registrations (~line 312):

```typescript
import { workspaceRoutes } from './workspace/workspace-routes.js';

// Add after existing route registrations:
await fastify.register(workspaceRoutes, { prefix: '/api' });
```

- [ ] **Step 3: Create barrel export**

Create `packages/api/src/workspace/index.ts`:

```typescript
export { workspaceConfig, getWorkspacePath, getManifestPath } from './workspace-config.js';
export { acquireLock, releaseLock, extendLock, getLockInfo } from './workspace-lock.js';
export { bundlerService } from './bundler-service.js';
export { spinUpWorkspace, tearDownWorkspace, readManifest, applyManifestOperation, isWorkspaceActive } from './workspace-service.js';
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/workspace/workspace-routes.ts packages/api/src/workspace/index.ts packages/api/src/index.ts
git commit -m "feat(api): add workspace REST API routes and register in server"
```

---

### Task 8: Integration smoke test

**Files:**
- Create: `scripts/temp/test-workspace-integration.ts`

This test verifies the module structure loads correctly and exports are accessible. It doesn't test runtime behavior (that requires a running server + Redis + DB).

- [ ] **Step 1: Write integration structure test**

```typescript
// Verify all workspace modules export correctly
import { workspaceConfig, getWorkspacePath, getManifestPath } from '../packages/api/src/workspace/workspace-config.js';

// Test 1: Config values are reasonable
console.log('Test 1: Config values...');
console.assert(workspaceConfig.idleTimeoutMs > 0, 'idleTimeoutMs should be positive');
console.assert(workspaceConfig.lockTtlMs > 0, 'lockTtlMs should be positive');
console.assert(workspaceConfig.bundlerDebounceMs > 0, 'bundlerDebounceMs should be positive');
console.assert(workspaceConfig.checkpointIntervalMs > 0, 'checkpointIntervalMs should be positive');
console.log('  PASS');

// Test 2: Path helpers produce consistent paths
console.log('Test 2: Path consistency...');
const wp = getWorkspacePath('abc-123');
const mp = getManifestPath('abc-123');
console.assert(mp.startsWith(wp), 'Manifest should be inside workspace');
console.assert(mp.endsWith('manifest.json'), 'Manifest should be manifest.json');
console.log('  PASS');

// Test 3: Different project IDs produce different paths
console.log('Test 3: Path isolation...');
const wp1 = getWorkspacePath('project-1');
const wp2 = getWorkspacePath('project-2');
console.assert(wp1 !== wp2, 'Different projects should have different paths');
console.assert(!wp1.includes('project-2'), 'Paths should not leak between projects');
console.log('  PASS');

console.log('\nAll tests passed!');
```

- [ ] **Step 2: Run test**

Run: `npx tsx scripts/temp/test-workspace-integration.ts`
Expected: All 3 tests pass

- [ ] **Step 3: Commit**

```bash
git add -f scripts/temp/test-workspace-integration.ts
git commit -m "test: add workspace integration structure tests"
```
