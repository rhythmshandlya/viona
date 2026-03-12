# Unified Timeline Architecture — Design Spec

**Date:** 2026-03-12
**Status:** Draft
**Scope:** Full architectural redesign of Viona's editing pipeline — unifying frontend preview, backend export, and AI scene generation into a single composition system with manifest-driven timeline and semantic embedding layer.

---

## Problem Statement

Viona currently has three separate Remotion rendering systems:

1. **Frontend `Composition.tsx`** (~1959 lines) — renders preview in the browser. Handles video, captions, and layout independently. Loads AI-generated visual bundles as opaque CJS files via `new Function()` eval with custom module shims.

2. **Worker `FullComposition`** (~127 lines + ~760 lines AnimatedSubtitle) — renders export video. Wraps AI-generated scenes with video, simplified subtitles, and layout. Reads from `composition-props.json` constructed at render time.

3. **AI-generated `Scene*.tsx` + `index.tsx`** — visual content authored by Claude in an isolated workspace. Bundled once, uploaded to S3, then treated as a frozen artifact.

These three systems have separate rendering code, separate data sources, and separate layout implementations. This causes:

- **Preview ≠ Export**: Captions use different rendering code (rich frontend vs. simplified worker). Users see different output in preview vs. export.
- **Blind AI generation**: The Animator generates scenes without knowing if they'll be rendered as overlays, stacked panels, or fullscreen. It can't design around the speaker video.
- **Opaque visual items**: Frontend loads bundles via eval. Can't inspect, edit, or interact with visual content. Timeline items are metadata pointers, not live composition elements.
- **No seamless transitions**: Scenes render in isolated `<Sequence>` blocks with hard cuts. No cross-scene transitions (crossfade, slide, etc.).
- **~3,700 lines of duplicated code**: Layout math, caption rendering, video handling all implemented separately in frontend and backend.
- **AI limited to scene code**: The Creative Director agent can only edit Scene*.tsx files. Cannot adjust timing, layout, display modes, or caption styles.

---

## Design Decisions (from brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| Architecture approach | Layered composition (Approach C) — shared CompositionCore with thin preview/export shells | True rendering parity without mixing editor UI into composition code |
| Bundler strategy | Shared bundler service, queue-based | Supports multiple concurrent projects without per-project process overhead |
| Bundle rebuild speed | Proper Remotion bundling (5-10s), not hacky eval | Reliability over speed; most edits are manifest-only (instant) |
| Source of truth | Manifest.json in workspace | Single canonical format consumed by frontend, AI, and export |
| Workspace persistence | Idle timeout (spin up on load, tear down after inactivity) | Warm while active, clean up after — fits Railway resource constraints |
| DB role | Durable storage — workspace synced back to DB on teardown + periodic checkpoints | DB stays authoritative for persistence, workspace is the live working copy |
| Concurrent editing | Mutual exclusion — lock prevents simultaneous user and AI edits | Simple, no conflicts, no operational transform complexity |
| AI manifest access | Scoped tools (not raw file access) | Validated operations prevent manifest corruption |
| Caption unification | Full-featured renderer moves into CompositionCore | One implementation for preview and export — no drift |
| Scene isolation | Scenes stay isolated React components, unchanged by this redesign | Existing generation prompts and pipeline survive intact |
| Embedding model | Gemini Embedding 2 (natively multimodal) | Text, image, video, audio in one vector space — no separate models |

---

## Architecture Overview

### Workspace Structure

```
workspaces/{projectId}/
  ├── manifest.json              ← Single source of truth for timeline
  ├── src/
  │   ├── CompositionCore.tsx    ← Shared rendering engine
  │   ├── PreviewShell.tsx       ← Thin wrapper for frontend player
  │   ├── ExportShell.tsx        ← Thin wrapper for export render
  │   ├── Root.tsx               ← Remotion entry, registers compositions
  │   ├── index.tsx              ← registerRoot
  │   ├── scenes/
  │   │   ├── Scene1.tsx         ← AI-generated visual content
  │   │   └── Scene2.tsx
  │   ├── captions/
  │   │   ├── AnimatedSubtitle.tsx   ← Full-featured caption renderer
  │   │   ├── animations/            ← 30+ animation types
  │   │   └── effects/               ← Shadow, glow, stroke
  │   ├── layout/
  │   │   ├── utils.ts           ← Layout computation (single copy)
  │   │   ├── SpeakerVideo.tsx
  │   │   ├── VisualsLayer.tsx
  │   │   └── PiPVideo.tsx
  │   └── constants.ts
  ├── public/
  │   ├── source.mp4             ← Speaker video
  │   └── assets/                ← Images, clips, broll
  └── transcript.json
```

### Data Flow

```
                    ┌─────────────────────────┐
                    │     manifest.json        │
                    │  (single source of truth) │
                    └────┬──────┬──────┬───────┘
                         │      │      │
              ┌──────────┘      │      └──────────┐
              │                 │                  │
     ┌────────▼────────┐ ┌─────▼──────┐  ┌───────▼────────┐
     │  Frontend        │ │  AI Agent   │  │  Export         │
     │  Zustand reads   │ │  reads +    │  │  reads manifest │
     │  manifest →      │ │  edits via  │  │  directly       │
     │  Player renders  │ │  scoped     │  │                 │
     │  CompositionCore │ │  tools      │  │  Remotion SSR   │
     │  from bundle     │ │             │  │  renders        │
     └─────────────────┘ └─────────────┘  │  CompositionCore │
                                           └─────────────────┘
```

---

## Manifest Format

```jsonc
{
  "version": 1,
  "fps": 30,
  "durationMs": 30000,
  "canvas": { "width": 1080, "height": 1920 },

  "tracks": [
    { "id": "t1", "type": "video", "name": "Speaker", "position": 0 },
    { "id": "t2", "type": "visual", "name": "Visuals", "position": 1 },
    { "id": "t3", "type": "caption", "name": "Captions", "position": 2 },
    { "id": "t4", "type": "audio", "name": "Audio", "position": 3 }
  ],

  "items": [
    {
      "id": "i1", "type": "video", "trackId": "t1",
      "startMs": 0, "endMs": 30000,
      "data": {
        "src": "source.mp4",
        "crop": { "x": 50, "y": 50, "scale": 1.0 }
      }
    },
    {
      "id": "i2", "type": "visual", "trackId": "t2",
      "startMs": 0, "endMs": 8000,
      "data": {
        "sceneFile": "scenes/Scene1.tsx",
        "displayMode": "default",
        "frameOffset": 0,
        "transition": {
          "enter": { "type": "fade", "durationMs": 200 },
          "exit": { "type": "crossfade", "durationMs": 300 }
        }
      }
    },
    {
      "id": "i3", "type": "visual", "trackId": "t2",
      "startMs": 8000, "endMs": 15000,
      "data": {
        "sceneFile": "scenes/Scene2.tsx",
        "displayMode": "overlay",
        "frameOffset": 0,
        "transition": {
          "enter": { "type": "crossfade", "durationMs": 300 },
          "exit": { "type": "fade", "durationMs": 200 }
        }
      }
    },
    {
      "id": "i4", "type": "caption", "trackId": "t3",
      "startMs": 0, "endMs": 3500,
      "data": {
        "words": [
          { "text": "Revenue", "startMs": 0, "endMs": 400, "classification": "power" },
          { "text": "grew", "startMs": 400, "endMs": 700 },
          { "text": "40%", "startMs": 700, "endMs": 1100, "classification": "power" }
        ]
      }
    },
    {
      "id": "i5", "type": "audio", "trackId": "t4",
      "startMs": 0, "endMs": 30000,
      "data": {
        "src": "source.mp4",
        "volume": 1.0,
        "enhancedSrc": null
      }
    }
  ],

  "layout": {
    "mode": "stacked",
    "split": { "position": "visuals-first", "ratio": 50, "gap": 0 },
    "pip": {
      "position": "bottom-right", "size": 25, "shape": "circle",
      "borderWidth": 2, "borderColor": "#FFFFFF",
      "shadowEnabled": true, "shadowColor": "#000000", "shadowBlur": 10,
      "opacity": 1.0, "crop": { "cropX": 50, "cropY": 50, "zoom": 1.0 }
    }
  },

  "captionStyle": {
    // Uses the full CaptionStyle type from types.ts. Example shows common fields:
    "displayMode": "word-by-word",
    "wordsPerPhrase": 3,
    "fontFamily": "Inter",
    "fontSize": 64,
    "fontWeight": 800,
    "letterSpacing": 0,
    "textTransform": "none",
    "lineHeight": 1.2,
    "opacity": 1.0,
    "color": "#FFFFFF",
    "activeColor": "#FFD700",
    "backgroundColor": "transparent",
    "activeBackgroundColor": "transparent",
    "backgroundPadding": { "x": 8, "y": 4 },
    "backgroundRadius": 4,
    "stroke": { "width": 0, "color": "#000000" },
    "animation": {
      "in": "elastic-pop",
      "active": "none",
      "out": "fade",
      "easing": "ease-out"
    },
    "position": {
      "anchor": "bottom",
      "offsetX": 0,
      "offsetY": -5,
      "textAlign": "center",
      "rotation": 0
    },
    "effects": {
      "shadow": {
        "offsetX": 2, "offsetY": 2,
        "blur": 4, "color": "#000000", "opacity": 0.8
      },
      "shadowSecondary": null,
      "glow": null
    },
    "presetId": null
  },

  "videoSettings": {
    "cropX": 50, "cropY": 50, "scale": 1.0,
    "sourceWidth": 1920, "sourceHeight": 1080
  }
}
```

### Display Mode vs Layout Mode

Two separate concepts that must not be conflated:

- **`layout.mode`** (global): `'pip' | 'stacked'` — how the speaker video and visuals area are arranged on canvas. Stacked = side-by-side split. PiP = speaker in a bubble.
- **`item.data.displayMode`** (per visual item): `'default' | 'fullscreen' | 'overlay'` — how a specific visual composites with the speaker. `'default'` means "follow the global layout mode." `'fullscreen'` hides the video. `'overlay'` renders visuals on top of the video.

This matches the existing `VisualDisplayMode` type. The manifest preserves this distinction.

### Supported Item Types

The manifest supports these item types (matching existing `TimelineItemType`):

| Type | Description |
|---|---|
| `video` | Source speaker video |
| `audio` | Separated/enhanced audio track |
| `visual` | AI-generated scene (Scene*.tsx) |
| `caption` | Word-level subtitle segment |
| `broll` | B-roll footage (uploaded clips, stock footage) |
| `text` | Text overlay |
| `image` | Static image overlay |

The `broll`, `text`, and `image` types are carried forward from the existing system. Their `data` schemas remain unchanged. The manifest example above shows the most common types; all existing types are supported.

---

## CompositionCore — Shared Rendering Engine

### Responsibilities

`CompositionCore` is a pure Remotion component. It receives the manifest as props and renders the full composition:

```tsx
interface CompositionCoreProps {
  manifest: Manifest;
  scenes: Record<string, React.FC>;
}
```

It renders four layers:

1. **SpeakerVideo** — source video with crop/pan/zoom from `manifest.videoSettings`
2. **VisualsLayer** — AI-generated scenes from `manifest.items` (type: visual), positioned by layout mode from `manifest.layout`
3. **CaptionLayer** — full-featured word-level subtitles from `manifest.items` (type: caption) + `manifest.captionStyle`
4. **AudioLayer** — audio tracks from `manifest.items` (type: audio)

### Layout Computation

Per-frame layout calculation using a single `layout/utils.ts` (replaces today's mirrored copies):

- Reads active visual item's `displayMode` at the current frame
- Computes `videoRect` and `visualsRect` based on layout mode and settings
- Handles smooth 12-frame transitions between display modes
- Functions: `computeLayoutForFrame()`, `computePiPLayoutForFrame()`, `interpolateRect()`

### Seamless Scene Transitions

Adjacent visual items with transition config render with **overlapping sequences**:

- Scene1 exit `crossfade 300ms` + Scene2 enter `crossfade 300ms` → both render during 300ms overlap window
- Scene1 opacity interpolates 1→0, Scene2 opacity interpolates 0→1
- Both scenes render within the same `VisualsLayer` rect during overlap

**Concrete example** — Scene1 ends at 8000ms, Scene2 starts at 8000ms, crossfade 300ms at 30fps (9 frames):

```
Scene1 content endMs:   8000ms (frame 240)
Scene2 content startMs: 8000ms (frame 240)

Overlap window: 7700ms - 8300ms (frames 231 - 249)

Scene1 effective render: frame 0 → frame 249 (extended 9 frames past content end)
Scene2 effective render: frame 231 → frame 450+ (started 9 frames before content start)

During overlap (frames 231-249):
  Scene1 opacity: interpolate(frame, [231, 249], [1, 0], { extrapolateLeft/Right: 'clamp' })
  Scene2 opacity: interpolate(frame, [231, 249], [0, 1], { extrapolateLeft/Right: 'clamp' })
```

The overlap is centered on the boundary — each side extends by half the transition duration (150ms each way). The manifest `startMs`/`endMs` remain the content boundaries; CompositionCore computes the extensions internally.

Supported transition types:

| Type | Behavior |
|---|---|
| `cut` | No overlap, instant switch (default) |
| `crossfade` | Coordinated opacity transition |
| `slide-left` | Outgoing slides left, incoming slides from right |
| `slide-up` | Outgoing slides up, incoming slides from bottom |
| `zoom` | Outgoing scales down + fades, incoming scales up |
| `morph` | Outgoing shrinks to center, incoming expands |

### Caption Rendering

The full caption system moves into CompositionCore:

- **Display modes**: word-by-word, karaoke, phrase, dynamic-hierarchy
- **Animations**: 30+ types (elastic-pop, bounce-up, fade-rise, etc.) with in/active/out phases
- **Effects**: shadow (primary + secondary), glow, stroke
- **Emotional line breaking**: power/medium/filler word classification with scaled sizing
- **Position system**: anchor mode (top/center/bottom + offsets) and free mode (x/y %)
- **Responsive scaling**: `fontScale = canvasWidth / 1080`

This replaces all three existing copies:
- Frontend `Composition.tsx` caption renderer (~800 lines within the 1959-line file)
- Worker `AnimatedSubtitle.tsx` (760 lines) + `SubtitleLayer.tsx` (105 lines)
- `packages/renderer` AnimatedSubtitle.tsx (759 lines) + animations engine

The `packages/renderer` animation engine (`@viona/renderer/animations`) moves into the workspace `captions/animations/` directory. The package itself is deleted.

### Font Loading

CompositionCore uses `@remotion/google-fonts` for font loading:

- On workspace spin-up: the manifest's `captionStyle.fontFamily` is read. The corresponding `@remotion/google-fonts` import is generated in the workspace.
- During rendering: `loadFont()` from `@remotion/google-fonts` handles font download and `@font-face` injection. This works identically in preview (browser) and export (headless Chrome SSR).
- When the user changes fonts via the caption style panel: the manifest updates, and the workspace's font import is regenerated. This requires a rebuild (adding to the rebuild trigger list).
- Fallback fonts are bundled in the workspace for offline/fast scenarios.

### Scene Loading

`CompositionCore` receives scenes as already-loaded React components via the `scenes` prop. It doesn't handle module loading — that's the consumer's job:

- **Preview**: workspace bundler builds all scenes, frontend loads the bundle
- **Export**: Remotion SSR bundles the workspace, scenes are available at build time

### Split Scene Support

Visual items support a `frameOffset` field. When a scene is split:

- Both halves point to the same Scene*.tsx file
- First half: `frameOffset: 0` — renders from the start
- Second half: `frameOffset: N` — `CompositionCore` offsets `useCurrentFrame()` so the scene continues from frame N

### What CompositionCore Does NOT Do

- No element picker, inspect mode, drag handles (editor UI)
- No Zustand store access (receives props only)
- No interactive state (selection, hover, playhead display)
- No network calls (all data passed via manifest + loaded scenes)

### Preview Shell and Export Shell

Both are thin wrappers:

```tsx
// PreviewShell.tsx
const PreviewShell: React.FC<CompositionCoreProps> = (props) => (
  <CompositionCore {...props} />
);

// ExportShell.tsx
const ExportShell: React.FC<CompositionCoreProps> = (props) => (
  <CompositionCore {...props} />
);
```

Separate shells exist to allow future divergence (e.g., watermark on free tier exports) without touching the core.

---

## Workspace Lifecycle

### Spin-Up (project load)

```
User opens project
  → API: POST /projects/{id}/workspace
  → Backend:
      1. Create workspace directory
      2. Copy composition infrastructure (CompositionCore, layout, captions, shells)
      3. Read DB (tracks, timelineItems, captionStyles, videoSettings) → generate manifest.json
      4. Copy scene sources from S3 (if existing visuals)
      5. Copy/symlink source video to public/
      6. If last known bundle exists in S3: serve that immediately as warm cache
      7. Queue workspace bundle build via bundler service
      8. Set project.workspaceStatus = 'active'
  → Return: { manifest, workspaceStatus: 'initializing', cachedBundleUrl? }
  → Frontend: if cachedBundleUrl exists, load immediately (stale but instant preview)
  → WebSocket: workspace:ready + bundle:ready (once built, frontend swaps to fresh bundle)

**Cold start mitigation**: The 5-10s bundle build creates a loading gap. To mitigate: when a workspace is torn down, the last good bundle is uploaded to S3 alongside the scene sources. On re-open, this cached bundle is served immediately while the fresh build runs. The preview may be briefly stale (if scenes changed in another session), but the user gets instant visual feedback.
```

### Active Editing

```
User/AI makes changes
  → Manifest-only changes: write manifest.json, no rebuild
  → Scene code changes: write file, queue rebuild via bundler service
  → Periodic checkpoint: sync manifest → DB every 60s
```

### Idle Timeout

```
No activity for 10 minutes
  → Sync manifest → DB (upsert tracks, timelineItems, styles)
  → Upload scene sources to S3
  → Delete workspace directory
  → Set project.workspaceStatus = 'inactive'
  → WebSocket: workspace:teardown
```

### Re-Open

```
User returns to project
  → Same as spin-up — workspace regenerated from DB + S3
```

### Error Recovery

Workspace spin-up can fail at multiple points. Error handling:

| Failure | State Left | Recovery |
|---|---|---|
| S3 download fails (scene sources) | Partial workspace dir | Clean up partial dir. Return error to frontend. User can retry. Project stays in DB. |
| Disk full | Partial workspace dir | Clean up. Return error. Alert ops. |
| Scene files corrupted | Workspace created, bundle fails | Return bundle:error via WebSocket. Frontend shows error state. User can regenerate visuals. |
| Bundle build fails | Workspace + manifest OK, no bundle | Retry build once. If still fails, return bundle:error. User can edit manifest (no rebuild needed) while issue is diagnosed. |
| Crash during active editing | Workspace may have unsaved changes | On next spin-up, check for orphaned workspace dir. If manifest exists and is newer than last DB checkpoint, offer to recover from workspace state. |

All workspace directories use the pattern `workspaces/{projectId}/`. On any unrecoverable failure, the entire directory is cleaned up and `workspaceStatus` is set back to `'inactive'`. The DB + S3 data is never modified during spin-up, so it's always safe to retry.

---

## Sync Protocol

### Mutual Exclusion

Simple lock on the workspace:

```jsonc
{
  "holder": "user" | "ai",
  "acquiredAt": "2026-03-12T10:00:00Z",
  "ttl": 30000,  // 30s for user, extended for AI
  "lastHeartbeat": "2026-03-12T10:00:25Z"
}
```

- User starts editing → acquire lock as `user` (TTL: 30s, auto-release on inactivity)
- AI receives edit request → acquire lock as `ai` (TTL: 30s, but heartbeat-extended)
- AI heartbeat: while the AI agent is running, it sends a heartbeat every 10s that resets the TTL. This handles long-running operations (scene generation can take 30-120s).
- Lock held by other party → reject with "editing in progress"
- Auto-release on TTL expiry (no heartbeat renewal) prevents deadlocks
- Frontend shows "AI is editing..." indicator when AI holds lock

### Edit Flows

**User edits (manifest-only, instant):**

```
User drags item → Zustand updates locally (instant)
  → API: PATCH /projects/{id}/workspace/manifest
      body: { op: "update_item", itemId: "i3", startMs: 9000 }
  → Backend: validate, write manifest.json
  → WebSocket: manifest:updated (confirmation)
  → No rebuild needed
```

**AI edits manifest (via tools, instant):**

```
AI calls set_layout({ mode: "pip" })
  → Backend: validate, write manifest.json
  → WebSocket: manifest:updated
  → Frontend: Zustand updates → player re-renders with new layout
  → No rebuild needed
```

**AI edits scene code (rebuild required):**

```
AI calls edit_scene("Scene2", "make chart more dynamic")
  → Backend: Claude edits scenes/Scene2.tsx in workspace
  → Backend: queue bundle rebuild
  → Bundler rebuilds (~5-10s)
  → WebSocket: bundle:ready
  → Frontend: reloads bundle in Player
```

### What Triggers Rebuild vs. Not

| Change | Rebuild? |
|---|---|
| Scene*.tsx code edited | Yes |
| New scene added | Yes |
| Scene deleted | Yes |
| Item timing (startMs/endMs) | No |
| Layout mode/settings | No |
| Caption style | No |
| Display mode change | No |
| Transition type change | No |
| Video crop/pan/zoom | No |
| Caption text/words edited | No |
| Caption font family changed | Yes (font import regeneration) |

---

## Bundler Service

A single long-running process handling build requests for all active workspaces:

```
BundlerService
  ├── buildQueue: FIFO queue of { projectId, workspacePath, priority }
  ├── bundleCache: Map<projectId, { bundlePath, hash, builtAt }>
  │
  ├── enqueueBuild(projectId, workspacePath)
  │     → debounce 500ms (batch rapid changes)
  │     → add to queue
  │
  ├── processBuild()
  │     → dequeue next
  │     → compute file hash, skip if unchanged
  │     → remotion bundle --out-dir {bundleDir}
  │     → update cache
  │     → WebSocket: bundle:ready
  │
  └── cleanup(projectId)
        → remove from cache, delete bundle dir
```

Key behaviors:
- **Debounce 500ms**: batch rapid file changes into one build
- **Hash check**: skip rebuild if scene files haven't changed
- **Queue priority**: user-triggered rebuilds jump ahead of background
- **One build per project at a time**: new request cancels in-progress build for same project
- **No persistent process per project**: just a queue worker that processes builds sequentially

---

## Workspace API Endpoints

```
POST   /projects/{id}/workspace              → spin up workspace
DELETE /projects/{id}/workspace              → sync to DB, tear down

GET    /projects/{id}/workspace/manifest     → read current manifest
PATCH  /projects/{id}/workspace/manifest     → apply validated manifest operation

POST   /projects/{id}/workspace/lock         → acquire edit lock
DELETE /projects/{id}/workspace/lock         → release edit lock

GET    /projects/{id}/workspace/bundle/*     → serve bundle files (static, production: serve from S3/CDN)
```

> **Production optimization**: In production, bundle files should be served from S3/CDN directly rather than through the Fastify API. The API endpoint is for development convenience. The `active_bundle_url` on the projects table can point to either the API path (dev) or an S3/CDN URL (production).

---

## DB Schema Changes

### Modified Tables

**projects:**
```sql
+ workspace_status VARCHAR DEFAULT 'inactive'    -- 'inactive' | 'initializing' | 'active' | 'tearing_down'
+ workspace_last_activity TIMESTAMP
+ active_bundle_url VARCHAR
-- videoSettings jsonb stays as durable copy (manifest is live copy during active workspace)
```

**visuals:**
```sql
- bundle_url     -- removed: bundle comes from workspace now
- timestamps     -- removed: lives in manifest items
+ source_scene_ids INTEGER[]  -- which Scene*.tsx files belong to this visual generation
-- compositionId stays: identifies the visual generation
```

**timelineItems:**
```
Stays as durable storage.
Synced FROM manifest on workspace teardown/checkpoint.
Used to GENERATE manifest on workspace spin-up.
```

---

## AI Agent Tools

### Scene Content Tools (existing, adapted)

| Tool | Input | Behavior |
|---|---|---|
| `edit_scene(sceneId, prompt)` | Scene ID + edit instruction | Edit Scene*.tsx in live workspace. Triggers rebuild. |
| `generate_scenes(sceneIds, prompt)` | Scene IDs + generation instruction | Regenerate specific scenes via Animator. Context from manifest (displayMode, timing, transcript). |

### Manifest Tools (new)

| Tool | Input | Behavior |
|---|---|---|
| `read_manifest()` | — | Return full manifest for context |
| `set_layout(mode, settings)` | Layout mode + settings | Change pip/stacked and related settings |
| `set_display_mode(itemId, mode)` | Item ID + display mode | Change default/overlay/fullscreen |
| `set_transition(itemId, enter?, exit?)` | Item ID + transition config | Set transition type and duration |
| `move_item(itemId, startMs, endMs)` | Item ID + new timing | Change item timing |
| `reorder_scenes(itemIds)` | Ordered array of item IDs | Reorder visual items on timeline |
| `update_caption_style(styleUpdates)` | Partial CaptionStyle | Change font, animation, color, position, effects |
| `split_scene(itemId, atMs)` | Item ID + split point | Split visual item, second half gets frameOffset |
| `delete_item(itemId)` | Item ID | Remove item from manifest |

All tools validate input, write to manifest.json, and return updated state. The workspace lock is held for the duration of the AI's turn.

### Layout-Aware Scene Generation

When the AI generates or edits a scene, the Animator prompt receives context from the manifest:

**For overlay mode:**
```
## Scene Context
- Display Mode: overlay
- Canvas: 1080x1920
- Layout: Your scene renders ON TOP of the speaker video
- Speaker area: bbox from head tracking data
- Design guidance: Use transparent/semi-transparent backgrounds.
  Avoid placing important elements over the speaker's face.
```

**For stacked mode:**
```
## Scene Context
- Display Mode: stacked
- Canvas: 1080x960 (bottom half, ratio 50%)
- Layout: Your scene renders BELOW the speaker video
- Design guidance: Use full solid backgrounds. You own the entire area.
```

**For fullscreen mode:**
```
## Scene Context
- Display Mode: fullscreen
- Canvas: 1080x1920
- Layout: Your scene owns the entire canvas. Speaker video is hidden.
- Design guidance: Full-bleed graphics. Audio continues from the speaker.
```

Scene*.tsx files themselves don't change structure. They still use `useCurrentFrame()`, `interpolate()`, springs, etc. They just get designed differently based on the context provided.

---

## Frontend Changes

### What Stays

- Timeline UI (canvas-based tracks, drag/resize/split, undo/redo)
- Caption controls (style panel, word editing, animation picker)
- Layout preset picker
- AI assistant panel (chat, progress, widgets)
- Context panel (properties editor)
- Zustand store as frontend state manager

### What Changes

**1. Store syncs from manifest:**
```
Page load → POST /projects/{id}/workspace → returns manifest + bundleUrl
         → Populate Zustand store from manifest
         → WebSocket subscribes to workspace events
```

**2. Edits write to workspace manifest:**
```
User edit → Zustand updates (instant feedback)
         → PATCH /projects/{id}/workspace/manifest (validated operation)
         → WebSocket confirms
```

**3. Player loads CompositionCore from workspace bundle:**
```tsx
<RemotionPlayer component={loadedCompositionCore} inputProps={{ manifest }} />
```

Replaces the `DynamicVisualLoader` eval/CJS shim approach.

**4. Interactive features become overlays:**
```tsx
<div style={{ position: 'relative' }}>
  <RemotionPlayer component={loadedCompositionCore} inputProps={{ manifest }} />

  {elementPickerEnabled && <ElementPickerOverlay manifest={manifest} />}
  {inspectModeEnabled && <InspectOverlay manifest={manifest} />}
  {showSafeZone && <SafeZoneOverlay platform={safeZonePlatform} />}
  {selectedIds.length > 0 && <SelectionHighlightOverlay ... />}
</div>
```

**5. New WebSocket events:**

| Event | Purpose |
|---|---|
| `workspace:ready` | Workspace spun up, initial bundle built |
| `manifest:updated` | Manifest changed (by AI or confirming user edit) |
| `bundle:ready` | Bundler finished rebuild |
| `bundle:error` | Bundler failed |
| `workspace:lock_acquired` | AI took the lock |
| `workspace:lock_released` | AI released the lock |
| `workspace:teardown` | Idle timeout, workspace shutting down |

### Code Removed

| File | ~Lines | Replaced By |
|---|---|---|
| `Composition.tsx` | 1959 | CompositionCore from workspace bundle |
| `DynamicVisualLoader.tsx` | 325 | Standard bundle loading |
| `layout-utils.ts` | 261 | Single `layout/utils.ts` in workspace |
| **Total** | **~2,545** | **~400 lines** (bundle loader + overlay components + WS handlers) |

---

## Export Pipeline

### New Flow

```
User clicks Export
  → API: POST /projects/{id}/render
  → If workspace active: snapshot manifest.json (atomic copy)
  → If workspace inactive: spin up from DB + S3
  → Use snapshot manifest as composition props (immutable for duration of render)
  → Ensure source video in public/
  → Remotion renderMedia() with ExportShell + snapshot manifest as inputProps
  → Upload MP4 to S3
```

**Concurrent editing during export**: The export takes an immutable snapshot of the manifest at request time. The user can continue editing while the export renders — their edits won't affect the in-progress export, and the export won't block editing.

### What Gets Eliminated

| Today's Render Processor (~949 lines) | After (~100 lines) |
|---|---|
| Load project from DB | Ensure workspace exists |
| Extract visual display data | Read manifest.json |
| Build layout segments | (CompositionCore handles internally) |
| Resolve Google Fonts | (CompositionCore handles internally) |
| Build subtitle arrays | (CompositionCore handles internally) |
| Construct composition-props.json | Pass manifest as inputProps |
| Download sources from S3 | (workspace already has them) |
| rebuildBundleFromCJS() | (workspace bundle already built) |
| renderMedia() | renderMedia() |
| Upload output | Upload output |

### Preview === Export Guarantee

Both use `CompositionCore` with the same manifest:
- Same layout computation
- Same caption rendering (dynamic hierarchy, emotional segments, all animations, all effects)
- Same scene transitions (crossfade, slide, zoom, morph)
- Same display mode handling
- Same font rendering

Only difference: resolution and encoding quality.

---

## Embedding Layer (Gemini Embedding 2)

> **Phase note**: The embedding layer is a separate phase that can be implemented after the unified timeline is working. The core architecture (manifest, CompositionCore, workspace, bundler) stands on its own. Embeddings add intelligence on top — they are not required for the basic editing flow to work. Implement the embedding layer when the unified timeline is stable and the AI agent is successfully using scoped manifest tools.

### What Gets Embedded

| Content | Modality | When |
|---|---|---|
| Rendered scene frames (start, middle, end) | Image | After scene generation/edit + bundle rebuild |
| Transcript segments (per scene timing) | Text | On initial project load |
| Scene source code (Scene*.tsx) | Text | After scene generation/edit |
| Audio segments (per scene timing) | Audio | On initial project load |
| Manifest item metadata | Text | After manifest changes |

All embedded into the same vector space using Gemini Embedding 2's native multimodal support.

### Vector Storage

Per-project collection in ChromaDB or Qdrant:

```jsonc
{
  "id": "scene2-frame-middle",
  "vector": [/* 768-dim or 3072-dim */],
  "metadata": {
    "projectId": "...",
    "type": "scene-frame",        // scene-frame | transcript | scene-code | audio | manifest-item
    "sceneFile": "scenes/Scene2.tsx",
    "itemId": "i3",
    "startMs": 8000,
    "endMs": 15000
  }
}
```

Dimension choice: 768 for cost efficiency (MRL scaling), 3072 for maximum precision.

### When Embedding Happens

| Event | What Gets Re-Embedded |
|---|---|
| Scene generated/edited + bundle rebuilt | That scene's frames + code + transcript segment |
| Initial project load (first time) | All transcript segments + audio |
| Manifest timing change | Re-map transcript segments to new scene boundaries |

Embedding runs in the background after bundle rebuild. Does not block user or AI. Vectors are eventually consistent.

### AI Agent Integration

Before acting on a user message, the Creative Director queries the vector DB:

```
User: "the part about customer growth is boring"
  → Embed user message via Gemini Embedding 2
  → Cosine similarity search, top 3 results
  → Results provide: which scene, which transcript segment, which audio tone
  → Agent receives concrete context instead of requiring "edit Scene 2"
```

### Infrastructure

- Gemini Embedding 2 API (Google AI or Vertex AI)
- ChromaDB container (alongside existing Docker services) or Qdrant on Railway
- Background embedding worker on existing BullMQ queue
- ~50 lines in Creative Director agent to query vectors before acting

---

## What Stays the Same

- **Editing paradigm**: talking head videos with AI-generated visual overlays/graphics
- **Display modes**: stacked, overlay, fullscreen, PiP — all work as before
- **AI generation pipeline**: Director plans scenes → Animator writes Scene*.tsx → verification loop
- **Scene isolation**: Scene*.tsx components are still isolated React components with `useCurrentFrame()`, `interpolate()`, springs
- **Generation prompts**: existing Animator/Director prompts survive with minor additions (layout context)
- **Layout presets**: PiP tutorial, stacked equal, etc.
- **Timeline UI**: tracks, drag, resize, split, undo/redo
- **Caption controls**: style panel, word editing, animation picker
- **Export format**: MP4 via Remotion SSR

---

## Migration Path

### Existing Projects

Projects created before this change have data in the old format (DB tables + S3 bundles). Migration:

1. On workspace spin-up for an old project:
   - Read tracks/timelineItems/visuals from DB (old format)
   - Generate manifest.json from this data
   - Download scene sources from S3 (old `sources/{compositionId}/` path)
   - Copy composition infrastructure (CompositionCore replaces old FullComposition)
   - Build workspace as normal

2. Old `bundleUrl` on visual items is ignored once the workspace is active. The workspace bundler produces the new bundle.

3. On first successful workspace teardown, the project is effectively migrated — DB now has data synced from the manifest format.

No batch migration needed. Projects migrate on first access.

### Manifest Versioning

The manifest has a `version` field (starting at 1). When the format evolves:

- On workspace spin-up, if the DB produces a v1 manifest but CompositionCore expects v2, a migration function transforms the manifest in-place before writing to the workspace.
- Migration functions are chained: v1→v2→v3, each handling one version bump.
- The DB always stores the latest format after teardown sync.
- Old workspaces with stale manifests are rebuilt from DB (which has the migrated data).

---

## Code Elimination Summary

| Component | Lines Removed | Replaced By |
|---|---|---|
| Frontend `Composition.tsx` | ~1,959 | CompositionCore from workspace |
| Frontend `DynamicVisualLoader.tsx` | ~325 | Standard bundle loading |
| Frontend `layout-utils.ts` | ~261 | Single `layout/utils.ts` in workspace |
| Worker `FullComposition.tsx` | ~127 | CompositionCore |
| Worker `AnimatedSubtitle.tsx` | ~760 | Unified caption renderer in CompositionCore |
| Worker `SubtitleLayer.tsx` | ~105 | Absorbed into CompositionCore |
| Worker `composition/utils.ts` | ~202 | Single `layout/utils.ts` |
| `packages/renderer` (AnimatedSubtitle + animations) | ~1,500 | Animations engine moves into workspace `captions/animations/` |
| Render processor orchestration | ~850 | ~100 lines (manifest-driven) |
| **Total removed** | **~6,089** | |
| **Total new** | | **~2,000** (CompositionCore + workspace service + bundler + API endpoints + overlays) |

Net reduction: ~4,000 lines, with the remaining code being single-purpose and non-duplicated.
