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
        ├──► MinIO: checkpoints/{projectId}/workspace.bundle
        │
        └──► POST /internal/sandbox/{id}/checkpoint  {manifest}
                    │
                    ▼
              syncManifestToDb(projectId, manifest)
```

**Phase boundary checkpoints** bypass the debounce — orchestrator calls `checkpoint()` immediately after each subagent completes.

**SIGTERM checkpoint** runs the same pipeline synchronously before `process.exit(0)`.

### Read Path (Restore on Resume)

```
manager.acquire(projectId)
        │
        ▼
  Create empty workspace dir
        │
        ▼
  Download checkpoints/{projectId}/workspace.bundle from MinIO
        │
        ├── bundle exists ──► git clone bundle → workspace
        │                          │
        │                          ▼
        │                     isInitialized() = true
        │                     start checkpointing
        │
        └── bundle missing ──► fallback: backup volume restore (existing behavior)
                                   │
                                   └── volume missing ──► full re-init needed
```

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

### DB Sync

Every checkpoint POSTs the manifest to the API. The API calls the existing `syncManifestToDb(projectId, manifest)` which:

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
- Guard: checkpoint pipeline is serialized (skip if one is already in progress)

## File Changes

| File | Action | Change |
|------|--------|--------|
| `packages/sandbox/src/checkpoint.ts` | **Create** | Git operations, bundle creation, upload, debounce, watcher |
| `packages/sandbox/src/workspace-init.ts` | Modify | Call `initGitRepo()` after workspace setup completes |
| `packages/sandbox/src/entry.ts` | Modify | Replace `startCheckpointing()` with `startCheckpointWatcher()`, call `checkpoint()` on SIGTERM |
| `packages/sandbox/src/manifest-checkpoint.ts` | **Delete** | Replaced by `checkpoint.ts` |
| `packages/sandbox/src/orchestrator.ts` | Modify | Call `checkpoint()` after each subagent phase completes |
| `packages/api/src/sandbox/routes.ts` | Modify | Checkpoint route: store bundle in MinIO + call `syncManifestToDb()` |
| `packages/api/src/sandbox/manager.ts` | Modify | Restore path: download bundle from MinIO, `git clone` into workspace |
| `packages/api/src/sandbox/docker.ts` | Modify | `create()`: add bundle restore before container start |

## Edge Cases

- **Concurrent manifest writes**: Debounce coalesces rapid writes from MCP tools
- **Bundle upload failure**: Log error, retry on next checkpoint cycle. Not fatal.
- **No changes to commit**: `git diff --quiet && exit` — skip bundle/upload if nothing changed
- **First checkpoint race**: `initGitRepo()` sets a `gitReady` flag; checkpoint is gated on it
- **Interrupted checkpoint**: Git operations are atomic (commit succeeds or doesn't). Bundle upload uses MinIO's atomic PUT.
- **Large workspaces**: Without media, workspace is small. Git's delta compression keeps bundles compact.
- **Restore with stale DB**: Bundle is source of truth for workspace files. DB is updated on next checkpoint after resume.

## Migration

1. Deploy new checkpoint system
2. Keep Docker volume backup as fallback (restore from volume if no bundle exists)
3. After confidence period: remove volume backup code from `docker.ts`

## Success Criteria

- Suspend + resume preserves all generated scenes, components, and manifest state
- `saveProject` from frontend after pipeline run saves correct items to DB
- Checkpoint overhead < 2s for typical workspace (no media)
- No data loss on SIGTERM or idle-timeout suspension
