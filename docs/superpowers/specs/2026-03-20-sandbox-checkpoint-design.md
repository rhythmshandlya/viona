# Sandbox Checkpoint System — Design Spec

## Problem

Pipeline progress (scenes, splits, overlays, captions) is lost when a sandbox is suspended and resumed. Root cause: the Docker volume backup captures workspace state at init time (pre-pipeline), and S3 checkpoints store only manifest JSON — never restored on resume. When `destroy()` deletes the workspace directory, all generated files are gone.

## Goals

1. **No lost work** — every manifest write and file change is captured automatically
2. **Fast restore** — sandbox resume restores full workspace state (scenes, components, manifest, transcript)
3. **DB stays in sync** — `saveProject` from the frontend always has current tracks/items
4. **Minimal overhead** — checkpoint cost proportional to change size, not workspace size

## Non-Goals

- Version history / undo (single checkpoint, not a timeline)
- Cross-project checkpoint sharing
- Real-time file sync (debounced is sufficient)

## Architecture

Two-sided system: sandbox creates checkpoints, API stores and restores them.

**Responsibility split:**
- **Sandbox** uploads the git bundle directly to MinIO (it already has MinIO credentials via env vars)
- **Sandbox** POSTs only the manifest JSON to the API checkpoint route
- **API** calls `syncManifestToDb()` on the received manifest to keep the DB in sync

### Write Path (Checkpoint Creation)

```
manifest write (MCP tool / transcript-sync)
        │
        ▼
  fs.watch manifest.json
        │
        ▼ (debounced 5s)
  git add -A && git commit
        │
        ▼
  git bundle create workspace.bundle
        │
        ├──► [sandbox uploads directly] MinIO: checkpoints/{projectId}/workspace.bundle
        │
        └──► POST /internal/sandbox/{id}/checkpoint  {manifest}
                    │
                    ▼
              [API adds] syncManifestToDb(projectId, manifest)
```

**Phase boundary checkpoints** bypass the debounce — orchestrator calls `checkpoint()` immediately after each subagent completes. The call is placed in `processStream()` after `activeSubagents.delete()`, fired as fire-and-forget with a serialization guard (the `checkpointInProgress` mutex) to avoid blocking the SDK message stream.

**SIGTERM checkpoint** runs the same pipeline synchronously before `process.exit(0)`. Docker sends SIGTERM with a 30-second timeout before SIGKILL (`container.stop({ t: 30 })`). The handler prioritizes local operations (git commit + bundle creation) first, then attempts the MinIO upload and API POST with a 20-second timeout to stay within the window. If the upload fails, the local bundle still exists and is captured by the Docker volume backup that follows as part of `suspend()`.

**Replaces existing triggers:** This system replaces both the interval-based checkpoint timer (`startCheckpointing(60s)` in `entry.ts`) and the write-count-based trigger (`CHECKPOINT_EVERY_N_WRITES` in `manifest-ops.ts`). Both are removed in favor of the single `fs.watch` + debounce mechanism.

### Read Path (Restore on Resume)

Restore happens in `docker.ts create()`, before the container starts. Priority order:

```
manager.acquire(projectId)
        │
        ▼
  Create empty workspace dir
        │
        ▼
  [1] Check MinIO for checkpoints/{projectId}/workspace.bundle
        │
        ├── bundle exists ──► download bundle
        │                      git clone bundle → workspace dir
        │                      skip volume restore
        │                          │
        │                          ▼
        │                     isInitialized() = true
        │                     start checkpointing
        │
        └── bundle missing
                │
                ▼
          [2] Check for backup volume (backupId)
                │
                ├── volume exists ──► busybox cp from volume (existing behavior)
                │
                └── volume missing ──► full re-init needed (recovery: 'lost')
```

**Insertion point in `docker.ts create()`:** Before the existing `if (backupId)` block, add a MinIO check + git clone. If the bundle restore succeeds, set a flag to skip the volume restore. This is a clean extension of the existing fallback chain.

### Git Repository Setup

**After `initWorkspace()` completes:**

```bash
cd /workspace
git init
git config user.email "sandbox@viona.ai"
git config user.name "Viona Sandbox"
# Write .gitignore
git add -A
git commit -m "init"
```

**.gitignore:**
```
node_modules/
public/source.mp4
public/audio.aac
public/proxy-*
*.mp4
*.aac
*.wav
.staging/
```

Large media files are excluded — they're downloaded from MinIO on init and don't change during the session. This keeps bundles small (typically < 5MB).

`.staging/` is a defensive measure — normally cleaned up during init, but a failed init could leave it behind.

### DB Sync

Every checkpoint POSTs the manifest to the API. The checkpoint route (`/internal/sandbox/:id/checkpoint`) is modified to call `syncManifestToDb(projectId, manifest)` directly with the manifest from the request body. This replaces the current behavior of only uploading to S3.

The existing `manifest-updated` callback and `debouncedSync` path remain for real-time frontend WebSocket updates. The checkpoint system becomes the primary DB sync path for durable state. Both paths call `syncManifestToDb()` and are idempotent (upserts), so redundant calls are harmless.

`syncManifestToDb()` handles:
- Upserts tracks (mapping manifest types to DB types)
- Upserts timeline items with all data/keyframes/transforms
- Deletes orphaned tracks and items
- Updates project `durationMs` and `fps`

This means `saveProject` from the frontend editor always reflects the latest pipeline state.

## Checkpoint Module API

New file: `packages/sandbox/src/checkpoint.ts`

```typescript
// Initialize git repo in workspace (call after initWorkspace)
export async function initGitRepo(): Promise<void>

// Run a checkpoint immediately (git commit + bundle + upload + DB sync)
export async function checkpoint(): Promise<void>

// Start watching manifest.json for changes (debounced 5s)
export function startCheckpointWatcher(): void

// Stop watching
export function stopCheckpointWatcher(): void
```

### Debounce Behavior

- `fs.watch('/workspace/manifest.json')` triggers debounce timer
- 5-second quiet period — resets on each new write
- After quiet period: full checkpoint pipeline runs
- `checkpoint()` called directly bypasses debounce (for phase boundaries + SIGTERM)
- Guard: checkpoint pipeline is serialized via `checkpointInProgress` mutex (skip if one is already in progress)
- Sessions are typically short-lived (< 1 hour); git history accumulation is negligible

## File Changes

| File | Action | Change |
|------|--------|--------|
| `packages/sandbox/src/checkpoint.ts` | **Create** | Git operations, bundle creation, MinIO upload, API POST, debounce, watcher |
| `packages/sandbox/src/workspace-init.ts` | Modify | Call `initGitRepo()` after workspace setup completes |
| `packages/sandbox/src/entry.ts` | Modify | Replace `startCheckpointing()` with `startCheckpointWatcher()`, call `checkpoint()` on SIGTERM |
| `packages/sandbox/src/agent-server.ts` | Modify | Update imports from `manifest-checkpoint` to `checkpoint`, replace `startCheckpointing()` with `startCheckpointWatcher()` |
| `packages/sandbox/src/manifest-checkpoint.ts` | **Delete** | Replaced by `checkpoint.ts` |
| `packages/sandbox/src/tools/manifest-ops.ts` | Modify | Remove `CHECKPOINT_EVERY_N_WRITES` write-count trigger (replaced by fs.watch) |
| `packages/sandbox/src/orchestrator.ts` | Modify | Call `checkpoint()` (fire-and-forget with mutex) in `processStream()` after `activeSubagents.delete()` |
| `packages/api/src/sandbox/routes.ts` | Modify | Checkpoint route: add `syncManifestToDb(projectId, manifest)` call (manifest only, no bundle) |
| `packages/api/src/sandbox/manager.ts` | Modify | `acquire()`: attempt bundle restore from MinIO before volume fallback |
| `packages/api/src/sandbox/docker.ts` | Modify | `create()`: add bundle download + `git clone` before existing `if (backupId)` block |

## Edge Cases

- **Concurrent manifest writes**: Debounce coalesces rapid writes from MCP tools
- **Bundle upload failure**: Log error, retry on next checkpoint cycle. Not fatal.
- **No changes to commit**: `git diff --quiet && exit` — skip bundle/upload if nothing changed
- **First checkpoint race**: `initGitRepo()` sets a `gitReady` flag; checkpoint is gated on it
- **Interrupted checkpoint**: Git operations are atomic (commit succeeds or doesn't). Bundle upload uses MinIO's atomic PUT.
- **Large workspaces**: Without media, workspace is small. Git's delta compression keeps bundles compact.
- **Restore with stale DB**: Bundle is source of truth for workspace files. DB is updated on next checkpoint after resume.
- **SIGTERM timeout**: Local git ops (commit + bundle) prioritized first. Upload attempted with 20s timeout within Docker's 30s window. If upload fails, volume backup still captures the bundle file.
- **Competing DB sync paths**: Both `manifest-updated` (real-time) and checkpoint (durable) call `syncManifestToDb()`. Both are idempotent upserts — redundant calls are harmless.

## Migration

1. Deploy new checkpoint system
2. Keep Docker volume backup as fallback (restore from volume if no bundle exists)
3. After confidence period: remove volume backup code from `docker.ts`

## Success Criteria

- Suspend + resume preserves all generated scenes, components, and manifest state
- `saveProject` from frontend after pipeline run saves correct items to DB
- Checkpoint overhead < 2s for typical workspace (no media)
- No data loss on SIGTERM or idle-timeout suspension
