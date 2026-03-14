# Performant Preview Architecture — Design Spec

## Goal

Replace the current proxy-based, manifest-limited preview system with a performant, data-driven architecture where:
- Video/media loads directly from S3 (no proxy)
- A generic Remotion renderer reads a rich manifest (no hardcoded composition)
- Both AI and user can edit the same manifest
- AI can also write scene files for creative visuals beyond what the manifest covers
- Phase 1: preview + chat only. Phase 2: full timeline UI.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ Browser                                                 │
│                                                         │
│  Remotion Player                                        │
│    └─ PlayerComposition (generic renderer)              │
│         ├─ reads manifest.json (tracks, items, assets)  │
│         ├─ renders items by type (video, text, scene..) │
│         ├─ applies transforms + keyframes               │
│         └─ loads video/media direct from S3 (presigned) │
│                                                         │
│  AI Chat Panel ←→ API ←→ Sandbox Agent                  │
│                                                         │
│  (Phase 2: Timeline UI — reads/writes same manifest)    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Sandbox (Docker)                                        │
│                                                         │
│  /workspace/manifest.json  ← source of truth            │
│  /workspace/src/PlayerComposition.tsx ← generic renderer│
│  /workspace/src/scenes/*.tsx ← AI-written creative code │
│  /workspace/public/* ← media files (synced to MinIO)    │
│                                                         │
│  esbuild watcher → CJS bundle → bundle-ready event      │
│  Asset sync → upload to MinIO → presigned URLs          │
│  Agent server → receives prompts, edits manifest/scenes │
└─────────────────────────────────────────────────────────┘
```

## 1. Data Model (Expanded Manifest)

The manifest JSON is the single source of truth for project structure. Both the AI agent and the frontend timeline UI (Phase 2) read and write it.

### Schema Changes

**New universal fields on every item:**

```typescript
// Every item gets these
interface ManifestItemBase {
  id: string;
  type: 'video' | 'audio' | 'text' | 'image' | 'scene' | 'caption' | 'shape';
  trackId: string;
  startMs: number;
  endMs: number;
  data: Record<string, unknown>; // type-specific data
  transform?: {                  // optional — omitted on audio items (no visual)
    x: number | string;          // pixels or percentage ("50%")
    y: number | string;
    width: number | string;
    height: number | string;
    rotation: number;            // degrees
    opacity: number;             // 0-1
  };
  keyframes?: Array<{
    timeMs: number;              // relative to item start
    props: Partial<Transform>;   // any transform property
    easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring';
  }>;
  filters?: {
    brightness?: number;         // 0-2, default 1
    contrast?: number;           // 0-2, default 1
    saturation?: number;         // 0-2, default 1
    blur?: number;               // px, default 0
    hue?: number;                // degrees, default 0
    grayscale?: number;          // 0-1, default 0
    sepia?: number;              // 0-1, default 0
  };
}
```

**Note on `transform`:** Audio items have no visual representation, so `transform` is optional. The renderer skips TransformWrapper for items without a transform. All visual items (video, text, image, scene, shape, caption) should always have a transform.

**Track type enum (v2):**

```typescript
type ManifestTrackType = 'video' | 'audio' | 'overlay' | 'caption';
// Removed: 'visual', 'broll' (both subsumed into video/overlay)
// 'overlay' is the general-purpose track for text, images, shapes, scenes
```

**Updated item type data schemas:**

```typescript
// Video — adds startFrom for cuts, fade in/out, crop
interface VideoItemData {
  src: string;                 // asset key (resolved via assets map)
  startFrom: number;           // ms — where in the source to start playing
  volume: number;
  playbackRate: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  crop?: {                     // migrated from v1 videoItemData.crop
    x: number;                 // 0-100, center point
    y: number;
    scale: number;             // 0.5-3
  };
}

// Audio — adds fade, playbackRate
interface AudioItemData {
  src: string;
  volume: number;
  playbackRate: number;
  fadeInMs?: number;
  fadeOutMs?: number;
}

// Text — full styling
interface TextItemData {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  backgroundColor?: string;
  borderRadius?: number;
  padding?: number;
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase';
}

// Image
interface ImageItemData {
  src: string;                 // asset key
}

// Scene — AI-generated React component
interface SceneItemData {
  sceneFile: string;           // e.g. "scenes/LowerThird.tsx"
  // Scene components access media via staticFile() which resolves through assets map
}

// Shape — basic shapes
interface ShapeItemData {
  shape: 'rectangle' | 'circle' | 'line';
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
}

// Caption — existing, unchanged
interface CaptionItemData {
  words: CaptionWord[];
}
```

**New top-level fields:**

```typescript
interface Manifest {
  version: 2;                  // bumped from 1
  fps: number;
  durationMs: number;
  canvas: { width: number; height: number };
  tracks: ManifestTrack[];
  items: ManifestItem[];
  assets: Record<string, string>;  // NEW: { "source.mp4": "https://presigned-url" }
  captionStyle: CaptionStyle;
  videoSettings: VideoSettings;
  // REMOVED: layout (pip/stacked) — replaced by per-item transforms
}
```

**Removed fields:**
- `layout` (global pip/stacked/split) — replaced by per-item transforms
- `overlayZone` on visual items — replaced by transforms
- `displayMode` on visual items — replaced by transforms
- `visual` item type — renamed to `scene`
- `broll` item type — merged into `video` (same data, different source)

### Migration (v1 → v2)

A `migrateManifestV1toV2(manifest)` function converts old manifests. It handles every v1 field:

**Layout → per-item transforms:**
- `layout.pip` → pip video gets `transform: { x, y, width, height }` computed from pip `position`, `size`, `offsetX`, `offsetY`. PiP styling fields (`shape`, `borderRadius`, `borderWidth`, `borderColor`, `shadowEnabled`, `shadowColor`, `shadowBlur`, `opacity`, `rotation`) are dropped — they were only used in the old hardcoded PiP renderer and have no v2 equivalent. The AI can recreate these effects via scene files or manifest filters if needed. `pip.crop` → migrated to `VideoItemData.crop` on the pip video item.
- `layout.stacked` → two video items get `transform` based on `split.ratio` and `split.position`
- If `layout` is missing/default, video gets fullscreen transform

**Item type renames:**
- `visual` items → `scene` items (type rename, data preserved)
- `broll` items → `video` items (data migrated: `brollItemData.src` → `videoItemData.src`, volume preserved, `filename` used as asset key if `src` is a raw URL, sourceType/photographer/previewUrl dropped)

**Visual item data migration:**
- `displayMode: 'fullscreen'` → `transform: { x: 0, y: 0, width: '100%', height: '100%' }`
- `displayMode: 'overlay'` + `overlayZone: 'lower-third'` → `transform: { x: 0, y: '70%', width: '100%', height: '30%' }`
- `displayMode: 'overlay'` + `overlayZone: 'top'` → `transform: { x: 0, y: 0, width: '100%', height: '30%' }`
- `displayMode: 'overlay'` + `overlayZone: 'frame'` → `transform: { x: 0, y: 0, width: '100%', height: '100%' }`
- `displayMode: 'overlay'` + `overlayZone: 'behind'/'background'` → `transform: { x: 0, y: 0, width: '100%', height: '100%' }` (placed on lowest track)
- `transition.enter/exit` → dropped (v2 handles transitions via keyframes or scene code)
- `speakerBbox` → dropped (was used for pip positioning, now handled by transform)
- `frameOffset` → preserved in scene data if nonzero

**Video item data migration:**
- `crop` → preserved in `VideoItemData.crop`
- `playbackRate`, `volume` → preserved
- `src` → preserved (asset key)
- New `startFrom: 0` added (default)

**Audio item data migration:**
- `enhancedSrc` → dropped (not needed in v2; if enhanced audio exists, src already points to it)
- `volume` → preserved
- New `playbackRate: 1` added (default)

**Text item data migration:**
- `text` → preserved
- `style` (opaque `Record<string, unknown>`) → best-effort extraction of `fontFamily`, `fontSize`, `fontWeight`, `color`, etc. into strongly-typed v2 fields. Unrecognized keys are dropped.
- `position` → migrated to `transform.x`, `transform.y`
- `size` → migrated to `transform.width`, `transform.height`
- Missing style fields get sensible defaults (fontFamily: 'Inter', fontSize: 48, fontWeight: 600, color: '#FFFFFF')

**Image item data migration:**
- `src` → preserved
- `position` → migrated to `transform.x`, `transform.y`
- `width`, `height` → migrated to `transform.width`, `transform.height`
- `opacity` → migrated to `transform.opacity`

**videoSettings (global crop/scale) migration:**
- v1 `videoSettings.cropX/cropY/scale` was a global crop applied to all video items via the renderer
- In v2, this becomes the default `crop` on each `VideoItemData` that doesn't already have a per-item crop
- `videoSettings.sourceWidth/sourceHeight` → preserved in v2 `videoSettings` for canvas aspect ratio reference
- The global `videoSettings` is kept in v2 but only retains `sourceWidth`/`sourceHeight` (crop fields removed)

**Caption style:**
- `captionStyle` schema is unchanged between v1 and v2 — no migration needed
- Caption word timestamps remain absolute (relative to composition start, not item start). The renderer accounts for this by offsetting within the Sequence.

**Track type migration:**
- `'visual'` → `'overlay'`
- `'broll'` → `'video'`
- `'text'` → `'overlay'`
- `'image'` → `'overlay'`
- `'video'`, `'audio'`, `'caption'` → unchanged
- Track `name` is preserved as-is

## 2. Generic PlayerComposition Renderer

A fixed `PlayerComposition.tsx` that ships as part of the sandbox template. The AI never edits this file.

### Component Hierarchy

```
PlayerComposition (reads manifest from props)
  └─ for each track (sorted by position = z-order):
      └─ AbsoluteFill (track layer)
          └─ for each item in track:
              └─ Sequence (from/durationInFrames from item timing)
                  └─ TransformWrapper (applies transform + keyframes + filters)
                      └─ ItemRenderer (switches on item.type)
                          ├─ VideoItem → <Video src={assets[data.src]} startFrom={...} />
                          ├─ AudioItem → <Audio src={assets[data.src]} volume={...} />
                          ├─ TextItem → styled <div> with text
                          ├─ ImageItem → <Img src={assets[data.src]} />
                          ├─ SceneItem → dynamic import of scene file
                          ├─ ShapeItem → SVG/div shape
                          └─ CaptionItem → existing caption renderer
```

### TransformWrapper

Applies position, size, rotation, opacity with keyframe interpolation:

- Reads `item.transform` for base values
- Reads `item.keyframes` for animated values
- Uses Remotion's `interpolate()` with `extrapolateLeft: 'clamp'`, `extrapolateRight: 'clamp'`
- Applies `item.filters` as CSS `filter` property
- Keyframe `easing` maps to Remotion's easing functions

### SceneItem (Bundling & Discovery)

Scene files are AI-generated `.tsx` files in `/workspace/src/scenes/`. They are bundled into the CJS output via a **scene registry**:

**How it works:**
1. The esbuild watcher scans `/workspace/src/scenes/*.tsx` before each build
2. It auto-generates `/workspace/src/scene-registry.ts` with static imports:
   ```typescript
   // AUTO-GENERATED — do not edit
   import { LowerThird } from './scenes/LowerThird';
   import { Particles } from './scenes/Particles';
   export const sceneRegistry: Record<string, React.ComponentType<any>> = {
     'scenes/LowerThird.tsx': LowerThird,
     'scenes/Particles.tsx': Particles,
   };
   ```
3. `PlayerComposition.tsx` imports `sceneRegistry` and looks up components by `data.sceneFile`
4. esbuild bundles everything (PlayerComposition + scene-registry + all scenes) into one CJS file

**Scene component contract:**
- Receive `{ width, height, durationInFrames, fps }` as props
- Render with transparent background (composites over lower tracks)
- Can use `staticFile()` to reference media — resolves through the assets map
- Can use `useCurrentFrame()`, `interpolate()`, and all Remotion APIs
- Should NOT import other scene files (each scene is self-contained)

**staticFile() in scenes:**
Scene files call `staticFile('overlay.png')` which resolves to the presigned URL via the custom `require('remotion')` shim. The shim reads the assets map from the manifest (passed as `inputProps` to the Player). This works both in browser preview (Player) and server render (`remotion render`).

### Asset Resolution

The `assets` map in the manifest maps file names to presigned URLs:

```json
{
  "assets": {
    "source.mp4": "https://minio.example.com/viona/abc123/source.mp4?X-Amz-...",
    "overlay.png": "https://minio.example.com/viona/abc123/overlay.png?X-Amz-..."
  }
}
```

The renderer resolves `data.src` values through this map. The custom `require('remotion')` shim overrides `staticFile()` to also use this map.

## 3. Asset Resolution (Presigned URLs)

### Flow

1. **Sandbox init**: Video downloaded from MinIO → `/workspace/public/source.mp4`
2. **Sandbox init**: ffprobe detects duration → patches manifest
3. **On each esbuild rebuild** (before `bundle-ready`):
   - Scan `/workspace/public/` for all files
   - Upload any new files to MinIO (files not already in the bucket)
   - Generate presigned URLs for all public files (8h TTL)
   - Write `assets` map into `manifest.json`
   - Fire `bundle-ready` event
4. **Frontend**: on `bundle-ready`, re-fetch manifest → gets fresh `assets` map
5. **Browser**: `<Video src={presignedUrl}>` loads directly from S3

### What goes through the proxy (small payloads only)

- CJS bundle fetch (few KB)
- Manifest read/write (JSON, few KB)
- AI chat SSE stream

### What loads directly from S3 (large payloads)

- Video files
- Audio files
- Images

### Presigned URL refresh

- TTL: 8 hours
- Frontend refreshes every 3 hours (existing pattern)
- Refresh = re-fetch manifest from sandbox → gets new presigned URLs in `assets` map

## 4. Frontend Editor

### Phase 1 (Current Scope)

Preview + AI chat only. No timeline.

**Editor layout:**
```
┌──────────────────────────────────┐
│ Header (export button)           │
├──────┬───────────────────────────┤
│      │                           │
│ Chat │   Remotion Player         │
│Panel │   (preview)               │
│      │                           │
│      ├───────────────────────────┤
│      │ Playback controls         │
└──────┴───────────────────────────┘
```

**Update flow:**
1. User sends message → sandbox agent receives prompt
2. Agent edits `manifest.json` and/or writes scene files
3. esbuild rebuilds → `bundle-ready` WebSocket event
4. Frontend re-fetches manifest (fresh assets map + updated tracks/items)
5. Frontend increments `bundleVersion` → `useWorkspaceComposition` reloads bundle
6. Remotion Player re-renders

**Manifest-only edits (no rebuild needed):**
When the AI only edits the manifest (no scene file changes), the esbuild watcher won't trigger because no `.tsx` files changed. The agent should explicitly notify the frontend via a `manifest:updated` WebSocket event. The frontend re-fetches the manifest and re-renders — the bundle stays the same since `PlayerComposition.tsx` reads manifest from props.

### Phase 2 (Future)

Full timeline UI reading/writing the same manifest:
- Timeline renders tracks/items from manifest
- Drag/resize/delete → PATCH manifest → re-render
- Property panel for transforms, filters, keyframes
- Keyframe curve editor
- Lock-based conflict resolution (user editing vs AI editing)

## 5. Sandbox Changes

### Template PlayerComposition.tsx

Replace the current stub/hardcoded composition with the generic renderer. Ships in the Docker image at `/app/template/src/PlayerComposition.tsx`. Copied to workspace on init. AI never edits it.

### Asset Sync in esbuild Watcher

Add a sync step to the esbuild watcher's build cycle:

```
File change detected → debounce 500ms → doBuild():
  1. Scan /workspace/public/ for files
  2. Upload new files to MinIO
  3. Generate presigned URLs for all public files
  4. Update manifest.json assets map
  5. Generate scene-registry.ts from /workspace/src/scenes/*.tsx
     (watcher must ignore scene-registry.ts changes to avoid infinite rebuild loops)
  6. Run esbuild
  7. Fire bundle-ready
```

**Error handling for asset upload:**
- If MinIO upload fails for a file, log a warning and skip that asset (don't block the build)
- The assets map only includes successfully uploaded files
- Retry failed uploads on the next build cycle
- If MinIO is completely unreachable, fall back to proxy-based URLs (existing pattern) and log an error

### manifest:updated WebSocket Event

When the AI agent edits only the manifest (no scene file changes), esbuild won't trigger. The agent server must:
1. After writing `manifest.json`, emit a `manifest:updated` event via the WebSocket
2. The frontend listens for this event and re-fetches the manifest
3. Since `PlayerComposition.tsx` reads manifest from `inputProps`, the Player re-renders without a bundle reload
4. The API WebSocket relay (`/ws/:projectId`) forwards this event like `bundle-ready`

### Agent Tools

The AI agent gets structured tools to edit the manifest:

**Track operations:**
- `add_track(type, name)` → adds a track with auto-generated ID and next position
- `update_track(trackId, changes)` → partial update (name, position)
- `remove_track(trackId)` → removes track and all its items

**Item operations:**
- `add_item(trackId, type, startMs, endMs, data, transform?)` → adds an item with auto-generated ID
- `update_item(itemId, changes)` → partial update to any item field (deep-merged for nested objects)
- `remove_item(itemId)` → removes an item

**Video-specific operations:**
- `split_video(itemId, atMs)` → splits a video item into two at the given time:
  - Original item: `endMs = atMs`, unchanged `startFrom`, keyframes filtered to `timeMs < splitOffset`
  - New item: `startMs = atMs`, `endMs = original.endMs`, `startFrom = original.startFrom + (atMs - original.startMs)`
  - New item's keyframes: filtered to `timeMs >= splitOffset`, then each `timeMs` reduced by `splitOffset`
  - Both items keep the same transform, track, crop, filters, and other properties
  - Returns both item IDs

**Read operations (filtered to avoid token bloat on large manifests):**
- `read_manifest()` → returns summary: track list, item count per track, total duration, canvas size, assets list. No item details.
- `read_manifest({ trackId })` → returns all items on that track
- `read_manifest({ timeRange: [startMs, endMs] })` → returns items overlapping that time range
- `read_manifest({ trackId, timeRange })` → both filters combined
- `read_item(itemId)` → returns one item's full data
- The AI never reads or edits `manifest.json` directly — all access goes through these tools

**Write operations:**
- `write_scene_file(filename, code)` → writes a `.tsx` file to `/workspace/src/scenes/{filename}`
- `delete_scene_file(filename)` → removes a scene file

All tools validate input, write to `manifest.json`, and emit `manifest:updated` (or trigger esbuild rebuild for scene file changes). The agent can also edit files directly via the filesystem — these tools are convenience wrappers.

### Manifest Version

Bump to `version: 2`. The sandbox init should handle both v1 (migrate) and v2 manifests.

## 6. Export Pipeline

### Preview (browser)

- Remotion `<Player>` renders in real-time
- Uses `<Video>` element (native browser video)
- Media loads from presigned URLs (direct S3)
- Suitable for editing, not final output

### Export (server — worker)

- User clicks Export → API queues job → worker picks up
- Worker reads manifest from sandbox
- Worker uses `remotion render` CLI with same `PlayerComposition.tsx` + manifest
- `OffthreadVideo` used instead of `<Video>` (better for server rendering). The `require('remotion')` shim in the browser maps `OffthreadVideo` → `Video`; server-side rendering uses the real `OffthreadVideo`. Same `PlayerComposition.tsx` works in both contexts.
- `staticFile()` calls resolve to presigned URLs (same assets map)
- Output MP4 uploaded to S3 → user gets download link

### Export to other editors (future)

The structured manifest enables conversion to:
- FCP XML (Final Cut Pro)
- Premiere Pro XML
- DaVinci Resolve EDL

This is a straightforward format conversion since all timing, track, and item data is structured JSON.

## 7. AI Creative Freedom

The AI has two paths for any edit:

**Path 1: Manifest edit**
- Fast (no esbuild rebuild if only manifest changes)
- User-editable in Phase 2 timeline
- Covers: cuts, trims, positioning, text, images, shapes, keyframe animations, filters

**Path 2: Scene file**
- Full Remotion/React creative freedom
- Requires esbuild rebuild
- User can move/resize/delete but not visually edit internals
- Covers: custom animations, particles, 3D, audio-reactive, procedural graphics

The AI chooses which path based on creative needs. Prompt engineering guides the style and aesthetic, not the architecture. The system is unconstrained — the AI has full access to both manifest and scene files.

## Non-Goals

- Replacing Remotion with WebCodecs renderer (future consideration)
- Real-time collaborative editing (single user + AI for now)
- Timeline UI (Phase 2, not this spec)
- WebGPU compositing (Remotion handles rendering)

## Dependencies

- MinIO/S3 SDK in sandbox for asset upload + presigned URL generation
- Zod schemas for manifest v2 validation
- Migration function for manifest v1 → v2
