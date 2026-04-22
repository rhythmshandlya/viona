# Asset System — Research & Discovery

**Date:** 2026-04-19
**Status:** Research complete, alignment locked — ready to plan
**Scope:** Redesign of Viona's asset feature to support global + project assets, multi-asset uploads, chat-as-ingest, and sandbox-synced AI workflows

---

## 1. Original Brief

> Next, we need to work on the asset features.
>
> 1. Understand how the current asset feature works (dropping things in the chat and what we see on the asset tab) — figure out what is broken.
> 2. Then use this context to spin out agents to research extensively on how systems like ours should handle assets properly — sandbox and FE and cloud synced on what's in the assets properly.
> 3. Research on how modern NLE editors manage assets (global vs. local) assets.
>
> Here are some notes on how I feel assets will mature in coming few weeks:
>
> 1. We will have **global assets**.
> 2. We will have **local project assets**.
> 3. We currently only allow single video to be uploaded. This will change — we will allow dumping everything, and then AI will edit the video end-to-end after analyzing all the assets.
> 4. The assets tab will kind of sync with the `public` folder of the sandbox, and all local assets will sit there. These will be organized by the agent properly in structured layout, and we will see this in the assets as well.
> 5. Anytime user can drop new assets. User can also drop assets in chat and tell things about it, and we keep them in assets as well. It can also be screenshots of what user wants — we can persist them too on the filesystem.
>
> After the groundwork is laid down, we will have multimodal analysis architecture (SigLIP and stuff) to analyze these assets so that these can be automatically arranged on the timeline properly. We will not do this now, but **the architecture will work around it**.

---

## 2. Current State Investigation

### 2.1 Assets Tab (editor left sidebar)

**Component:** `apps/web/src/features/editor-v2/panels/AssetsPanel.tsx` (lines 1–669)

**Data displayed & sources:**
- **Scene assets** (extracted from visuals): `api.getAssets()` → `GET /api/projects/:id/assets` — reads MinIO `sources` bucket or local workspace, returns `ExtractedAsset[]` with types: `component | element | text | shape | icon | background`.
- **Uploaded assets** (user media): `api.getProjectMedia()` → `GET /api/projects/:id/media` — reads `projectAssets` table, URLs via MinIO presigned.
- **Scene timing**: `api.getScenes()` → `GET /api/projects/:id/scenes` — `startMs`, `endMs`, `contentDisplayMs` from `visuals.timestamps`.

**User actions supported:**
- Upload (drag-and-drop into panel): `api.uploadProjectMedia()` (multipart POST)
- Delete: `api.deleteProjectMedia()`
- Drag to timeline: sets `application/x-project-asset` data; drop handler creates video/audio/image items
- Rename: inline label editing
- Preview: thumbnails for images, icons for audio/video (L362–368, L443–454)
- Scene seek: click asset → timeline seeks + element highlight (L241–264)

**Implemented vs. stubbed:**
- ✅ Upload with progress (L186–214)
- ✅ Drag to timeline with auto-track creation (L465–504)
- ✅ Scene asset browser with expand/collapse (L537–615)
- ⚠️ `onEditWithAI` callback declared (L651–664) but parent (`Editor.tsx`) never wires it

### 2.2 Chat Drop-Zone (AI Assistant Panel)

**Component:** `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx`

- Attachments queued via `handleAttachmentSelect()` (L861–870) — **only via button click, no drag-drop zone**
- Dropped files become "attachments" in state (L141), not automatic assets
- `handleSendWithAttachment()` (L1090–1126) uploads via `api.uploadProjectMedia()`, then prefixes message with `[Attached: label]` tags
- **File types accepted:** `image/*,.svg` (L1304) — narrower than Assets panel
- Backend validation (`/projects/:id/media` POST): PNG, JPEG, WebP, GIF, SVG only (L957)
- Agent sees text-only references (`[Attached: x]`), **has no way to read file content**

### 2.3 Sandbox Integration

**Sync module:** `packages/sandbox/src/asset-sync.ts`

- Walks `/workspace/public/` every sync interval, uploads files to MinIO bucket `viona` with prefix `${SANDBOX_ID}/${relative_path}` (L62–102)
- **Excludes:** `.build/` artifacts, `manifest.json` symlinks, full-res matts (L87–107)
- Generates presigned URLs (24h TTL) and updates `manifest.assets` map (L109–135)
- Frontend fetches `manifest.assets` via `useWorkspaceComposition` hook

**API routes:**
- `GET /api/projects/:id/assets` — reads visuals timestamps + S3 `sources/${compositionId}/assets.json` (L1358–1434)
- `POST/GET/PATCH/DELETE /api/projects/:id/media` — CRUD for `projectAssets` (L936–1118)
- `GET /api/projects/:id/scenes` — from visuals timestamps or S3 `scenes.json` (L1228–1330)

**Storage backend (MinIO/S3):**
- Uploaded media: bucket `uploads`, key `assets/${projectId}/${nanoid()}.${ext}` (L970)
- Rendered visuals: bucket `sources`, key `${compositionId}/{assets,scenes}.json`
- Presigned URL TTL: 8h video/audio (L212), 24h assets (asset-sync L12)

### 2.4 Database Schema (`packages/api/src/db/schema.ts`)

```ts
projectAssets (L139–152):
  id (uuid PK), projectId (FK → projects, cascade),
  filename, label, description,
  storageKey (varchar 500),   // MinIO object key
  contentType, fileSize,
  durationMs, width, height,
  createdAt

visuals (L104–136):
  id, projectId, compositionId,
  timestamps: jsonb [{ startMs, endMs, type, description,
                       sourceSceneId?, elements?: [{id, name, type, x, y, width, height}] }],
  sourceSceneIds: number[]    // 1-indexed scene file IDs
```

**Relationships:**
- `projects` 1→* `projectAssets` (cascade delete)
- `projects` 1→1 `visuals` (cascade delete)
- **No junction for asset ↔ composition** — assets are either extracted (visuals) or uploaded (projectAssets)
- **No user-scoped / global asset concept**

### 2.5 Upload Pipeline

**Single-video-at-creation:**

1. `POST /projects` (L60) — accepts filename, title, content-type
2. Detects audio vs. video by extension (L64–66)
3. Generates storage key `${nanoid()}/${filename}` in `uploads` bucket
4. Creates `projects` row with `videoKey` or `audioKey`
5. Returns presigned PUT URL (client upload) OR accepts proxy via `POST /projects/:id/upload` (L105)
6. Transcription triggered via `POST /projects/:id/process` (L726):
   - Queues transcribe job (audio extraction + STT)
   - Queues head-tracking job for videos (parallel)

**No bulk upload endpoint.** Media assets go through `/projects/:id/media` (images only).

### 2.6 Breakage Summary

| # | Issue | Location | User impact |
|---|---|---|---|
| 1 | Audio/video rejected by media endpoint | `routes.ts:957` `allowedTypes` | Drag-drop of `.mp3`/`.mp4` silently fails |
| 2 | Chat has no drag-drop zone | `AIAssistantPanel.tsx` | Must click button to attach |
| 3 | Agent can't read attachment content | chat → agent boundary | Agent sees `[Attached: x]` text only |
| 4 | No duration/dimensions extraction | media POST handler | Audio/video if allowed would have 0ms duration on timeline |
| 5 | No dedup | upload flow | Same file → two rows, two MinIO objects |
| 6 | Presigned URL expiry (8h) | L212 | Assets vanish in long sessions |
| 7 | No user-global library | schema | All assets project-scoped |
| 8 | `onEditWithAI` unhooked | `AssetsPanel.tsx:651` | Button exists but does nothing |
| 9 | Chat attachments not first-class assets | conversation ↔ projectAssets split | No provenance, no re-use |
| 10 | Directory-sweep sandbox sync | `asset-sync.ts` | Generated outputs lack provenance & are bucket-scoped by `SANDBOX_ID` (orphans on sandbox death) |

---

## 3. Research: Modern NLE Asset Management

### 3.1 Global vs. Project-Local

**Traditional NLEs draw a hard line.**
- **Premiere Pro:** `.prproj` contains project bins. Cross-project reuse via **Creative Cloud Libraries** (LUTs, graphics, presets — explicitly cross-project).
- **DaVinci Resolve:** Media Pool is per-project. **Media Storage** mounts system folders as persistent source. **Power Bins** are database-wide (visible across all projects in the same Resolve DB).
- **Final Cut Pro X:** Inverts the hierarchy — **Libraries** contain Events contain Projects. Library is the "global" scope the user chooses.
- **Avid Media Composer:** Shared bins within a project; **Avid MediaFiles** is a machine-global media store.

**Cloud/AI tools collapse the distinction.**
- **CapCut Web / Descript / Runway:** single account-level library. Project references items from it.
  - Descript: "Drive"
  - Runway: "Assets"
  - CapCut: "Cloud"
- **Descript** does have project-scoped "Scenes" and "Media" tabs, but underlying files live in account drive and are referenced by ID.
- **Opus Clip:** No library. Upload per-job; outputs listed in "My Clips."
- **Frame.io:** Workspaces → Projects; assets can be moved/referenced across.

**The pattern:** user expectation split is now **"my uploads"** (global, account-level, searchable) vs. **"what's in this edit"** (project-local, ordered, trimmed).

### 3.2 Organization Patterns

- Traditional tools: **bins (folders)** with manual tagging. Premiere's Metadata panel is rich but rarely used.
- Resolve's **Smart Bins** (rule-based filters) are loved by pros, invisible to casuals.
- **FCPX is the outlier** — pushes **keywords + ratings + smart collections**, de-emphasizes folders. Events are flat; Keyword Collections are the real primitive. **Most-imitated idea in AI tools.**

**Metadata universally surfaced:** thumbnail, duration, resolution, codec, file size.

**AI-tool additions:**
- Transcript preview (Descript, Submagic)
- Auto-generated scene label/description (Runway, CapCut AI tags)
- Speaker name (Descript)
- Highlight score (Opus Clip, Gling)

**Descript standout:** transcript preview shown directly in the asset tile.

**Flat + tags wins in AI-first tools.** Descript, Runway, CapCut all default to flat lists with filters (type, date, project-used-in). Folders exist but secondary. Opus Clip has no folders at all.

### 3.3 Upload + Ingest

**Drag-drop targets (three common):**
1. Sidebar panel (Premiere Project panel, Resolve Media Pool, Descript Drive)
2. Timeline directly (all NLEs — both imports and places)
3. Dedicated modal (Runway, Opus Clip, Submagic — often primary because job-oriented)

**Bulk upload UX:**
- **Frame.io is gold standard** — chunked uploads, per-file progress, resume on network drop, parallel lanes
- Descript, CapCut Web use tus.io-style resumable
- Runway: queue with retry buttons
- Premiere/Resolve: synchronous copy/import (feels dated)

**Auto-analysis on ingest** (where AI tools differentiate):
- **Descript:** transcribes immediately (Whisper-class) + speaker diarization + filler-word extraction — before user clicks anything
- **Opus Clip:** highlight detection, virality scoring, face tracking
- **Submagic / Gling:** silence detection + transcript
- **Runway:** captions/tags for visual search; first-frame thumbs for video
- **CapCut:** scene detection + auto-captions
- **Resolve Studio:** Smart Reframe, STT — but manual triggers

**Proxies:**
- Pro NLEs: generate low-res proxies on ingest (Premiere, Resolve, FCPX, Avid)
- Cloud tools: **HLS/DASH adaptive streams** server-side — user never sees the word "proxy"
- Frame.io and Descript both transcode to streamable formats automatically

### 3.4 Multi-Modal Assets Beyond Source Video

Traditional NLEs treat everything as a "clip" in the bin. FCPX's **Generators / Motion templates** are a separate panel, distinguishing generative assets from captured media.

**AI tools split "reference" from "usable":**
- **Runway:** separate trays for "Input images" vs. "Generations" — inputs are reference, outputs go to timeline
- **Descript:** "Scenes" (composable overlays/layouts) vs. "Media" (raw files). Audiograms, lower-thirds, stock B-roll in separate "Stock" panel (Storyblocks)
- **Midjourney / Runway:** treat prompts + reference images as first-class assets attached to generations

**Emerging pattern:** **"inspiration board" / moodboard** as a distinct surface (Runway workspace, Krea boards, Figma-style canvases). **Not yet standard in NLEs — clear differentiation opportunity.** Descript's document/image drop into script for AI context is the closest analog.

### 3.5 Cloud-Synced Asset Patterns

**Storage architecture is remarkably consistent across tools:**
- Object storage (S3/GCS/R2) for blobs
- Postgres / DynamoDB for metadata
- CloudFront / Cloudflare CDN for delivery

Frame.io, Descript, CapCut, Runway all follow this. Descript additionally caches locally in Electron app SQLite.

**Frame.io's NLE integration is most sophisticated:** Premiere/Resolve panel downloads proxies on demand, local originals optional, "C2C" (camera-to-cloud) flow where assets appear as shot. Reconciliation is one-way (cloud = source of truth).

**Figma-style hierarchies** (Team → Project → File → Page) don't map cleanly to video — video projects are heavier and fewer.

**Replit / CodeSandbox's repo-as-filesystem** is closer to what a sandboxed agent needs: one flat workspace with structured paths.

**Conflict resolution** mostly avoided by single-writer semantics (one user edits at a time, or CRDT at the timeline level as Descript does). Offline rarely supported in cloud tools; Premiere/Resolve are offline-first with relink workflows.

### 3.6 AI-Aware Asset Systems

**Eager computation (on upload):** transcript, thumbnails, scene boundaries, face/speaker detection, visual/text embeddings, silence map, loudness. Descript, Runway, Opus Clip, Gling all do this.

**Universal lesson:** **transcripts are the single most-leveraged derived asset** — power search, editing-by-text, chapters, captions.

**On-demand:** highlight reels, reframes, generated B-roll, style-transfer. Too expensive to run eagerly.

**Embedding retrieval is the quiet revolution.**
- Runway: CLIP-style embeddings for "find similar shot"
- Twelve Labs (B2B, powers several consumer tools): "find the moment where someone says X while holding a phone"
- Descript: transcript-based search (no visual embedding yet, publicly)

**Underexplored primitive in consumer NLEs.** SigLIP/CLIP embeddings on ingest is where Viona can differentiate.

### 3.7 Recommendations for an AI-First Editor

1. **Single global asset library + project references by ID** (Descript/Runway model). Projects are views. Sandbox mounts library as read-only virtual FS; project-local derivations (renders, cached frames) in writable project scope.
2. **Eager multi-modal analysis on ingest:** transcript + speaker diarization + scene cuts + visual embedding + generated description. Store as sidecar JSON next to asset in sandbox so agent reads them as plain files.
3. **Distinct "reference" vs. "media" surfaces** in sidebar. References (moodboard images, PDFs, notes dropped in chat) = context for agent. Media = renderable. **Gap in existing NLEs; fits agentic model.**
4. **Flat + tags + smart collections** over folders (FCPX-inspired). Agent auto-tags on ingest (`talking head | screen recording | B-roll | logo`). Expose Resolve-style smart bins as saved filter queries.
5. **Chat-as-ingest is first-class.** Files dropped into AI chat appear in Assets tab immediately, flagged with provenance (`added via chat at turn 7`). Single mental model. **No existing tool does this well** — Descript closest with document drop into scripts.

---

## 4. Research: Sandbox + FE + Cloud Sync Architecture

### 4.1 Source-of-Truth Models

**DB-first (dominant pattern for multi-tenant SaaS):**
- DB holds authoritative `assets` rows (id, owner, s3_key, mime, size, hash, metadata)
- S3 holds bytes
- Sandbox is disposable cache
- Writes: sandbox FS → upload to S3 → insert DB row → push event to UI
- **Pro:** single query answers "what assets exist"; easy RBAC; consistent listings
- **Con:** agent must register files explicitly OR reconciler must scan; unregistered writes invisible to UI

**Filesystem-first:** sandbox FS is truth, DB indexes it (inotify → indexer → DB). Works for Replit/Codespaces where FS *is* the product. **Bad fit for video editing:** sandboxes are ephemeral, users can upload without a live sandbox, multi-GB files shouldn't need running container.

**Hybrid / event-sourced:** every mutation is append-only event (`AssetCreated`, `AssetMutated`, `AssetDeleted`). DB + S3 are projections. CRDTs overkill here — binaries are immutable and versioned. **Simple event log gives replay, audit, real-time fanout.**

**→ Recommendation: DB-first with an event table for UI fanout.**

### 4.2 Upload Paths

1. **Presigned POST direct to S3** — browser uploads to S3, then hits API to register. Scales infinitely, no API bottleneck, handles multi-GB. **Frame.io, Descript, Loom, Canva.**
2. **Proxy through API** — API streams to S3. Simpler auth/validation, but burns API bandwidth. Fine for <50MB, bad for video.
3. **Stream through sandbox** — almost never right. Couples upload to sandbox health.

**Making file visible in sandbox** (video editor, lazy-download wins):
- **s3fs / goofys / rclone mount (FUSE):** simplest, looks like real dir; slow first-read, poor sequential IO
- **Stub files + custom read tool:** zero-byte placeholders or `manifest.json`; agent uses `read_asset(id)` tool that triggers download. **Auditable, progress hooks.**
- **Prefetch-on-mention:** when user @-mentions asset in chat, API hydrates into sandbox before agent runs

**Mid-session uploads:** register in DB first, then either push via API-to-sandbox RPC, or FUSE handles, or rely on lazy read.

### 4.3 Sandbox-to-UI Propagation

Four patterns, increasing reliability:

1. **Filesystem watcher** (inotify / chokidar sidecar) — agent writes files normally, watcher registers. Simplest mental model. **Fragile:** watchers miss events on Docker bind mounts (Windows note in project memory), rename storms create duplicates, partial writes race.
2. **Agent emits event** — agent writes to named pipe or logs structured JSON. Lightweight but requires discipline.
3. **Explicit `register_asset` tool** — agent calls MCP tool that uploads + registers atomically. **Most reliable, matches existing Claude Agent SDK custom-tool pattern.** Agent *wants* to signal "this is the output" anyway.
4. **Periodic reconcile** — scan FS every N seconds, diff against DB. Good safety net, bad as primary.

**What others do:**
- **Replit:** inotify → indexer, filetree WebSocket-streamed. FS-first (FS is the product).
- **CodeSandbox / StackBlitz:** virtual FS owned by client; CRDT-ish ops (StackBlitz WebContainers runs in-browser, no server FS).
- **GitHub Codespaces:** VS Code file-watcher over SSH; persistent volume, not ephemeral.
- **E2B:** filesystem API (`sandbox.files.list/read/write/watch`) — pattern #1 at SDK level. `watch` is debounced inotify.
- **Frame.io / Descript:** asset ingestion explicit (upload endpoint + worker). No FS watching.

**→ Recommendation: #3 (explicit tool) as primary, #4 reconcile as safety net.** Video editors have few meaningful outputs (final renders, generated clips) — agent knows when something is "done" and should say so.

### 4.4 Storage Layout

**Content-addressed + project-scoped (sweet spot):**

```
s3://viona/
  users/{user_id}/library/{sha256}           # global user library
  projects/{project_id}/assets/{asset_id}    # project-scoped
  projects/{project_id}/renders/{render_id}  # AI outputs
  projects/{project_id}/thumbs/{asset_id}.jpg
```

- Store `sha256` on asset row; on upload, check if row with hash exists for user and reuse S3 object (dedup)
- Use `asset_id` (UUID) in paths, not sha directly → can mutate metadata without renaming objects
- **Global vs. project-local split:** every asset has `user_id` (owner) and optional `project_id` (scope). Nullable `project_id` = "library asset." Copying into project = new asset row, same s3 key.

Frame.io does essentially this (asset + version + placement graph). Canva's media library is user-scoped with per-design references.

### 4.5 Metadata

**In DB:** id, owner, project, s3_key, mime, size, hash, width/height, duration, created_at, source (`upload | generated | derived`), parent_asset_id (AI outputs referencing inputs), status (`uploading | ready | failed`).

**Lazily derived, stored in DB after first compute:** thumbnail_key, waveform_key, transcript_key (separate assets or S3 siblings), ffprobe JSON blob.

**Pull, not push, for expensive things:** embeddings, transcripts. Kick off worker job on `ready`, UI polls or subscribes. **Don't block upload on them.**

**AI-generated files:** keep a `generations` table with `output_asset_id`, `input_asset_ids[]`, `prompt`, `agent_session_id`. **Provenance graph**, also feeds "regenerate with tweaks."

### 4.6 Ephemeral-Sandbox Problem

**Key insight: don't restore the sandbox; rehydrate on demand.**

Fresh sandbox starts with:
- Manifest (JSON) of project assets: `[{id, path, s3_key, hash, size}]`
- FUSE mount or lazy-reader that fetches on first access
- Agent working directory (code, scene plans, generated .tsx) restored from S3 as tarball

**E2B:**
- v1 persistence: snapshot-based (whole VM state)
- v2 (Firecracker templates + persistent storage mounts): mount a volume that survives; still has cold-start costs
- Recommended pattern: **template image has tools, mounted volume has project, S3 has assets**

**Docker equivalent:** named volumes per project + bind-mount or sidecar that pulls from S3.

**→ For Viona:** project state (scene plans, tsx files) is small — tar to S3 on sandbox shutdown, restore on startup. Assets stay in S3, lazy-loaded.

### 4.7 Concurrency

- **New upload mid-session:** API registers in DB → publishes event → sandbox sidecar writes stub or FUSE handles it → agent gets system message (`"new asset available: brand-logo.png"`). **Don't silently inject files; tell the agent.**
- **Atomicity:** upload to temp key, then atomic copy/rename in S3; insert DB row only after object exists. `status` field (`uploading → ready`) prevents UI showing half-uploaded files.
- **Locking:** assets are immutable by convention (new version = new asset_id). Kills 90% of concurrency issues. "Edits" are new derived assets with parent pointers.

### 4.8 Production Examples

- **Frame.io:** asset-centric, immutable versions, S3 + CloudFront, separate "comments/review" graph. Engineering blog on V4 ingestion pipeline emphasizes presigned multipart + async derivatives.
- **Descript:** project file is JSON doc in Postgres referencing S3 media; transcripts are separate assets linked by id. Rendering worker stateless.
- **Runway:** generation outputs are first-class assets with provenance; flat per-user library.
- **Canva:** Media Library service separate from Design service; designs reference media by id; heavy CDN use.
- **Figma:** not a great analogy — binary file is CRDT in their DB, not S3.
- **Replit:** persistent per-user home volume; inotify-driven filetree. Different constraints.
- **Dropbox Paper / Notion file embeds:** DB-first with S3; embeds are asset references resolved at render time.

**Relevant postmortems:**
- Dropbox's "Magic Pocket" migration (why you don't build your own object store)
- Figma's multiplayer sync post (CRDT bounds)
- Frame.io V4 ingestion deck

### 4.9 Recommended Architecture (Five Pillars)

1. **DB-first with `assets` table + `asset_events` append-only log.** Postgres row = truth; event log drives UI SSE/WebSocket fanout and audit. Fits existing Drizzle + Fastify SSE stack.

2. **Presigned multipart uploads direct browser → S3**, then `POST /assets/register` with key + client-computed sha256. Dedup by `(user_id, sha256)`. **Don't proxy multi-GB video through API.**

3. **Explicit `register_asset` MCP tool** for agent, matching existing Claude Agent SDK pattern (`createSdkMcpServer` + `tool()` with Zod). Agent calls with `(local_path, kind, parent_asset_ids[])`; tool uploads to S3, inserts row, publishes event. **Periodic reconcile as safety net.** Avoid inotify as primary (already documented flaky on Docker/Windows).

4. **Lazy hydration into sandbox via manifest + read-through cache.** Sandbox boots with `assets-manifest.json` (id → s3_key mapping). Small sidecar (or MCP `read_asset` tool) fetches on first access and caches locally. Tar agent working-dir state (scene plans, generated tsx, CLAUDE.md) to S3 on shutdown; restore on next boot. **Don't snapshot whole sandboxes.**

5. **Immutable assets with provenance edges.** Every AI generation creates new asset rows with `parent_asset_ids`. No in-place edits. Enables undo, regeneration, branching; kills concurrency headaches. Store keys as `projects/{pid}/assets/{asset_id}` (not hash-named) so metadata mutations never require object renames.

**Why this combo:** matches existing stack (Fastify + SSE, Drizzle, Agent SDK, MCP tools, ephemeral E2B/Docker sandboxes); no CRDTs or event-sourcing infrastructure we don't need; handles multi-GB video; makes agent outputs first-class; keeps sandboxes genuinely disposable.

---

## 5. Synthesis & Proposed Direction

Both research streams converge on the same architecture. The gap between current state and target state can be decomposed into **three mostly-independent workstreams**, each independently shippable.

### 5.1 Convergent Design Principles

| # | Principle | From NLE research | From sandbox research |
|---|---|---|---|
| 1 | Single user library + project references | Descript, Runway, CapCut | Nullable `project_id`, content-hash dedup |
| 2 | DB-first + event log | (implicit in all cloud tools) | Postgres + append-only events for SSE fanout |
| 3 | Presigned direct-to-S3 uploads | Frame.io, Descript, Loom | Scales to multi-GB, no API proxy |
| 4 | Explicit `register_asset` MCP tool | — | Matches SDK pattern, auditable |
| 5 | Lazy sandbox hydration | — | Manifest + read-through cache, don't snapshot |
| 6 | Immutable assets + provenance | Runway generations, Frame.io versions | `parent_asset_ids[]`, kills concurrency |
| 7 | Content-hash dedup | — | `(user_id, sha256)` unique |
| 8 | Flat + tags + smart collections | FCPX-inspired, Descript/Runway/CapCut | — |
| 9 | Eager ingest (thumbnail/duration/dims); async (transcript/embedding) | Descript, Opus Clip | Worker jobs, don't block upload |
| 10 | Reference vs. media split in UI | Runway input vs. generation | — |
| 11 | Chat-as-ingest first-class | Descript document drop (closest) | Provenance tag `source: chat` |

### 5.2 Target Schema (sketch)

```ts
// Replaces projectAssets; additive migration possible
assets: {
  id: uuid PK,
  userId: uuid FK → users,           // owner (enables global library)
  projectId: uuid? FK → projects,    // null = library asset
  parentAssetIds: uuid[],            // provenance edges
  source: 'upload' | 'generated' | 'chat' | 'derived',
  status: 'uploading' | 'ready' | 'failed',
  sha256: varchar 64,                // dedup key
  storageKey: varchar 500,           // S3 key
  filename, label, description,
  contentType, fileSize,
  durationMs?, width?, height?,
  thumbnailKey?, waveformKey?, transcriptKey?,  // derived sidecars
  tags: text[],                      // AI-assigned + user
  metadata: jsonb,                   // ffprobe blob, etc.
  createdAt, updatedAt,
  UNIQUE (userId, sha256)
}

asset_events: {
  id: uuid PK,
  assetId: uuid FK → assets,
  projectId: uuid? FK → projects,
  userId: uuid FK → users,
  type: 'created' | 'ready' | 'failed' | 'tagged' | 'deleted',
  payload: jsonb,
  createdAt
}

generations: {
  id: uuid PK,
  outputAssetId: uuid FK → assets,
  inputAssetIds: uuid[],
  prompt: text,
  agentSessionId: varchar,
  createdAt
}
```

### 5.3 Target Surfaces

**Assets panel (left sidebar, existing):**
- Tab switcher: **Library** (user-global) / **Project** (project-scoped)
- Sub-split: **Media** (renderable) / **References** (moodboard, chat drops, screenshots)
- Flat list + tag filters + smart collections
- Drag to timeline (project-scoped), drag from library → project copy
- Thumbnail + duration + transcript preview (Descript-style)

**Chat drop zone (AI Assistant Panel):**
- Full drag-drop overlay on panel
- Accept images, video, audio, PDFs, documents, text
- Dropped files → immediate asset row with `source: chat` + agent system message

**Sandbox:**
- Boot-time `assets-manifest.json` generation from DB
- MCP `read_asset(id)` tool — lazy download + local cache
- MCP `register_asset(path, kind, parentIds)` tool — agent-owned outputs become first-class assets
- Remove directory-sweep `asset-sync.ts`; replace with on-demand + reconcile sweep

### 5.4 Three Shippable Workstreams

**Workstream A: Schema + API + Upload Pipeline**
- New `assets` + `asset_events` + `generations` tables (additive)
- Presigned multipart endpoint
- `POST /assets/register` with sha256 dedup
- Eager ingest worker: thumbnail, duration, dimensions via ffprobe
- Backfill shim: `projectAssets` view → `assets` for read compatibility during rollout

**Workstream B: Sandbox Integration**
- Manifest generation on sandbox boot
- MCP `read_asset` + `register_asset` tools
- Tar-on-shutdown for agent working dir
- Deprecate `asset-sync.ts` directory sweep (keep behind flag until B ships)

**Workstream C: Frontend (Assets Panel + Chat)**
- Library/Project tabs; Media/References split
- Tag filters, smart collections UI
- Drag-drop zone in chat
- Provenance UI (show generation parent, source badge)
- SSE subscription to `asset_events`

**Async tier (can land in parallel or after):** transcription worker, visual embedding worker (SigLIP), smart-collection auto-rules — all triggered off `asset_events.type === 'ready'`.

---

## 6. Finalized Alignment Decisions

### 6.1 Library scope — **user-level**
- `assets.userId` FK (owner), `assets.projectId` nullable (null = library asset).
- No `orgId` column now. If team features ship later, add additive.
- Matches Descript/Runway/CapCut account-library semantics.

### 6.2 Analysis — **architected now, workers deferred**
Three text surfaces per asset; the fields exist now, population workers come later:

- `assets.autoDescription` — future SigLIP/vision worker populates; null now.
- `assets.userDescription` — user-provided (Assets panel edit).
- `assets.userIntent` — captures *what to do with the asset* ("use as B-roll at the hook"), filled when user drops in chat alongside a message. Distinct from `userDescription` because the user may describe action rather than content.

**Transcripts** are the one analysis we actually run now (existing worker). Hooked via a derived asset row + `assets.transcriptAssetId` pointer.

Deferred entirely: visual embeddings, scene detection, speaker diarization, auto-description.

### 6.3 Sandbox hydration — **MCP tool + local-disk hydration (pushing back on FUSE)**
Even on Linux Docker (where Windows caveats don't apply), pure FUSE (s3fs/goofys/rclone) has:
- High metadata cost per S3 list/head
- Poor sequential IO for multi-GB video
- Flaky mtime/lock semantics

**Decision: manifest-driven local-disk hydration.**
- Sandbox boots → reads `assets-manifest.json` from API.
- Sidecar lazy-populates `/workspace/assets/{assetId}/{filename}` via presigned GET on first access.
- Agent and preview treat paths as real files (fast local reads after first hydrate).
- Agent writes go through MCP `register_asset` tool → uploads to S3 → inserts DB row → publishes SSE event.

**Rationale:** auditable, no FUSE overhead, agent never needs to know about S3. Rebuilding sandbox is cheap — just regenerate manifest.

### 6.4 Scope — **full vertical slice including transcript-driven arrangement**

| In scope | Out of scope |
|---|---|
| Multi-asset drop at project-create + prompt (replaces single-video flow) | Visual embedding / SigLIP |
| Chat drop-zone → first-class assets with `source: chat` + `userIntent` | Scene detection, speaker diarization, auto-description (workers) |
| Assets panel: Library + Project tabs, drag-to-timeline | Mid-session agent auto-reaction to new uploads |
| Preview integration — any asset resolves in Remotion composition | Trim-editor sandbox feature |
| Sandbox manifest + local hydration | |
| Eager transcript on audio + video (existing worker) | |
| **Arrangement agent — transcript-driven first pass, extensible input** | |
| Pipeline events → chat progress bubbles (`transcribing`, `arranging`) | |
| User manually refines timeline after first pass | |

### 6.5 Migration — **additive with feature flag**
- New `assets` table added alongside `projectAssets`.
- Drizzle view bridges the old table for read compatibility during rollout.
- `ASSET_SYSTEM_V2` feature flag gates new endpoints + UI.
- Delete old path after stable window.

### 6.6 Eager ingest ceiling
- **Sync on upload** (blocking): thumbnail (ffmpeg), duration + dims (ffprobe) — cheap.
- **Async on `ready`** (non-blocking worker): transcript for audio + video.
- **Deferred:** embeddings, auto-description, scene detection, diarization.

### 6.7 Reference vs. media — **dropped from the design**
User's answers imply everything uploaded is an asset, period. UI filters by mime/type; no semantic distinction between "context" and "media." Agent reads descriptions + transcripts; timeline reads media files. Same row either way. Simpler.

### 6.8 User Flow (canonical, end-to-end)

#### Phase 1 — Create
1. User lands on "New Project" page. Multi-asset drop + prompt textarea + Create button.
2. User drops N files (any type: video/audio/image/PDF/text/screenshot) + types a prompt.
3. User clicks Create. Frontend per file: presigned multipart → direct S3 upload → client-computed sha256 → `POST /assets/register`. Server dedups by `(userId, sha256)`, inserts `assets` row (`projectId=new`, `source='upload'`, `status='ready'`), enqueues eager ffprobe+thumbnail job.
4. Project row created with the create-time prompt stored as the first user message in the conversation.
5. Redirect to editor.

#### Phase 2 — Editor + ingest pipeline
6. **Sandbox boots** (backend, parallel with UI load).
7. **Editor loads normally.** All panels visible. User lands on chat tab. Assets panel populates with tiles as registrations commit (normal behavior). Timeline + preview empty.
8. **Chat shows the initial prompt** as a sent user message (committed at create time).
9. **Chat streams pipeline progress bubbles** (`role: 'pipeline'` messages):
   - `⏳ Transcribing intro.mp4...` → `✓ Transcribed`
   - `⏳ Analyzing content...` — **feature-flagged off until visual-analysis workers ship**
   - `⏳ Arranging timeline...` → `✓ Done`
10. **Arrangement agent runs once** at end of transcription with `{prompt, assets, transcripts}`. Produces `timelineItems[]` + a summary string. Timeline populates; preview shows first pass. Summary lands in chat as an assistant message.

#### Phase 3 — User refines
11. User drags, trims, reorders timeline items manually. Preview updates live.

#### Phase 4 — Mid-session additions (passive)
12. User drops files into Assets panel → same upload/register flow → tile appears via SSE. Sandbox manifest updates.
13. User drops files into chat → assets created with `source='chat'` + `userIntent=<chat message text>`. Appear in panel with a "from chat" badge.
14. **Agent does not auto-react** to 12 or 13. User arranges manually or asks agent in a follow-up message.

#### Phase 5 — Follow-up chat turns
15. User messages the agent. Agent uses updated manifest + transcripts + timeline state as context. Agent may register generated assets via `register_asset`. Agent does not silently mutate timeline (explicit action only).

#### Phase 6 — Library
16. User clicks "Save to Library" on a project asset → new `assets` row with `projectId=null`, same S3 key (dedup).
17. In another project, user drags from Library tab → new project-scoped row referencing same S3 key.

---

## 7. Refined Workstream Plan

### 7.1 Schema Lock-In

```ts
// ADDITIVE — projectAssets retained behind view during rollout
// Assets are user-owned. Projects link to them via asset_project_links (N:M).
// Library tab = all user's assets. Project tab = assets linked to this project.
assets: {
  id: uuid PK,
  userId: uuid FK → users,           // owner, required
  parentAssetIds: uuid[],            // provenance edges (for generated/derived)

  source: 'upload' | 'generated' | 'chat' | 'derived',
  status: 'uploading' | 'ready' | 'failed' | 'deleted',   // soft-delete

  sha256: varchar 64,                // dedup key (user-scoped)
  storageKey: varchar 500,           // s3 key — content-addressed: users/{userId}/assets/{sha256}
  filename: varchar,
  mimeType: varchar,
  fileSize: bigint,

  // Descriptive surfaces (mutable)
  label: varchar,                    // user-editable display name
  userDescription: text?,            // user edits in panel
  userIntent: text?,                 // captured from chat drop message
  autoDescription: text?,            // future vision worker
  tags: text[],

  // Media metadata (eager, populated by asset-metadata worker)
  durationMs: int?, width: int?, height: int?,

  // Derived sidecars (lifecycle tied to parent; not first-class)
  thumbnailKey: varchar 500?,
  waveformKey: varchar 500?,
  thumbnailStatus: 'pending' | 'ready' | 'failed' | 'not_applicable',
  waveformStatus: 'pending' | 'ready' | 'failed' | 'not_applicable',

  // Derived first-class (searchable/linkable, separate Asset row)
  transcriptAssetId: uuid?,
  transcriptStatus: 'pending' | 'ready' | 'failed' | 'not_applicable',

  metadata: jsonb,                   // ffprobe blob + future extensibility
  createdAt, updatedAt,
  UNIQUE (userId, sha256)
}

asset_project_links: {                // N:M junction — assets × projects
  id: uuid PK,
  assetId: uuid FK → assets (cascade),
  projectId: uuid FK → projects (cascade),
  addedVia: 'upload' | 'chat' | 'generated' | 'library',
  addedAt: timestamp,
  UNIQUE (assetId, projectId)
}

asset_events: {                       // append-only audit + SSE fanout
  id: uuid PK,
  assetId: uuid FK → assets,
  projectId: uuid? FK → projects,   // null for user-scoped events
  userId: uuid FK → users,
  type: 'created' | 'ready' | 'metadata_ready' | 'transcript_ready'
      | 'linked' | 'unlinked' | 'renamed' | 'deleted' | 'failed',
  payload: jsonb,
  createdAt
}

generations: {
  id: uuid PK,
  outputAssetId: uuid FK → assets,
  inputAssetIds: uuid[],
  prompt: text,
  agentSessionId: varchar,
  createdAt
}

// NEW pipeline message role alongside 'user' | 'assistant'
conversation_messages.role: 'user' | 'assistant' | 'pipeline'
// pipeline payload shape:
//   { eventType: 'transcribing' | 'transcribed' | 'analyzing' | 'analyzed'
//                | 'arranging' | 'arranged',
//     assetId?, progress?, details? }
// UI renders 'analyzing'/'analyzed' only when feature flag ANALYSIS_WORKERS is on.
```

### 7.1a Arrangement Agent Interface (extensibility socket)

Forward-compatible input: nullable fields populated by future workers without interface change. The prompt template already references them conditionally, so the agent starts using them the moment they're non-null.

```ts
type ArrangementInput = {
  prompt: string;
  assets: {
    id: string;
    filename: string;
    mimeType: string;
    durationMs?: number;
    userIntent?: string;
    userDescription?: string;
  }[];
  transcripts: {
    assetId: string;
    text: string;
    segments: { startMs: number; endMs: number; text: string }[];
  }[];

  // Forward-compatible sockets — empty now, populated by future workers.
  visualAnalyses?:     { assetId: string; embedding?: number[]; labels?: string[] }[];
  sceneBoundaries?:    { assetId: string; cuts: number[] }[];
  speakerDiarization?: { assetId: string; segments: { speakerId: string; startMs: number; endMs: number }[] }[];
  highlights?:         { assetId: string; scores: { startMs: number; endMs: number; score: number }[] }[];
  autoDescriptions?:   { assetId: string; description: string }[];
};

type ArrangementOutput = {
  timelineItems: {
    assetId: string;
    trackIndex: number;
    startMs: number;
    durationMs: number;
    sourceStartMs?: number;    // for video/audio trim
    sourceDurationMs?: number;
  }[];
  summary: string;             // shown in chat as an assistant message
};
```

**Endpoint:** `POST /projects/:id/arrangement/compute` — accepts `ArrangementInput`, dispatches Claude Opus via Agent SDK, returns `ArrangementOutput`. Triggered automatically once transcription completes (first pass). Re-callable on demand (future "re-arrange" button, or retroactively once analysis workers ship).

### 7.2 Three Independently Shippable PRs

**PR-A: Core data + ingest + arrangement agent (backend)**
- Migration: `assets`, `asset_events`, `generations` tables; `conversation_messages.role` adds `'pipeline'`
- `projectAssets` → `assets` read-compat view behind `ASSET_SYSTEM_V2`
- `POST /assets/upload-urls` — presigned multipart init, returns upload URLs + temp asset id
- `POST /assets/register` — client posts sha256 + mime after S3 upload completes; server atomically: checks `(userId, sha256)` dedup, inserts row with `status: ready`, enqueues eager metadata job
- Eager metadata worker: ffprobe (duration, dims) + thumbnail + waveform → updates row
- Transcript worker trigger on audio/video → inserts derived asset + updates `transcriptAssetId` → emits `pipeline` event (`transcribing`/`transcribed`) to the project conversation
- `asset_events` SSE stream per-project + per-user
- **Arrangement agent** — Claude Opus via Agent SDK; input shape per §7.1a; triggered automatically when transcript workers drain for the project; emits `pipeline` events (`arranging`/`arranged`), writes `timelineItems` to project composition, posts summary as assistant message
- `POST /projects/:id/arrangement/compute` — manual trigger + future re-arrange hook
- Prompt template references nullable analysis fields conditionally (inert until populated)
- `ANALYSIS_WORKERS` feature flag (off now) gates `analyzing`/`analyzed` pipeline events

**PR-B: Sandbox integration**
- `assets-manifest.json` generated at sandbox boot from DB (`projectId` + user library)
- Hydration sidecar: watches `/workspace/assets/{id}/` reads, fetches from S3 on demand via presigned URL, caches to disk
- MCP tool `read_asset(id)` — explicit read hook (alt path for agent code that wants the path)
- MCP tool `register_asset(local_path, kind, parent_asset_ids[])` — uploads to S3, inserts row, publishes event
- Remove `asset-sync.ts` directory-sweep (feature-flagged during rollout)
- Tar agent working-dir state (scene plans, generated tsx) to S3 on shutdown; restore on boot

**PR-C: Frontend surfaces**
- **Project-create flow rework:** multi-asset drop zone + prompt textarea; submit creates project + assets + commits the create-time prompt as the first user message
- **Assets panel:** Library | Project tab switcher, flat list with type filter (video/audio/image/doc/text); "Save to Library" action on project assets
- **Chat drop-zone:** full-panel drag overlay; dropped files create assets with `source: chat`; accompanying message text saved as `userIntent`; "from chat" badge in panel
- **Pipeline message bubble:** new `role: 'pipeline'` renderer in chat — progress/status UI with spinner → checkmark; `analyzing` event type hidden by `ANALYSIS_WORKERS` flag
- **Drag-to-timeline:** updated to resolve assets via new schema
- **Preview integration:** Remotion composition pulls asset URLs from `assets` table (presigned, auto-refresh on expiry via `asset_events`); timeline populates from arrangement agent output when first pass completes
- **SSE subscription:** UI reacts to `asset_events` (asset tile appears, status flips, thumbnail populates) + conversation `pipeline` messages (progress bubbles)

### 7.3 Ordering
- **A first** — gives working upload path; old editor keeps functioning on projectAssets-view.
- **B second** — wires sandbox; agent-generated outputs become first-class.
- **C third** — visible surface; enables new project-create flow + chat drops + preview.
- Flag stays on until all three stable; then remove `projectAssets` compat layer.

---

## 8. Next Step

Write three separate implementation plans (one per PR) via `superpowers:writing-plans`. Each plan self-contained, executable via `superpowers:subagent-driven-development`.

**Ordering:** PR-A → PR-B → PR-C. Each PR is shippable independently behind the `ASSET_SYSTEM_V2` feature flag.

**Phase-2 readiness:** Architecture accommodates future multimodal analysis (SigLIP, embeddings, auto-description, scene detection, speaker diarization, highlight scoring) without schema changes. New workers populate existing nullable columns on `assets` + create derived asset rows. The arrangement agent's input socket (§7.1a) already declares these fields as optional and the prompt template references them conditionally — Phase 2 is a pure worker+flag flip, not an interface change.
