# Sandbox Checkpoint System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically persist full workspace state (manifest, scenes, components, files) on every change so no work is lost when a sandbox is suspended and resumed.

**Architecture:** Sandbox-side git repo captures all file changes. On checkpoint: git commit → git bundle → upload bundle to MinIO + POST manifest to API for DB sync. On resume: download bundle from MinIO → git clone → full workspace restored. Replaces the broken Docker volume backup as primary recovery path.

**Tech Stack:** Node.js (sandbox), git CLI, MinIO (S3-compatible), Fastify (API), Drizzle ORM (DB sync)

**Spec:** `docs/superpowers/specs/2026-03-20-sandbox-checkpoint-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/sandbox/Dockerfile` | Modify | Add `git` to `apt-get install` in production image |
| `packages/sandbox/src/checkpoint.ts` | **Create** | Git init, commit, bundle, MinIO upload, API POST, fs.watch debounce, mutex |
| `packages/sandbox/src/workspace-init.ts` | Modify | Call `initGitRepo()` after workspace init completes |
| `packages/sandbox/src/entry.ts` | Modify | Replace old checkpoint imports, use `startCheckpointWatcher()`, call `checkpoint()` on SIGTERM |
| `packages/sandbox/src/agent-server.ts` | Modify | Replace old checkpoint imports, use `startCheckpointWatcher()` in `/init` |
| `packages/sandbox/src/manifest-checkpoint.ts` | **Delete** | Replaced entirely by `checkpoint.ts` |
| `packages/sandbox/src/tools/manifest-ops.ts` | Modify | Remove `CHECKPOINT_EVERY_N_WRITES` write-count trigger (lines 121-138) |
| `packages/sandbox/src/orchestrator.ts` | Modify | Fire-and-forget `checkpoint()` after subagent completion in `processStream()` |
| `packages/api/src/sandbox/routes.ts` | Modify | Checkpoint route calls `syncManifestToDb()` + still uploads manifest to S3 |
| `packages/api/src/sandbox/manager.ts` | Modify | `acquire()` checks MinIO for bundle before volume fallback |
| `packages/api/src/sandbox/docker.ts` | Modify | `create()` downloads bundle and runs `git clone` before `if (backupId)` block |

---

### Task 0: Add git to sandbox Docker image

The checkpoint system depends on git CLI. It's not currently installed in the production image.

**Files:**
- Modify: `packages/sandbox/Dockerfile:44-51`

- [ ] **Step 1: Add git to apt-get install**

In `packages/sandbox/Dockerfile`, replace lines 44-51:

```dockerfile
# System dependencies for Remotion (Chromium), ffmpeg, and Python
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    python3 \
    unzip \
    && rm -rf /var/lib/apt/lists/*
```

with:

```dockerfile
# System dependencies for Remotion (Chromium), ffmpeg, Python, and git (checkpoint system)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    git \
    python3 \
    unzip \
    && rm -rf /var/lib/apt/lists/*
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/Dockerfile
git commit -m "feat(sandbox): add git to Docker image for checkpoint system"
```

---

### Task 1: Create checkpoint module (`checkpoint.ts`)

The core module. Handles git operations, bundle creation, MinIO upload, API POST, fs.watch with debounce, and a serialization mutex.

**Files:**
- Create: `packages/sandbox/src/checkpoint.ts`

- [ ] **Step 1: Create the checkpoint module with git init**

```typescript
// packages/sandbox/src/checkpoint.ts
import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, stat } from 'fs/promises';
import { watch, type FSWatcher } from 'fs';
import { join } from 'path';
import { createReadStream } from 'fs';
import { Client as MinioClient } from 'minio';
import pino from 'pino';

const execFileAsync = promisify(execFile);
const logger = pino({ name: 'checkpoint' });

const WORKSPACE = '/workspace';
const MANIFEST_PATH = join(WORKSPACE, 'manifest.json');
const BUNDLE_PATH = '/tmp/workspace.bundle';

const API_CALLBACK_URL = process.env.API_CALLBACK_URL;
const SANDBOX_ID = process.env.SANDBOX_ID;
const SANDBOX_SECRET = process.env.SANDBOX_SECRET;

let gitReady = false;
let checkpointInProgress = false;
let watcher: FSWatcher | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const DEBOUNCE_MS = 5000;

function getMinioClient(): MinioClient {
  return new MinioClient({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || '',
    secretKey: process.env.MINIO_SECRET_KEY || '',
  });
}

const GITIGNORE = `node_modules/
public/source.mp4
public/audio.aac
public/proxy-*
*.mp4
*.aac
*.wav
.staging/
`;

/**
 * Initialize git repo in workspace. Call after initWorkspace() completes.
 * Sets gitReady flag so checkpoint() knows it can proceed.
 */
export async function initGitRepo(): Promise<void> {
  try {
    await execFileAsync('git', ['init'], { cwd: WORKSPACE });
    await execFileAsync('git', ['config', 'user.email', 'sandbox@viona.ai'], { cwd: WORKSPACE });
    await execFileAsync('git', ['config', 'user.name', 'Viona Sandbox'], { cwd: WORKSPACE });
    await writeFile(join(WORKSPACE, '.gitignore'), GITIGNORE);
    await execFileAsync('git', ['add', '-A'], { cwd: WORKSPACE });
    await execFileAsync('git', ['commit', '-m', 'init', '--allow-empty'], { cwd: WORKSPACE });
    gitReady = true;
    logger.info('Git repo initialized in workspace');
  } catch (err) {
    logger.error({ err }, 'Failed to initialize git repo');
  }
}
```

- [ ] **Step 2: Add the checkpoint() function**

Append to `checkpoint.ts`:

```typescript
/**
 * Run a full checkpoint: git commit → bundle → MinIO upload → API POST.
 * Serialized via checkpointInProgress mutex — concurrent calls are skipped.
 * Can be called directly (phase boundary, SIGTERM) or via debounced watcher.
 */
export async function checkpoint(): Promise<void> {
  if (!gitReady) {
    logger.debug('Git not ready, skipping checkpoint');
    return;
  }
  if (checkpointInProgress) {
    logger.debug('Checkpoint already in progress, skipping');
    return;
  }

  checkpointInProgress = true;
  try {
    // 1. Stage all changes
    await execFileAsync('git', ['add', '-A'], { cwd: WORKSPACE });

    // 2. Check if there are changes to commit
    try {
      await execFileAsync('git', ['diff', '--cached', '--quiet'], { cwd: WORKSPACE });
      // No changes — skip bundle/upload
      logger.debug('No changes to checkpoint');
      return;
    } catch {
      // diff --cached --quiet exits non-zero when there ARE changes — proceed
    }

    // 3. Commit
    await execFileAsync('git', ['commit', '-m', `checkpoint ${new Date().toISOString()}`], { cwd: WORKSPACE });

    // 4. Create bundle
    await execFileAsync('git', ['bundle', 'create', BUNDLE_PATH, '--all'], { cwd: WORKSPACE });

    // 5. Upload bundle to MinIO (fire-and-forget errors)
    await uploadBundle().catch(err => {
      logger.error({ err }, 'Bundle upload to MinIO failed');
    });

    // 6. POST manifest to API for DB sync
    await postManifestToApi().catch(err => {
      logger.error({ err }, 'Manifest POST to API failed');
    });

    logger.info('Checkpoint complete');
  } catch (err) {
    logger.error({ err }, 'Checkpoint failed');
  } finally {
    checkpointInProgress = false;
  }
}

async function uploadBundle(): Promise<void> {
  const minio = getMinioClient();
  const bucket = process.env.MINIO_BUCKET || 'viona';
  const key = `checkpoints/${SANDBOX_ID}/workspace.bundle`;

  const bundleStat = await stat(BUNDLE_PATH);
  const stream = createReadStream(BUNDLE_PATH);

  await minio.putObject(bucket, key, stream, bundleStat.size, {
    'Content-Type': 'application/octet-stream',
  });
  logger.debug({ key, size: bundleStat.size }, 'Bundle uploaded to MinIO');
}

async function postManifestToApi(): Promise<void> {
  if (!API_CALLBACK_URL || !SANDBOX_ID) return;

  const manifestRaw = await readFile(MANIFEST_PATH, 'utf-8');
  const manifest = JSON.parse(manifestRaw);

  const res = await fetch(`${API_CALLBACK_URL}/internal/sandbox/${SANDBOX_ID}/checkpoint`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SANDBOX_SECRET}`,
    },
    body: JSON.stringify({ manifest }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    logger.error({ status: res.status }, 'API checkpoint POST failed');
  }
}
```

- [ ] **Step 3: Add the fs.watch debounced watcher**

Append to `checkpoint.ts`:

```typescript
/**
 * Start watching manifest.json for changes. Debounces 5s then runs checkpoint().
 */
export function startCheckpointWatcher(): void {
  if (watcher) return; // Already watching

  try {
    watcher = watch(MANIFEST_PATH, () => {
      // Reset debounce timer on each change
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        checkpoint().catch(err => {
          logger.error({ err }, 'Debounced checkpoint failed');
        });
      }, DEBOUNCE_MS);
    });

    logger.info('Checkpoint watcher started (5s debounce)');
  } catch (err) {
    logger.error({ err }, 'Failed to start checkpoint watcher');
  }
}

/**
 * Stop watching manifest.json.
 */
export function stopCheckpointWatcher(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: No errors related to `checkpoint.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/checkpoint.ts
git commit -m "feat(sandbox): add checkpoint module with git bundle + MinIO upload"
```

---

### Task 2: Wire git init into workspace initialization

After `initWorkspace()` completes, initialize the git repo so all initial files are captured.

**Files:**
- Modify: `packages/sandbox/src/workspace-init.ts:359-401`

- [ ] **Step 1: Add initGitRepo import and call after workspace init**

In `packages/sandbox/src/workspace-init.ts`, add import at top:

```typescript
import { initGitRepo } from './checkpoint.js';
```

In the `initWorkspace()` function, after `await syncAssets();` (line 392) and before the success log (line 394), add:

```typescript
    // Initialize git repo for checkpoint system
    await initGitRepo();
```

The function should now read (lines 391-395):
```typescript
    // Asset sync runs after promotion — it reads/writes /workspace directly
    await syncAssets();

    // Initialize git repo for checkpoint system
    await initGitRepo();

    logger.info('Workspace initialized');
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/workspace-init.ts
git commit -m "feat(sandbox): init git repo after workspace setup for checkpoint system"
```

---

### Task 3: Replace checkpoint triggers in entry.ts and agent-server.ts

Replace the old interval-based checkpoint with the new fs.watch watcher and direct `checkpoint()` calls.

**Files:**
- Modify: `packages/sandbox/src/entry.ts:1-88`
- Modify: `packages/sandbox/src/agent-server.ts:1-347`

- [ ] **Step 1: Update entry.ts imports and usage**

In `packages/sandbox/src/entry.ts`:

Replace line 5:
```typescript
import { startCheckpointing, checkpoint } from './manifest-checkpoint.js';
```
with:
```typescript
import { startCheckpointWatcher, stopCheckpointWatcher, checkpoint } from './checkpoint.js';
```

Replace line 59 (`startCheckpointing(CHECKPOINT_INTERVAL);`):
```typescript
    startCheckpointWatcher();
```

Remove line 12 (the `CHECKPOINT_INTERVAL` const is no longer needed):
```typescript
const CHECKPOINT_INTERVAL = parseInt(process.env.CHECKPOINT_INTERVAL_MS || '60000', 10);
```

Also update the SIGTERM handler (lines 70-74) to stop the watcher before final checkpoint:
```typescript
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  stopCheckpointWatcher(); // Prevent debounce timer from racing
  await checkpoint(); // Final checkpoint
  process.exit(0);
});
```

- [ ] **Step 2: Update agent-server.ts imports and usage**

In `packages/sandbox/src/agent-server.ts`:

Replace line 6:
```typescript
import { checkpoint, startCheckpointing } from './manifest-checkpoint.js';
```
with:
```typescript
import { checkpoint, startCheckpointWatcher } from './checkpoint.js';
```

Replace line 73 (`startCheckpointing(CHECKPOINT_INTERVAL);`):
```typescript
      startCheckpointWatcher();
```

Remove line 22 (the `CHECKPOINT_INTERVAL` const is no longer needed):
```typescript
const CHECKPOINT_INTERVAL = parseInt(process.env.CHECKPOINT_INTERVAL_MS || '60000', 10);
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/entry.ts packages/sandbox/src/agent-server.ts
git commit -m "feat(sandbox): replace interval checkpoint with fs.watch debounced watcher"
```

---

### Task 4: Remove old checkpoint code

Delete `manifest-checkpoint.ts` and remove the write-count trigger from `manifest-ops.ts`.

**Files:**
- Delete: `packages/sandbox/src/manifest-checkpoint.ts`
- Modify: `packages/sandbox/src/tools/manifest-ops.ts:119-138`

- [ ] **Step 1: Delete manifest-checkpoint.ts**

```bash
rm packages/sandbox/src/manifest-checkpoint.ts
```

- [ ] **Step 2: Remove write-count checkpoint trigger from manifest-ops.ts**

In `packages/sandbox/src/tools/manifest-ops.ts`, remove lines 120-122:
```typescript
/** Write counter for periodic DB checkpointing (Issue #12). */
let manifestWriteCount = 0;
const CHECKPOINT_EVERY_N_WRITES = 5;
```

And remove the checkpoint trigger inside `writeManifest()` (lines 133-139, including the closing `}`):
```typescript
  // Periodic DB checkpoint every N writes
  manifestWriteCount++;
  if (manifestWriteCount % CHECKPOINT_EVERY_N_WRITES === 0) {
    import('../manifest-checkpoint.js')
      .then(({ checkpoint }) => checkpoint())
      .catch(() => {}); // best-effort
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: No errors. No remaining imports of `manifest-checkpoint`.

- [ ] **Step 4: Verify no remaining references to old module**

Run: `grep -r "manifest-checkpoint" packages/sandbox/src/`
Expected: No matches

- [ ] **Step 5: Commit**

```bash
git add -u packages/sandbox/src/manifest-checkpoint.ts packages/sandbox/src/tools/manifest-ops.ts
git commit -m "refactor(sandbox): remove old interval + write-count checkpoint triggers"
```

---

### Task 5: Add phase boundary checkpoint to orchestrator

After each subagent completes, fire a checkpoint. This ensures that work from each pipeline phase is durably saved before the next phase begins.

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts:552-572`

- [ ] **Step 1: Add checkpoint import**

At top of `packages/sandbox/src/orchestrator.ts`, add:

```typescript
import { checkpoint } from './checkpoint.js';
```

- [ ] **Step 2: Add fire-and-forget checkpoint after subagent completion**

In the `processStream()` function, after `activeSubagents.delete(block.tool_use_id)` (line 567), add:

```typescript
                  // Fire-and-forget checkpoint after subagent completes (mutex guards concurrency)
                  checkpoint().catch(err => {
                    logger.warn({ err, agent: finishedLabel }, 'Phase boundary checkpoint failed');
                  });
```

The block (lines 556-569) should now read:
```typescript
              if (block.type === 'tool_result' && block.tool_use_id) {
                const finishedLabel = activeSubagents.get(block.tool_use_id);
                if (finishedLabel) {
                  const taskId = subagentTaskIds.get(block.tool_use_id);
                  if (taskId) {
                    completeTask(taskId);
                    subagentTaskIds.delete(block.tool_use_id);
                  }
                  logger.info({ agent: finishedLabel, toolUseId: block.tool_use_id, messageCount }, 'Subagent completed');
                  emitActivity(finishedLabel, 'Done', 'complete');
                  emitProgress('working', `${finishedLabel} finished`, finishedLabel);
                  activeSubagents.delete(block.tool_use_id);
                  subagentLabels.delete(block.tool_use_id);

                  // Fire-and-forget checkpoint after subagent completes (mutex guards concurrency)
                  checkpoint().catch(err => {
                    logger.warn({ err, agent: finishedLabel }, 'Phase boundary checkpoint failed');
                  });
                }
              }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/orchestrator.ts
git commit -m "feat(sandbox): checkpoint after each pipeline phase for durable progress"
```

---

### Task 6: Add `syncManifestToDb` to API checkpoint route

When the sandbox POSTs a checkpoint, the API should sync the manifest to the DB so `saveProject` always has current data.

**Files:**
- Modify: `packages/api/src/sandbox/routes.ts:254-265`

- [ ] **Step 1: Import syncManifestToDb**

In `packages/api/src/sandbox/routes.ts`, the `syncManifestToDb` import already exists via the manager module. We need to import it directly. Add at the top of the file (line 1 area):

```typescript
import { syncManifestToDb } from './sync.js';
```

- [ ] **Step 2: Modify checkpoint route to call syncManifestToDb**

Replace the checkpoint route handler (lines 254-265):

```typescript
    // POST /internal/sandbox/:id/checkpoint — Upload manifest checkpoint to S3 + sync to DB
    fastify.post('/internal/sandbox/:id/checkpoint', async (request, reply) => {
      const projectId = await validateInternalCallback(request, reply);
      if (!projectId) return;
      const body = request.body as { manifest?: any };
      if (body.manifest) {
        // Upload to S3 (existing behavior)
        await manager.checkpoint(projectId, body.manifest);
        // Sync to DB so saveProject from frontend has current data
        await syncManifestToDb(projectId, body.manifest).catch(err => {
          logger.error({ err, projectId }, 'syncManifestToDb failed during checkpoint');
        });
      } else {
        logger.debug({ projectId }, 'Checkpoint received (no manifest payload)');
      }
      return { ok: true };
    });
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/sandbox/routes.ts
git commit -m "feat(api): sync manifest to DB on every checkpoint for saveProject consistency"
```

---

### Task 7: Add bundle restore to Docker provider

Before the existing volume backup restore in `docker.ts create()`, try downloading and cloning a git bundle from MinIO.

**Files:**
- Modify: `packages/api/src/sandbox/docker.ts:28-165`

- [ ] **Step 1: Add MinIO imports**

At the top of `packages/api/src/sandbox/docker.ts`, add:

```typescript
import { cpSync, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { minioClient } from '../services/minio.js';
import { config } from '../config.js';
```

Note: `existsSync`, `mkdirSync`, `rmSync` are already imported from `fs`. `join`, `resolve` from `path` already imported. `execFileAsync` already defined. We add `cpSync` and `createWriteStream` to the existing `fs` import.

- [ ] **Step 2: Add bundle restore helper method**

Add this method to the `DockerSandboxProvider` class, before the `destroy()` method.

**Important:** The API server runs on Windows. All git operations (verify, clone) must run inside a Docker container, not on the host. This follows the same pattern as the existing backup restore which uses `docker run --rm busybox cp -a`.

```typescript
  /**
   * Attempt to restore workspace from git bundle in MinIO.
   * Returns true if restore succeeded, false if no bundle or restore failed.
   * Git operations run inside a container (API host may be Windows).
   */
  private async tryBundleRestore(projectId: string, workspacePath: string): Promise<boolean> {
    const bundleKey = `checkpoints/${projectId}/workspace.bundle`;
    const bundleTmpPath = join(workspacePath, `${projectId}.bundle`);

    try {
      // Check if bundle exists in MinIO
      await minioClient.statObject(config.storage.bucket, bundleKey);
    } catch {
      return false; // No bundle available
    }

    try {
      // Download bundle to workspace dir (which is bind-mounted into containers)
      const stream = await minioClient.getObject(config.storage.bucket, bundleKey);
      await pipeline(stream, createWriteStream(bundleTmpPath));

      // Use a git-capable Docker image to verify and clone the bundle.
      // The workspace dir is bind-mounted so the container can access the bundle file.
      // node:20-slim has git in the sandbox image, but we use alpine/git which is tiny.
      // Clone into /workspace/repo-tmp, then move contents to /workspace root.
      await execFileAsync('docker', [
        'run', '--rm',
        '-v', `${workspacePath}:/workspace`,
        'alpine/git',
        'sh', '-c',
        `cd /workspace && git bundle verify ${projectId}.bundle && git clone ${projectId}.bundle /workspace/repo-tmp`,
      ], { timeout: 60_000 });

      // Move cloned contents (including .git) to workspace root using Node.js cross-platform APIs
      const cloneTmp = join(workspacePath, 'repo-tmp');
      // Copy all contents from repo-tmp to workspace root
      cpSync(cloneTmp, workspacePath, { recursive: true, force: true });
      // Clean up temp clone dir and bundle file
      rmSync(cloneTmp, { recursive: true, force: true });
      rmSync(bundleTmpPath, { force: true });

      logger.info({ projectId }, 'Workspace restored from git bundle');
      return true;
    } catch (err) {
      logger.warn({ err, projectId }, 'Git bundle restore failed, falling back to volume backup');
      // Cleanup temp files on failure
      try { rmSync(bundleTmpPath, { force: true }); } catch {}
      try { rmSync(join(workspacePath, 'repo-tmp'), { recursive: true, force: true }); } catch {}
      return false;
    }
  }
```

- [ ] **Step 3: Integrate bundle restore into create()**

In the `create()` method, replace the backup restore block (lines 51-59):

```typescript
      // 2. Try git bundle restore from MinIO first, fall back to backup volume
      let bundleRestored = false;
      bundleRestored = await this.tryBundleRestore(projectId, workspacePath);

      if (!bundleRestored && backupId) {
        await execFileAsync('docker', [
          'run', '--rm',
          '-v', `${backupId}:/backup`,
          '-v', `${workspacePath}:/workspace`,
          'busybox', 'cp', '-a', '/backup/.', '/workspace/',
        ], { timeout: 60_000 });
      }
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/sandbox/docker.ts
git commit -m "feat(api): restore workspace from git bundle on sandbox resume"
```

---

### Task 8: Update manager acquire() for bundle recovery detection

The manager needs to set the correct `recovery` value when a bundle restore succeeds. Currently it only checks `backupId` — we need to check bundle existence too.

**Files:**
- Modify: `packages/api/src/sandbox/manager.ts:327-361`

- [ ] **Step 1: Update recovery detection in acquire()**

In `manager.ts`, after sandbox creation succeeds (line 326), the recovery detection block currently only runs `if (backupId)`. We need it to also detect when a bundle restore succeeded (workspace is initialized even without a backupId).

Replace the recovery detection block (lines 327-361):

```typescript
      // 8. Check if workspace initialized (isReady) — works for both bundle and volume restore
      let workspaceReady = false;
      let recovery: AcquireResult['recovery'];

      try {
        const checkRes = await fetch(`${sandbox.agentUrl}/health`, {
          signal: AbortSignal.timeout(5000),
        });
        if (checkRes.ok) {
          const body = await checkRes.json() as { initialized?: boolean };
          workspaceReady = body.initialized === true;
        }
      } catch {
        // Sandbox not reachable yet or workspace broken
      }

      if (workspaceReady) {
        recovery = 'full';
      } else if (backupId) {
        // Had a backup but workspace not ready — check S3 for manifest-only fallback
        let hasS3Checkpoint = false;
        try {
          await minioClient.statObject(
            config.storage.bucket,
            `checkpoints/${projectId}/manifest.json`,
          );
          hasS3Checkpoint = true;
        } catch {
          // No S3 checkpoint
        }
        recovery = hasS3Checkpoint ? 'partial' : 'lost';
        logger.warn({ projectId, recovery }, 'Restore did not produce initialized workspace');
      }
```

This removes the `if (backupId)` gate around the health check — now we always check if the workspace is initialized regardless of whether there was a volume backup. This correctly detects bundle restores.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/sandbox/manager.ts
git commit -m "feat(api): detect bundle restore in acquire() recovery flow"
```

---

### Task 9: End-to-end verification

Verify the full checkpoint and restore flow works locally.

**Files:** None (manual testing)

- [ ] **Step 1: Build both packages**

```bash
cd packages/sandbox && npx tsc --noEmit
cd ../../packages/api && npx tsc --noEmit
```

Expected: Both compile clean.

- [ ] **Step 2: Verify no remaining references to deleted module**

```bash
grep -r "manifest-checkpoint" packages/sandbox/src/ packages/api/src/
```

Expected: No matches.

- [ ] **Step 3: Verify checkpoint.ts exports are all used**

```bash
grep -r "from.*checkpoint" packages/sandbox/src/ --include="*.ts" | grep -v "node_modules" | grep -v "checkpoint.ts"
```

Expected: `entry.ts`, `agent-server.ts`, `workspace-init.ts`, and `orchestrator.ts` all import from `./checkpoint.js`.

- [ ] **Step 4: Manual test — start sandbox and verify git init**

1. Start the dev environment (`docker compose up`)
2. Open a project in the editor (creates sandbox)
3. Exec into sandbox container: `docker exec -it sandbox-<projectId> bash`
4. Verify git repo: `cd /workspace && git log --oneline`
5. Expected: Single "init" commit with all workspace files

- [ ] **Step 5: Manual test — trigger checkpoint via manifest edit**

1. In the editor, make a timeline change (e.g., trim a clip)
2. Wait 5 seconds for debounce
3. In the sandbox container: `git log --oneline`
4. Expected: A new "checkpoint" commit
5. Check MinIO: `mc ls local/viona/checkpoints/<projectId>/`
6. Expected: `workspace.bundle` file exists

- [ ] **Step 6: Manual test — suspend and resume**

1. Close the editor tab (triggers idle suspension after timeout) or call `DELETE /api/projects/:id/sandbox`
2. Reopen the project (triggers resume)
3. Verify workspace is restored: scenes, components, manifest all present
4. In the editor, verify timeline shows all items from before suspend

- [ ] **Step 7: Commit test results as verification**

```bash
git add -A
git commit -m "feat(sandbox): complete checkpoint system — git bundle + MinIO + DB sync"
```
