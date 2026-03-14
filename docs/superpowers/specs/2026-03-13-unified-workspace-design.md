# Unified Workspace Architecture

## Problem

The current system has two separate workspaces:
1. **Worker workspace** (`packages/worker/workspace/`) — a singleton where Claude generates scenes
2. **API workspace** (`packages/workspaces/{id}/`) — ephemeral, per-project, for editor preview

They sync via S3: worker uploads → S3 → API downloads → rebuilds. This creates:
- 3 hops with multiple failure points
- Two codegen systems (worker's Remotion template + API's PlayerComposition codegen)
- Workspace format mismatches (underscored vs dashed IDs, different directory structures)
- No live feedback loop — AI generates blind, user sees results later
- Manifest/DB sync only on teardown — crash = lost work

## Solution

**One workspace per project.** Like Lovable/Replit/Bolt but for video editing.

```
1 Project = 1 Remotion Workspace
    ├── src/              (AI writes here — scenes, Composition.tsx)
    ├── public/           (video, audio, user assets)
    ├── node_modules/     (symlinked, shared)
    ├── manifest.json     (timeline state — sync layer)
    └── build output      (CJS bundle for preview, remotion render for export)

AI edits src/ → rebuild CJS → preview updates
User edits timeline → manifest.json updates → preview updates
```

## Reference

- [Lovable](https://lovable.dev) — Modal sandboxes, one per project, AI edits code via RPC
- [Bolt.new](https://bolt.new) — WebContainers, AI controls filesystem directly
- [Replit](https://replit.com) — one workspace per project, AI + user both edit

---

## Design

### 1. Workspace Lifecycle

**Create:** When a project is created (after upload + transcription), a persistent workspace directory is created and never torn down until the project is deleted.

**Location:** `{WORKSPACE_ROOT}/{projectId}/` — shared filesystem path accessible by both API and worker processes.

**Structure:**
```
{projectId}/
├── manifest.json           # Timeline state (source of truth for timing)
├── package.json            # Remotion project config
├── tsconfig.json           # TypeScript config
├── src/
│   ├── Root.tsx            # Remotion entry point (generated once)
│   ├── index.ts            # registerRoot (generated once)
│   ├── PlayerComposition.tsx  # Thin wrapper (generated, regenerated on composition changes)
│   ├── Composition.tsx     # AI-generated composition (video + segments + subtitles)
│   ├── constants.ts        # AI-generated (colors, springs)
│   ├── components/         # AI-generated shared components
│   ├── segments/           # AI-generated segment animations
│   │   ├── Segment1.tsx
│   │   └── ...
│   └── scenes.json         # Director output (beat plan)
├── public/
│   ├── source.mp4          # Project video (downloaded from MinIO on create)
│   ├── audio.mp3           # Separate audio if exists
│   └── assets/             # User-uploaded logos, images
├── node_modules/           # Symlinked to shared modules
└── .claude/                # Claude CLI context (CLAUDE.md, skills)
```

**Persist:** The workspace lives on disk for the lifetime of the project. No idle teardown. No S3 round-trip.

**Delete:** When user deletes the project, workspace directory is deleted.

### 2. Who Writes What

| Actor | Writes | Via |
|-------|--------|-----|
| **System** (project create) | `manifest.json`, `Root.tsx`, `index.ts`, `package.json`, copies `public/source.mp4` | `workspace-service.ts` |
| **System** (after AI generates) | `PlayerComposition.tsx` (thin wrapper) | `workspace-codegen.ts` |
| **AI Director** | `scenes.json`, `SCENE_PLAN.md` | Claude CLI in workspace |
| **AI Animator** | `Composition.tsx`, `segments/*.tsx`, `constants.ts`, `components/` | Claude CLI in workspace |
| **AI Editor** | Any `src/` file (same as Animator, but targeted edits) | Claude CLI in workspace |
| **User** (via frontend timeline) | `manifest.json` (timing changes, caption edits) | API manifest ops |
| **AI Agent** (via creative director) | `manifest.json` (timing changes) | API manifest ops |

### 3. Manifest as the Sync Layer

The manifest is the **two-way sync layer** between the workspace and the frontend timeline.

**Manifest → Frontend (load):**
1. API reads `manifest.json` from workspace
2. `manifestToStore()` converts to Zustand editor state
3. Frontend renders timeline tracks and items

**Frontend → Manifest (user edit):**
1. User moves/resizes/deletes item in timeline
2. `dispatchManifestOp()` sends operation to API
3. API applies op to `manifest.json` on disk
4. WebSocket broadcasts change to other clients

**AI → Manifest (AI edit):**
1. AI agent calls manifest op tool (move, delete, update caption style)
2. API applies op to `manifest.json`
3. WebSocket broadcasts with `source: 'ai'`
4. Frontend applies remote update via `applyRemoteManifestUpdate()`

**AI → Source code (visual generation):**
1. AI writes `Composition.tsx`, `segments/*.tsx` directly to workspace `src/`
2. Bundler detects changes, rebuilds CJS
3. WebSocket sends `bundle:ready`
4. Frontend reloads composition via `useWorkspaceComposition()`

**Manifest checkpointing to DB:**
- Periodic checkpoint (every 60s) syncs `manifest.json` → DB
- Also syncs on explicit save and before render
- DB is the backup, workspace is the live source of truth

### 4. Worker Integration

**Current (broken):** Worker has its own singleton workspace. Copies template, generates in isolation, uploads to S3.

**New:** Worker operates directly on the project workspace.

**How it works:**
1. Queue job comes in: `{ projectId, jobType: 'generate-visuals' }`
2. Worker resolves workspace path: `{WORKSPACE_ROOT}/{projectId}/`
3. Worker runs Claude CLI with `--cwd` pointing to the workspace
4. Claude writes `Composition.tsx`, `segments/*.tsx` directly
5. Worker triggers bundle rebuild
6. Worker updates `manifest.json` with new visual timeline items
7. WebSocket notifies frontend: new visuals ready

**No more:**
- Worker-local workspace directory
- S3 upload/download of sources
- S3 upload/download of bundles
- Separate codegen path
- Format conversion between worker and API workspace structures

**Worker's `remotion-template/`** still exists as the **template** for new workspaces. When a project workspace is created, the template files (`.claude/`, shared configs) are copied once. But the worker never has its own workspace instance — it always operates on the project's workspace.

### 5. Bundle / Preview Pipeline

**Build trigger:** Any change to `src/` files triggers an esbuild rebuild.

**Build flow:**
1. File change detected (after AI generation or codegen update)
2. Debounce 500ms
3. esbuild compiles `PlayerComposition.tsx` → `player-composition.cjs.js`
4. CJS file stored in workspace: `{projectId}/.build/player-composition.cjs.js`
5. WebSocket: `bundle:ready` with version bump
6. Frontend fetches CJS, evals with custom `require()`, renders in `@remotion/player`

**Build output stays in workspace** — no separate `bundles/` directory.

**Preview URL:** `GET /api/projects/{id}/workspace/bundle/player-composition.cjs.js`
**Public assets:** `GET /api/projects/{id}/workspace/public/*`

### 6. Render Pipeline

**Current:** Render processor downloads video from MinIO, downloads scenes from S3, creates its own temp workspace, runs `remotion render`.

**New:** Render processor runs `remotion render` directly against the project workspace.

1. Render job received
2. Snapshot `manifest.json` (deep clone — user can keep editing)
3. Run `remotion render` with `--cwd {WORKSPACE_ROOT}/{projectId}/`
4. Output to `{projectId}/.render/output.mp4`
5. Upload final output to MinIO
6. Notify frontend: render complete

**No more:** Downloading sources, creating temp workspace, re-building Remotion bundle for render.

### 7. Workspace Creation Flow (Project Setup)

When a new project finishes transcription:

1. Create workspace directory structure
2. Copy template files from `packages/worker/remotion-template/`:
   - `package.json`, `tsconfig.json`
   - `.claude/` (skills, CLAUDE.md for AI context)
3. Symlink `node_modules/` to shared dependency directory
4. Download video from MinIO → `public/source.mp4`
5. Download audio (if separate) → `public/audio.mp3`
6. Generate initial `manifest.json` from DB (tracks, items, captions)
7. Generate `Root.tsx`, `index.ts`, `PlayerComposition.tsx` (initial — no visuals yet)
8. Build initial CJS bundle (no-op composition — just video + subtitles)
9. Mark workspace as ready

The workspace is now ready for:
- Frontend preview (video + subtitles, no visuals yet)
- AI visual generation (Claude writes directly into `src/`)
- User timeline editing (manifest ops)

### 8. Error Recovery

**Process crash:**
- Workspace files survive on disk
- On restart, scan `{WORKSPACE_ROOT}/` for existing workspaces
- Re-initialize in-memory state (idle timers, bundle watchers)
- No data loss — manifest is on disk, source files are on disk

**AI generation failure:**
- Partial files may exist in `src/`
- Next generation attempt starts fresh or resumes from checkpoint
- Workspace is always in a valid state for preview (worst case: no visuals)

**Build failure:**
- Last good CJS bundle remains — frontend shows last working preview
- Error reported via WebSocket
- AI can fix and trigger rebuild

### 9. What Gets Deleted

**From API:**
- `workspace-scenes.ts` — no more S3 scene downloading
- Scene download logic in `workspace-service.ts`
- S3 upload/download in `spinUpWorkspace`/`tearDownWorkspace`
- Idle timeout teardown (workspaces are persistent now)
- `cleanupOrphanedWorkspaces()` (workspaces are meant to persist)

**From Worker:**
- `packages/worker/workspace/` singleton directory concept
- `packages/worker/src/workspace.ts` singleton workspace manager
- `uploadBundleToStorage()`, `uploadSourceToStorage()` in `generate-visuals/storage.ts`
- `downloadSceneSources()` in API workspace-scenes.ts
- S3 sources prefix usage (`outputs/sources/`, `outputs/bundles/`)

**From shared:**
- Complex `dbToManifest` ↔ `manifestToDb` round-trip for workspace spin-up/teardown
  - Keep for DB checkpoint, but simplify — manifest.json IS the source of truth

### 10. Configuration

```typescript
export const workspaceConfig = {
  /** Root directory for all project workspaces */
  rootDir: resolve(process.env.WORKSPACE_ROOT_DIR || '/workspaces'),

  /** Checkpoint interval — sync manifest to DB (ms) */
  checkpointIntervalMs: 60_000,

  /** Bundler debounce (ms) */
  bundlerDebounceMs: 500,

  /** Max concurrent bundle builds */
  maxConcurrentBuilds: 3,
};
```

### 11. Migration Path

**Existing projects:**
1. On first editor open (workspace spin-up), if no workspace directory exists:
   - Create workspace from DB state (same as "Workspace Creation Flow")
   - If visual sources exist in S3, download them to `src/` (one-time migration)
2. All subsequent opens use the persistent workspace

**New projects:**
- Workspace created after transcription completes
- No legacy path needed

---

## What This Enables (Future)

- **Live AI editing with real-time preview** — AI writes code, preview updates in seconds
- **Collaborative editing** — multiple clients editing manifest simultaneously (WebSocket already supports this)
- **Workspace branching** — git-like branches for A/B testing edits
- **Template workspaces** — pre-built starter compositions users can fork
- **Self-healing loop** — AI renders a still, checks it against the plan, fixes issues (already partially built)
