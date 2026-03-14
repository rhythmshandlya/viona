# Unified Workspace Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make worker and API share one workspace per project — worker writes directly to the project workspace instead of S3 round-trips.

**Architecture:** Both API and Worker read `WORKSPACE_ROOT_DIR` env var to resolve `{root}/{projectId}/`. API creates the workspace on editor open, worker operates on it via `--cwd`. Scene sources stay on disk — no S3 upload/download. Manifest checkpoints periodically to DB for crash recovery.

**Tech Stack:** Node.js, Fastify, BullMQ, esbuild, Remotion, Redis, PostgreSQL/Drizzle, MinIO

**Spec:** `docs/superpowers/specs/2026-03-13-unified-workspace-design.md`

---

## Chunk 1: Shared Config & Worker Workspace Resolution

### Task 1: Add shared workspace root to `@viona/shared`

Create a tiny shared config module so both API and Worker resolve workspace paths identically.

**Files:**
- Create: `packages/shared/src/workspace-paths.ts`
- Modify: `packages/shared/src/index.ts` (add export)

- [ ] **Step 1: Create `workspace-paths.ts`**

```typescript
// packages/shared/src/workspace-paths.ts
import { resolve, join } from 'path';

const isProduction = !!process.env.RAILWAY_ENVIRONMENT;

/**
 * Shared workspace root — both API and Worker must agree on this path.
 * Railway: /data/workspaces (persistent volume)
 * Local dev: {monorepo}/workspaces
 */
export function getWorkspaceRootDir(): string {
  return resolve(
    process.env.WORKSPACE_ROOT_DIR ||
    (isProduction ? '/data/workspaces' : join(process.cwd(), '..', '..', 'workspaces'))
  );
}

/** Resolve workspace path for a project */
export function resolveWorkspacePath(projectId: string): string {
  return join(getWorkspaceRootDir(), projectId);
}

/** Resolve workspace src path */
export function resolveWorkspaceSrcPath(projectId: string): string {
  return join(getWorkspaceRootDir(), projectId, 'src');
}

/** Resolve workspace public path */
export function resolveWorkspacePublicPath(projectId: string): string {
  return join(getWorkspaceRootDir(), projectId, 'public');
}
```

- [ ] **Step 2: Export from shared index**

Add to `packages/shared/src/index.ts`:
```typescript
export { getWorkspaceRootDir, resolveWorkspacePath, resolveWorkspaceSrcPath, resolveWorkspacePublicPath } from './workspace-paths.js';
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/workspace-paths.ts packages/shared/src/index.ts
git commit -m "feat: add shared workspace path resolution to @viona/shared"
```

---

### Task 2: Migrate API workspace-config to use shared paths

**Files:**
- Modify: `packages/api/src/workspace/workspace-config.ts`

- [ ] **Step 1: Update workspace-config.ts to use shared paths**

Replace the `rootDir` computation and path helpers with imports from `@viona/shared`:

```typescript
// packages/api/src/workspace/workspace-config.ts
import { getWorkspaceRootDir, resolveWorkspacePath } from '@viona/shared';
import { join } from 'path';

export const workspaceConfig = {
  /** Root directory — delegated to @viona/shared for API/Worker agreement */
  get rootDir() { return getWorkspaceRootDir(); },

  /** How long before an idle workspace is torn down (ms) */
  idleTimeoutMs: parseInt(process.env.WORKSPACE_IDLE_TIMEOUT_MS || '600000', 10),

  /** How often to checkpoint manifest to DB (ms) */
  checkpointIntervalMs: parseInt(process.env.WORKSPACE_CHECKPOINT_MS || '60000', 10),

  /** Edit lock TTL before auto-release (ms) */
  lockTtlMs: 30_000,

  /** AI heartbeat interval for extending lock TTL (ms) */
  lockHeartbeatMs: 10_000,

  /** Bundler debounce time (ms) */
  bundlerDebounceMs: 500,

  /** Redis key prefixes */
  redis: {
    lockPrefix: 'workspace:lock:',
    activityPrefix: 'workspace:activity:',
  },

  /** S3 prefixes (kept for backward compat during migration) */
  s3: {
    bundlePrefix: 'bundles/',
    sceneSourcePrefix: 'sources/',
  },
} as const;

// Path helpers — thin wrappers over @viona/shared
export function getWorkspacePath(projectId: string): string {
  return resolveWorkspacePath(projectId);
}

export function getManifestPath(projectId: string): string {
  return join(resolveWorkspacePath(projectId), 'manifest.json');
}

export function getWorkspaceSrcPath(projectId: string): string {
  return join(resolveWorkspacePath(projectId), 'src');
}

export function getScenesPath(projectId: string): string {
  return join(resolveWorkspacePath(projectId), 'src', 'scenes');
}

export function getPublicPath(projectId: string): string {
  return join(resolveWorkspacePath(projectId), 'public');
}
```

- [ ] **Step 2: Verify existing API code compiles**

Run: `cd packages/api && npx tsc --noEmit`
Expected: No errors (all imports still resolve)

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/workspace/workspace-config.ts
git commit -m "refactor: API workspace config uses shared path resolution"
```

---

### Task 3: Update .env files with WORKSPACE_ROOT_DIR

**Files:**
- Modify: `.env.example`
- Modify: `packages/api/.env.example`
- Modify: `packages/worker/.env.example`

- [ ] **Step 1: Add WORKSPACE_ROOT_DIR to all .env.example files**

Add to each `.env.example`:
```
# Shared workspace root — must be the same path for API and Worker
# Railway: /data/workspaces (persistent volume mount)
# Local: defaults to {monorepo}/workspaces
WORKSPACE_ROOT_DIR=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example packages/api/.env.example packages/worker/.env.example
git commit -m "docs: add WORKSPACE_ROOT_DIR to env examples"
```

---

## Chunk 2: Worker Uses Project Workspace

### Task 4: Update worker config to support project workspaces

The worker currently has a singleton workspace path (`config.worker.workspacePath`). We need to add the ability to resolve per-project workspace paths while keeping the singleton for `remotion-template` (which still holds `node_modules`, `.claude/`, `package.json`).

**Files:**
- Modify: `packages/worker/src/config.ts`

- [ ] **Step 1: Read current config.ts**

Read `packages/worker/src/config.ts` to see current structure.

- [ ] **Step 2: Add shared workspace root import**

Add to worker config:
```typescript
import { getWorkspaceRootDir, resolveWorkspacePath } from '@viona/shared';

// In the config object, add:
workspace: {
  /** Shared root — same as API's WORKSPACE_ROOT_DIR */
  rootDir: getWorkspaceRootDir(),

  /** Resolve a project workspace path */
  getProjectPath: (projectId: string) => resolveWorkspacePath(projectId),
},
```

Keep the existing `worker.workspacePath` and `worker.templatePath` for the singleton template — they're still needed for `node_modules` and `.claude/` syncing.

- [ ] **Step 3: Verify compilation**

Run: `cd packages/worker && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/config.ts
git commit -m "feat: worker config adds shared workspace root"
```

---

### Task 5: Update generate-visuals to write to project workspace

This is the biggest change. The worker's `processGenerateVisualsJob` currently:
1. Uses `getWorkspacePath()` → singleton `packages/worker/workspace/`
2. Creates `src/proj_{id}/` inside the singleton
3. Writes Root.tsx and index.tsx in the singleton's `src/`
4. Uploads sources to S3 via `uploadSourceToStorage()`
5. Verifies bundle exists in singleton's bundle output dir

After this change:
1. Uses `resolveWorkspacePath(projectId)` → `{WORKSPACE_ROOT}/{projectId}/`
2. Writes directly to workspace `src/` (segments, Composition.tsx, etc.)
3. No more S3 source upload
4. Triggers API bundler rebuild (via Redis pub/sub or HTTP call)

**Files:**
- Modify: `packages/worker/src/processors/generate-visuals/index.ts`

- [ ] **Step 1: Read current file fully**

Read the full `generate-visuals/index.ts`.

- [ ] **Step 2: Replace workspace path resolution**

Change the workspace path from singleton to per-project:

```typescript
// BEFORE:
import { getWorkspacePath, createProjectDir } from '../../workspace.js';
const workspacePath = getWorkspacePath();
const srcDir = join(workspacePath, 'src');
const projectDir = join(workspacePath, 'src', compositionId);

// AFTER:
import { resolveWorkspacePath, resolveWorkspaceSrcPath } from '@viona/shared';
// Project workspace is {WORKSPACE_ROOT}/{projectId}/
// The composition source code goes into src/ of the project workspace
const workspacePath = resolveWorkspacePath(projectId);
const srcPath = resolveWorkspaceSrcPath(projectId);
// compositionDir is where Claude writes Composition.tsx, segments/, etc.
const compositionDir = srcPath;
```

Key changes in the function body:
- Remove old composition cleanup loop (`entries.startsWith('proj_')`) — each project has its own workspace now
- `projectDir` → `compositionDir` = `{WORKSPACE_ROOT}/{projectId}/src/`
- Head tracking data → `{compositionDir}/head_tracking.json`
- User assets → `{compositionDir}/assets/`
- SCENE_PLAN.md, scenes.json → `{compositionDir}/`
- Root.tsx, index.tsx → already generated by API codegen, don't overwrite
- Template catalog → `{compositionDir}/STUDIO_TEMPLATES.md`

- [ ] **Step 3: Update Claude CLI invocation to use project workspace as cwd**

In `subprocess.ts` (or wherever `runMonitoredClaudeGenerator` is defined), the `--cwd` or working directory should be the project workspace root, not the singleton:

```typescript
// The Claude CLI runs with cwd = project workspace
// It reads .claude/ skills, CLAUDE.md from workspace root
// It writes Composition.tsx, segments/, constants.ts into src/
cwd: resolveWorkspacePath(projectId),
```

- [ ] **Step 4: Remove S3 source upload**

Remove or skip the `uploadSourceToStorage()` call. The source files are already in the workspace — no need to upload to S3:

```typescript
// BEFORE:
await uploadSourceToStorage(projectDir, earlyBundleCompositionId);

// AFTER: (remove entirely — sources live in workspace)
logger.info({ projectId }, 'Sources written directly to project workspace');
```

- [ ] **Step 5: Skip bundle verification (API handles bundling)**

The worker should NOT verify the Remotion bundle exists in its own output dir. Instead, after writing source files, it should trigger an API rebuild. For now, we'll have the worker call the API's bundle endpoint:

```typescript
// After Claude CLI completes, trigger workspace rebuild
// Option A: HTTP call to API
await fetch(`${config.apiUrl}/api/projects/${projectId}/workspace/rebuild`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
});

// Option B: Redis pub/sub (simpler — API already listens)
await publishWorkspaceRebuild(projectId);
```

- [ ] **Step 6: Update DB writes — use workspace path for compositionId**

The compositionId format changes. Instead of `proj_{underscored_id}`, use the projectId directly since each project has its own workspace:

```typescript
// BEFORE: const compositionId = `proj_${projectId.replace(/-/g, '_')}`;
// AFTER: compositionId is just the projectId — workspace isolation handles the rest
const compositionId = projectId;
```

Or keep the compositionId for backward compat with the visuals table, but the filesystem path changes.

- [ ] **Step 7: Verify compilation**

Run: `cd packages/worker && npx tsc --noEmit`

- [ ] **Step 8: Commit**

```bash
git add packages/worker/src/processors/generate-visuals/index.ts
git commit -m "feat: worker writes to project workspace instead of singleton"
```

---

### Task 6: Update subprocess.ts to use project workspace cwd

**Files:**
- Modify: `packages/worker/src/processors/generate-visuals/subprocess.ts`

- [ ] **Step 1: Read subprocess.ts**

Read `packages/worker/src/processors/generate-visuals/subprocess.ts` to understand how Claude CLI is spawned.

- [ ] **Step 2: Change cwd from singleton to project workspace**

The `runMonitoredClaudeGenerator` function spawns Claude CLI. Update it to accept a `workspacePath` parameter and use it as `cwd`:

```typescript
// Add to the function parameters:
interface ClaudeGeneratorOptions {
  // ... existing fields ...
  workspacePath: string; // Project workspace root (new)
}

// In the spawn call:
const proc = spawn(claudeBin, args, {
  cwd: options.workspacePath, // Was: config.worker.workspacePath
  // ...
});
```

- [ ] **Step 3: Ensure .claude/ directory exists in project workspace**

The Claude CLI needs `.claude/settings.local.json` and CLAUDE.md. These should be copied from the template during workspace spinup. Add a step in `processGenerateVisualsJob` to sync them:

```typescript
// Before running Claude CLI, ensure workspace has .claude/ context
const templatePath = config.worker.templatePath;
const claudeDir = join(workspacePath, '.claude');
const claudeMd = join(workspacePath, 'CLAUDE.md');
// Copy if not present (API spinup should have done this, but be defensive)
if (!existsSync(claudeDir)) {
  await cp(join(templatePath, '.claude'), claudeDir, { recursive: true });
}
if (!existsSync(claudeMd)) {
  await copyFile(join(templatePath, 'CLAUDE.md'), claudeMd);
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/processors/generate-visuals/subprocess.ts
git commit -m "feat: Claude CLI uses project workspace as cwd"
```

---

### Task 7: Copy .claude/ and template files during workspace spinup

When the API creates a workspace, it should copy `.claude/` (skills, CLAUDE.md, settings) from the remotion template so the worker's Claude CLI has context.

**Files:**
- Modify: `packages/api/src/workspace/workspace-service.ts`

- [ ] **Step 1: Add .claude/ copy to spinUpWorkspace**

After the existing template composition copy (step 3d), add:

```typescript
// 3e. Copy .claude/ directory and CLAUDE.md from worker template
// These are needed by Claude CLI when the worker runs against this workspace
const templateClaudeDir = resolve(process.cwd(), '..', 'worker', 'remotion-template', '.claude');
const workspaceClaudeDir = join(workspacePath, '.claude');
try {
  await cp(templateClaudeDir, workspaceClaudeDir, { recursive: true });
  // Also copy CLAUDE.md to workspace root
  const templateClaudeMd = join(templateClaudeDir, 'CLAUDE.md');
  const workspaceClaudeMd = join(workspacePath, 'CLAUDE.md');
  try {
    await access(templateClaudeMd);
    await cp(templateClaudeMd, workspaceClaudeMd);
  } catch { /* CLAUDE.md may not exist in .claude/ */ }
} catch (err) {
  console.warn(`[workspace] Failed to copy .claude/ from template:`, err);
}
```

- [ ] **Step 2: Copy package.json and tsconfig.json**

The workspace needs these for TypeScript resolution:

```typescript
// 3f. Copy package.json and tsconfig.json from template
const templateRoot = resolve(process.cwd(), '..', 'worker', 'remotion-template');
for (const file of ['package.json', 'tsconfig.json', 'remotion.config.ts']) {
  try {
    await cp(join(templateRoot, file), join(workspacePath, file));
  } catch {
    console.warn(`[workspace] Failed to copy ${file} from template`);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/workspace/workspace-service.ts
git commit -m "feat: copy .claude/ and config files to workspace on spinup"
```

---

## Chunk 3: Remove S3 Scene Source Round-trip

### Task 8: Remove S3 scene downloads from workspace spinup

Now that the worker writes directly to the project workspace, we no longer need to download scene sources from S3 during spinup.

**Files:**
- Modify: `packages/api/src/workspace/workspace-service.ts`
- Delete (or gut): `packages/api/src/workspace/workspace-scenes.ts`

- [ ] **Step 1: Remove scene download logic from spinUpWorkspace**

Remove the S3 scene download block (lines 91-102 of current workspace-service.ts):

```typescript
// REMOVE these lines:
// 3. Download scene sources from S3 for existing visuals
// const dbItemsForScenes = ...
// const compositionIds = extractCompositionIds(...)
// const downloadedCompositions = await downloadSceneSources(...)
// 3b. Remap manifest sceneFile values
// const visualCompositionMap = buildVisualCompositionMap(...)
// remapManifestSceneFiles(...)
```

Also remove the import of `downloadSceneSources`, `extractCompositionIds`, `buildVisualCompositionMap`, `remapManifestSceneFiles` from workspace-scenes.

- [ ] **Step 2: Delete workspace-scenes.ts**

The entire file is about downloading scenes from S3 and remapping paths. With unified workspace, scenes are already on disk.

```bash
rm packages/api/src/workspace/workspace-scenes.ts
```

Update `packages/api/src/workspace/index.ts` to remove the export if present.

- [ ] **Step 3: Remove uploadSourceToStorage from worker**

In `packages/worker/src/processors/generate-visuals/storage.ts`, remove or deprecate `uploadSourceToStorage()`. Check what else the file exports — if `uploadBundleToStorage()` is also unused, delete the entire file.

Read `storage.ts` first to see what's there.

- [ ] **Step 4: Verify compilation for both packages**

Run:
```bash
cd packages/api && npx tsc --noEmit
cd packages/worker && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove S3 scene source round-trip — worker writes directly to workspace"
```

---

### Task 9: Add workspace rebuild trigger

After the worker writes source files, it needs to tell the API to rebuild the CJS bundle. Add a Redis pub/sub message or a BullMQ job for this.

**Files:**
- Modify: `packages/worker/src/services/redis.ts` (or wherever Redis publish lives)
- Modify: `packages/api/src/workspace/workspace-service.ts` (subscribe to rebuild events)
- Modify: `packages/worker/src/processors/generate-visuals/index.ts` (publish after generation)

- [ ] **Step 1: Add `publishWorkspaceRebuild` to worker's Redis publisher**

```typescript
export async function publishWorkspaceRebuild(projectId: string): Promise<void> {
  await redis.publish('workspace:rebuild', JSON.stringify({ projectId }));
}
```

- [ ] **Step 2: Subscribe to rebuild events in API**

In the API startup (or workspace-service.ts), subscribe to the `workspace:rebuild` channel:

```typescript
import { bundlerService } from './bundler-service.js';

// Called on API startup
export function subscribeToWorkspaceRebuild(redis: Redis): void {
  const sub = redis.duplicate();
  sub.subscribe('workspace:rebuild');
  sub.on('message', async (channel, message) => {
    if (channel !== 'workspace:rebuild') return;
    const { projectId } = JSON.parse(message);
    console.log(`[workspace] Rebuild requested for ${projectId}`);

    // Regenerate PlayerComposition.tsx from updated source files
    await generatePlayerComposition(projectId);
    // Then rebuild CJS bundle
    bundlerService.enqueueBuild(projectId, 'user').catch(err => {
      console.error(`[workspace] Rebuild failed for ${projectId}:`, err);
    });
  });
}
```

- [ ] **Step 3: Publish rebuild event in generate-visuals after Claude CLI completes**

In `processGenerateVisualsJob`, after the Claude CLI finishes:

```typescript
// Trigger workspace rebuild — API will regenerate codegen + CJS bundle
await publishWorkspaceRebuild(projectId);
```

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/services/redis.ts packages/api/src/workspace/workspace-service.ts packages/worker/src/processors/generate-visuals/index.ts
git commit -m "feat: worker triggers workspace rebuild via Redis after visual generation"
```

---

## Chunk 3: Manifest Checkpoint & Crash Recovery

### Task 10: Implement periodic manifest checkpointing

The manifest is on disk as the source of truth, but we need periodic DB syncs for crash recovery.

**Files:**
- Modify: `packages/api/src/workspace/workspace-service.ts`

- [ ] **Step 1: Add checkpoint timer to active workspace tracking**

Extend the `activeWorkspaces` Map to include both idle and checkpoint timers:

```typescript
interface ActiveWorkspace {
  idleTimer: ReturnType<typeof setTimeout>;
  checkpointTimer: ReturnType<typeof setInterval>;
}

const activeWorkspaces = new Map<string, ActiveWorkspace>();
```

- [ ] **Step 2: Start checkpoint timer in spinUpWorkspace**

After `resetIdleTimer(projectId)`, add:

```typescript
// Start periodic manifest checkpoint to DB
startCheckpointTimer(projectId);
```

- [ ] **Step 3: Implement startCheckpointTimer**

```typescript
function startCheckpointTimer(projectId: string): void {
  stopCheckpointTimer(projectId);
  const timer = setInterval(async () => {
    try {
      const manifest = await readManifest(projectId);
      await syncManifestToDb(projectId, manifest);
      console.log(`[workspace] Checkpoint synced for ${projectId}`);
    } catch (err) {
      console.error(`[workspace] Checkpoint failed for ${projectId}:`, err);
    }
  }, workspaceConfig.checkpointIntervalMs);

  const entry = activeWorkspaces.get(projectId);
  if (entry) {
    entry.checkpointTimer = timer;
  }
}

function stopCheckpointTimer(projectId: string): void {
  const entry = activeWorkspaces.get(projectId);
  if (entry?.checkpointTimer) {
    clearInterval(entry.checkpointTimer);
  }
}
```

- [ ] **Step 4: Stop checkpoint timer on teardown**

In `tearDownWorkspace`, add `stopCheckpointTimer(projectId)` before the cleanup steps.

- [ ] **Step 5: Update resetIdleTimer to also initialize checkpoint**

Update the `activeWorkspaces.set()` call to include both timers:

```typescript
function resetIdleTimer(projectId: string): void {
  clearIdleTimer(projectId);
  const idleTimer = setTimeout(async () => {
    // ... existing idle teardown code ...
  }, workspaceConfig.idleTimeoutMs);

  const existing = activeWorkspaces.get(projectId);
  activeWorkspaces.set(projectId, {
    idleTimer,
    checkpointTimer: existing?.checkpointTimer ?? (null as any),
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/workspace/workspace-service.ts
git commit -m "feat: periodic manifest checkpoint to DB for crash recovery"
```

---

### Task 11: Improve orphaned workspace recovery on restart

The existing `cleanupOrphanedWorkspaces` deletes workspace dirs on restart. Instead, we should re-activate them (re-read manifest, start idle timer).

**Files:**
- Modify: `packages/api/src/workspace/workspace-service.ts`

- [ ] **Step 1: Rename and update cleanupOrphanedWorkspaces**

```typescript
/**
 * Recover workspace state after process restart.
 * Re-activates workspaces that still have manifest.json on disk.
 * Removes truly orphaned directories (no matching project in DB).
 */
export async function recoverWorkspacesOnStartup(): Promise<void> {
  const rootDir = workspaceConfig.rootDir;
  try {
    await access(rootDir);
  } catch {
    return; // Root doesn't exist
  }

  const entries = await readdir(rootDir);

  for (const entry of entries) {
    try {
      const manifestPath = getManifestPath(entry);
      try {
        await access(manifestPath);
      } catch {
        // No manifest — truly orphaned, clean up
        console.log(`[workspace] Removing orphaned workspace (no manifest): ${entry}`);
        await rm(join(rootDir, entry), { recursive: true, force: true });
        await db.update(projects)
          .set({ workspaceStatus: 'inactive' })
          .where(eq(projects.id, entry));
        continue;
      }

      // Manifest exists — re-activate with idle timer
      console.log(`[workspace] Re-activating workspace after restart: ${entry}`);
      await db.update(projects)
        .set({ workspaceStatus: 'active', workspaceLastActivity: new Date() })
        .where(eq(projects.id, entry));
      resetIdleTimer(entry);
      startCheckpointTimer(entry);
    } catch (err) {
      console.warn(`[workspace] Failed to recover workspace ${entry}:`, err);
    }
  }
}
```

- [ ] **Step 2: Update the API startup call**

In the API's main startup file (wherever `cleanupOrphanedWorkspaces` is called), replace with `recoverWorkspacesOnStartup`:

```typescript
// BEFORE:
await cleanupOrphanedWorkspaces();

// AFTER:
await recoverWorkspacesOnStartup();
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/workspace/workspace-service.ts
git commit -m "feat: recover active workspaces on API restart instead of deleting them"
```

---

## Chunk 4: Scalability & Resource Limits

### Task 12: Add concurrent workspace limit

For ~100 concurrent users, add a configurable limit with graceful rejection.

**Files:**
- Modify: `packages/api/src/workspace/workspace-config.ts`
- Modify: `packages/api/src/workspace/workspace-service.ts`

- [ ] **Step 1: Add maxConcurrentWorkspaces config**

In workspace-config.ts:
```typescript
/** Maximum concurrent active workspaces (0 = unlimited) */
maxConcurrentWorkspaces: parseInt(process.env.MAX_CONCURRENT_WORKSPACES || '100', 10),
```

- [ ] **Step 2: Check limit in spinUpWorkspace**

At the top of `spinUpWorkspace`, add:

```typescript
if (workspaceConfig.maxConcurrentWorkspaces > 0 &&
    activeWorkspaces.size >= workspaceConfig.maxConcurrentWorkspaces) {
  throw new Error(`Maximum concurrent workspaces reached (${workspaceConfig.maxConcurrentWorkspaces}). Try again later.`);
}
```

- [ ] **Step 3: Expose workspace count in a health endpoint**

Add to workspace-routes.ts:

```typescript
fastify.get('/workspace/health', async (request, reply) => {
  return reply.send({
    activeWorkspaces: activeWorkspaces.size,
    maxWorkspaces: workspaceConfig.maxConcurrentWorkspaces,
    rootDir: workspaceConfig.rootDir,
  });
});
```

(Requires exporting `activeWorkspaces.size` from workspace-service — add a `getActiveWorkspaceCount()` function.)

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/workspace/workspace-config.ts packages/api/src/workspace/workspace-service.ts packages/api/src/workspace/workspace-routes.ts
git commit -m "feat: add concurrent workspace limit for scalability"
```

---

### Task 13: Verify end-to-end workspace lifecycle

Manual integration test to verify the full flow.

- [ ] **Step 1: Start API and Worker locally**

```bash
# Terminal 1
cd packages/api && npm run dev

# Terminal 2
cd packages/worker && npm run dev
```

- [ ] **Step 2: Create project, process video**

Upload a video via the frontend. Wait for transcription to complete.

- [ ] **Step 3: Open editor — verify workspace spins up**

Open the project in the editor. Check:
- `{WORKSPACE_ROOT}/{projectId}/` directory created
- `manifest.json` exists and has correct tracks/items
- `public/source.mp4` downloaded
- `src/composition/` copied from template
- `src/PlayerComposition.tsx` generated
- `.claude/` copied from template
- `package.json`, `tsconfig.json` present
- `node_modules/` symlinked to worker deps

- [ ] **Step 4: Trigger visual generation — verify worker uses project workspace**

Start visual generation from the editor. Check:
- Worker logs show `cwd: {WORKSPACE_ROOT}/{projectId}/`
- Claude CLI writes to `{WORKSPACE_ROOT}/{projectId}/src/`
- No S3 upload of sources
- Worker publishes `workspace:rebuild` event
- API regenerates PlayerComposition.tsx and rebuilds CJS
- Frontend receives `bundle:ready` WebSocket event
- Preview updates with new visuals

- [ ] **Step 5: Close editor — verify teardown**

Close the editor tab. After idle timeout (or explicit teardown):
- Manifest synced to DB
- Workspace directory cleaned up
- Project status set to `inactive`

- [ ] **Step 6: Reopen editor — verify workspace recreated from DB**

Reopen the project. Check:
- Workspace recreated with correct state
- Visual source files NOT present (they were on disk, torn down)
- But manifest correctly reflects the timeline state

---

## Summary of Changes

| Component | Before | After |
|-----------|--------|-------|
| Workspace path | API: `/tmp/workspaces/{id}`, Worker: `worker/workspace/src/proj_{id}` | Both: `WORKSPACE_ROOT/{id}/` |
| Scene sources | Worker → S3 → API downloads | Worker writes directly to workspace |
| Bundle trigger | Worker bundles locally | Worker publishes rebuild event → API bundles |
| Crash recovery | Orphan cleanup (deletes dirs) | Re-activate workspaces with manifest on disk |
| Manifest sync | Only on teardown | Periodic checkpoint (60s) + teardown |
| Scalability | No limits | MAX_CONCURRENT_WORKSPACES (default 100) |
| Claude CLI cwd | `worker/workspace/` | `WORKSPACE_ROOT/{projectId}/` |
| .claude/ context | Only in worker singleton | Copied to each project workspace on spinup |
