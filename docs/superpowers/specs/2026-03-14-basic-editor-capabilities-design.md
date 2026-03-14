# Basic Editor Capabilities — Design Spec

**Date:** 2026-03-14
**Status:** Draft
**Goal:** Make the Viona editor functional for basic video editing — add text/image/audio/video overlays, render them in Remotion, wire asset management to timeline. Everything is JSON-driven (manifest v2) so the AI agent can also create/edit these items.

---

## Context

The editor was built as an AI visual generation frontend. The manifest v2 schema and store already support all item types (video, audio, text, image, shape, caption), but:

1. **Remotion doesn't render** text/image/shape/additional-video/additional-audio items — only source video + AI scenes + captions
2. **No UI** to add items to timeline (no buttons, no drag-to-timeline)
3. **Asset management exists** (~70% built) but isn't wired to timeline item creation

### Existing Infrastructure

| Component | Status |
|-----------|--------|
| Manifest v2 schema (all item types) | Complete |
| Store actions (addItem, updateItem, etc.) | Complete |
| Sandbox dispatch (dispatchOps) | Complete |
| S3/MinIO upload + presigned URLs | Complete |
| `projectAssets` DB table | Complete |
| Upload endpoint `POST /projects/:id/media` | Complete (any mime type) |
| AssetsPanel (image upload + grid) | Partial — image-only filter |
| BrollPanel (video upload + drag-start) | Partial — no drop zone on timeline |
| DataTab properties (volume, text, etc.) | Partial — basic controls exist |
| Timeline canvas rendering | Partial — all types registered, basic boxes |
| Timeline trim handles | Complete — `resize-left`/`resize-right` drag types, `HitTester` edge detection (8px threshold), `drawResizeHandles()` in `CanvasRenderer` |
| FullComposition rendering | Gap — only renders source video + AI scenes + captions |
| Overlay rendering in Remotion | Gap — nothing renders text/image/shape/audio overlays |

### Data Model Notes

**Store vs Manifest v2 schema mismatches** that must be resolved:

| Store Type | Store Shape | Manifest v2 Shape | Resolution |
|-----------|-------------|-------------------|------------|
| `TextItemData` | `{ text, style: { fontFamily, ... }, position, size }` | `{ text, fontFamily, fontSize, ... }` (flat) | Remotion reads v2 flat format. `storeToManifest` must flatten. `manifestToStore` must nest. |
| `ImageItemData` | `{ src, width, height, position, opacity }` | `{ src }` (position/size via `transform`) | Position/size come from item `transform`, not `data`. |
| `VideoItemData` | `{ src, width, height, volume, playbackRate }` | `{ src, startFrom, volume, playbackRate, crop }` | Add `startFrom` to store type. |
| `AudioItemData` | `{ src, volume, ... }` (separation-focused) | `{ src, volume, playbackRate }` | Store audio type is for separated audio. Additional audio overlays use v2 schema directly. |

---

## Priority Tiers

### P0 — Remotion Overlay Rendering Layer
Foundation. Without this, adding items to the timeline is pointless — they wouldn't appear in preview or export.

### P1 — Editor Toolbar & Asset Wiring
UI entry points to create items. Wires existing asset management to timeline.

### P2 — Timeline Interactions Polish
Snap feedback improvements, time tooltips during resize, visual polish on existing trim handles.

### P3 — Advanced Features
Shapes, keyframe animation interpolation in preview, filter rendering.

---

## P0: Remotion Overlay Rendering Layer

### Goal
Text, image, additional video, and additional audio items from the manifest render in the Remotion composition — both in the editor preview player and in export.

### Architecture

Everything is **manifest-driven**. The overlay items are rendered at the `PlayerComposition` level (the codegen-generated wrapper), NOT inside `FullComposition`. This avoids changing `FullComposition`'s prop interface.

**Why:** `FullComposition` receives structured props (`subtitles`, `sceneItems`, `layoutSegments`, etc.) — it does NOT receive the raw manifest. The codegen-generated `PlayerComposition` is where the manifest is available and where overlay items should be extracted and rendered.

**Data flow for player preview:**
1. `WorkspacePlayer` passes `inputProps = { manifest }` to Remotion `<Player>`
2. Codegen-generated `PlayerComposition` receives `{ manifest, videoUrl, audioUrl }`
3. `PlayerComposition` renders `<FullComposition>` (existing) + `<OverlayLayer>` (new) as siblings
4. `OverlayLayer` reads `manifest.items`, filters overlay types, renders each in `<Sequence>`

**Data flow for export:**
Same — the codegen-generated composition includes `<OverlayLayer>` alongside `<FullComposition>`.

### New Files

| File | Responsibility |
|------|---------------|
| `packages/worker/remotion-template/src/composition/OverlayLayer.tsx` | Iterates manifest overlay items, wraps each in `<Sequence>` + positioned div |
| `packages/worker/remotion-template/src/composition/TextOverlay.tsx` | Renders text with font/color/alignment from v2 item data |
| `packages/worker/remotion-template/src/composition/ImageOverlay.tsx` | Renders `<Img>` with object-fit |
| `packages/worker/remotion-template/src/composition/VideoOverlay.tsx` | Renders `<OffthreadVideo>` for additional video clips |
| `packages/worker/remotion-template/src/composition/AudioOverlay.tsx` | Renders `<Audio>` for background music / additional audio |

### Modified Files

| File | Change |
|------|--------|
| `packages/api/src/workspace/workspace-codegen.ts` | In `renderFullComposition()` / `PlayerComposition`: extract overlay items from manifest, render `<OverlayLayer>` alongside `<FullComposition>`. Also fix `buildSceneItems()` and `buildLayoutSegments()` to filter `type === 'scene'` in addition to `type === 'visual'` (v2 uses `scene` type). See [Codegen Template Changes](#codegen-template-changes) for details. |
| `apps/web/src/features/editor-v2/store/types.ts` | Add `startFrom` to `VideoItemData` |
| `apps/web/src/features/editor-v2/store/manifest-bridge.ts` | Fix `storeToManifest` for text items (flatten style); fix `manifestToStore` for text items (nest style); map `startFrom` for video items |

### Rendering Architecture

**Layer order** (rendered by `PlayerComposition`, not `FullComposition`):

```tsx
// In codegen-generated PlayerComposition:
<AbsoluteFill>
  <FullComposition {...fullCompProps}>
    {/* existing: SpeakerVideo, PiP, Scenes, Subtitles, Audio */}
  </FullComposition>
  <OverlayLayer items={overlayItems} fps={fps} />
  {audioOverlayItems.map(item => (
    <Sequence key={item.id} from={startFrame} durationInFrames={dur}>
      <Audio src={resolvedSrc} volume={item.data.volume} />
    </Sequence>
  ))}
</AbsoluteFill>
```

This keeps `FullComposition` untouched while adding overlay rendering above it.

### OverlayLayer Design

```typescript
interface OverlayLayerProps {
  items: ManifestItemV2[];  // Pre-filtered: only text, image, video, shape types
  fps: number;
}
```

`OverlayLayer` receives `ManifestItemV2[]` (the existing discriminated union type from `manifest-v2.ts`), pre-filtered by the codegen to exclude `caption`, `audio`, and `scene` types. No separate `OverlayItem` type needed — the existing schema is sufficient.

For each item:
1. Calculate frame range: `startFrame = Math.round(item.startMs / 1000 * fps)`, `durationInFrames = endFrame - startFrame`
2. Wrap in `<Sequence from={startFrame} durationInFrames={durationInFrames}>`
3. Wrap in positioned `<div>` applying `item.transform` (position, size, rotation, opacity)
4. Render type-specific component inside

Audio items handled separately (no visual — rendered as `<Audio>` components).

### Transform Rendering

Each overlay wrapped in a positioned div (NOT `AbsoluteFill` since we need custom dimensions):
```tsx
<div style={{
  position: 'absolute',
  left: transform.x,      // number (px) or string ('50%')
  top: transform.y,
  width: transform.width,
  height: transform.height,
  transform: `rotate(${transform.rotation}deg)`,
  opacity: transform.opacity,
}}>
  <TypeSpecificComponent data={item.data} />
</div>
```

### Codegen Template Changes

The codegen generates `PlayerComposition.tsx` as a template literal string. Required changes to `workspace-codegen.ts`:

**1. New imports in generated code:**
```typescript
// Add to the template string's import section:
import { OverlayLayer } from './composition/OverlayLayer';
import { AbsoluteFill, Sequence, Audio } from 'remotion';
```

**2. Overlay item filtering in generated PlayerComposition:**
```typescript
// Inside the generated PlayerComposition component body:
const overlayTypes = new Set(['text', 'image', 'video', 'shape']);
const overlayItems = manifest.items?.filter(i => overlayTypes.has(i.type)) ?? [];
const audioItems = manifest.items?.filter(i => i.type === 'audio') ?? [];
```

**3. Rendering alongside FullComposition:**
```typescript
return (
  <AbsoluteFill>
    {renderFullComposition(manifest, videoUrl, audioUrl, fps, subtitles, captionStyle)}
    <OverlayLayer items={overlayItems} fps={fps} />
    {audioItems.map(item => {
      const startFrame = Math.round(item.startMs / 1000 * fps);
      const endFrame = Math.round(item.endMs / 1000 * fps);
      return (
        <Sequence key={item.id} from={startFrame} durationInFrames={endFrame - startFrame}>
          <Audio src={staticFile(item.data.src)} volume={item.data.volume ?? 1} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
```

**4. Fix scene type filtering (pre-existing bug):**
```typescript
// buildSceneItems and buildLayoutSegments currently filter:
//   it.type === 'visual'
// Must also match v2 scene type:
//   it.type === 'visual' || it.type === 'scene'
```

**5. Font loading for text overlays:**
```typescript
// Collect font families from text overlay items, deduplicate with caption font:
const textFonts = manifest.items
  ?.filter(i => i.type === 'text')
  .map(i => i.data.fontFamily)
  .filter(Boolean) ?? [];
const allFonts = [...new Set([captionFontFamily, ...textFonts].filter(Boolean))];
// Generate loadFont() calls for each
```

### Asset Resolution

Overlay items reference asset keys in `data.src` (e.g., `"audio-bgmusic"`). Resolution:
- In **player preview**: `setAssetsMap()` populates presigned S3 URLs. The CJS eval shim's `customStaticFile()` checks the assets map first. Overlay components call `staticFile(src)` which resolves through this chain.
- In **export/render**: workspace copies assets to `public/` directory. `staticFile()` resolves to local paths.
- HTTP/HTTPS URLs pass through directly (for external media).

### Component Specs

**TextOverlay:**
- Renders `<div>` with text content
- Reads v2 flat format: `item.data.text`, `item.data.fontFamily`, `item.data.fontSize`, `item.data.fontWeight`, `item.data.color`, `item.data.backgroundColor`, `item.data.textAlign`, `item.data.letterSpacing`, `item.data.lineHeight`, `item.data.textTransform`, `item.data.borderRadius`, `item.data.padding`
- Font loading: codegen detects `fontFamily` from overlay text items and adds Google Fonts imports (same pattern as caption font loading)

**ImageOverlay:**
- Renders Remotion `<Img>` component
- `src` resolved via `staticFile()` from asset key or direct URL
- `objectFit: 'contain'` (hardcoded — not configurable in v2 schema)
- Fill within transform bounds

**VideoOverlay:**
- Renders `<OffthreadVideo>`
- `src` resolved via `staticFile()` from asset key
- `startFrom` from `item.data.startFrom` (frame offset into source clip, converted from ms)
- `volume` from `item.data.volume` (default 1)
- `playbackRate` from `item.data.playbackRate` (default 1)

**AudioOverlay:**
- Renders `<Audio>` (no visual component)
- `src` resolved via `staticFile()` from asset key
- `volume` from `item.data.volume` (default 1)
- `playbackRate` from `item.data.playbackRate` (default 1, needs schema addition)
- Rendered inside `<Sequence>` for timing

### Manifest Bridge Fixes

**`storeToManifest` for text items** — flatten the nested style:
```typescript
// Before (wrong): { text, style: { fontFamily, ... }, position, size }
// After (correct v2): { text, fontFamily, fontSize, fontWeight, color, ... }
case 'text':
  const td = d as TextItemData;
  return {
    text: td.text,
    fontFamily: td.style.fontFamily,
    fontSize: td.style.fontSize,
    fontWeight: td.style.fontWeight,
    color: td.style.color,
    backgroundColor: td.style.backgroundColor,
    textAlign: td.style.textAlign,
  };
```

Position and size go into `item.transform`, not `item.data`.

**`manifestToStore` for text items** — nest flat fields into style:
```typescript
case 'text':
  return {
    text: d.text,
    style: { fontFamily: d.fontFamily, fontSize: d.fontSize, ... },
    position: { x: item.transform?.x ?? 0, y: item.transform?.y ?? 0 },
    size: { width: item.transform?.width ?? '100%', height: item.transform?.height ?? 'auto' },
  };
```

---

## P1: Editor Toolbar & Asset Wiring

### Goal
Give users UI to add items to timeline, upload media, and manage tracks.

### New Files

| File | Responsibility |
|------|---------------|
| `apps/web/src/features/editor-v2/components/AddItemToolbar.tsx` | Button row: Add Text, Add Image, Add Audio, Add Video |

### Modified Files

| File | Change |
|------|--------|
| `apps/web/src/features/editor-v2/panels/AssetsPanel.tsx` | Extend mime filter to `audio/*,video/*,image/*`; add "Insert at playhead" click action |
| `apps/web/src/features/editor-v2/timeline/TimelineCanvas.tsx` | Add drop zone handler for assets dragged from panels |
| `apps/web/src/features/editor-v2/timeline/track-headers/TrackHeaders.tsx` | Add "+" button for track creation |
| `apps/web/src/features/editor-v2/components/RightPanel.tsx` | Auto-switch to item-properties tab on item selection |
| `apps/web/src/features/editor-v2/Editor.tsx` | Mount AddItemToolbar |

### AddItemToolbar

Simple horizontal button row rendered above the timeline or below the header.

| Button | Action |
|--------|--------|
| **T** Add Text | Creates text item (3s, "Your text here") at playhead on overlay track |
| **Image** Add Image | Opens file picker → upload to S3 → creates image item at playhead |
| **Music** Add Audio | Opens file picker → upload to S3 → creates audio item on audio track |
| **Film** Add Video | Opens file picker → upload to S3 → creates video item on video track |

**Auto-track creation:** If no suitable track exists, auto-create one. E.g., clicking "Add Text" with no overlay track creates an overlay track named "Overlay 1", then places the item.

**Item creation flow:**
1. Button click → (optional file picker + upload) → generate item ID
2. Upload returns `ProjectMediaAsset` with `id`, `url`, `mimeType`, `durationMs`
3. Store asset key in manifest `assets` map: `assets[assetId] = storageKey`
4. `addItem(trackId, item)` updates store — item `data.src` references asset key
5. `dispatchOps([{ tool: 'addItem', input: {...} }])` syncs to sandbox
6. `select([itemId])` selects new item → properties panel opens

**Default item properties:**

| Type | Duration | Transform | Data Defaults |
|------|----------|-----------|---------------|
| Text | 3000ms | `{ x: '10%', y: '40%', width: '80%', height: '20%' }` | `{ text: 'Your text here', fontFamily: 'Inter', fontSize: 48, color: '#FFFFFF', textAlign: 'center' }` |
| Image | 5000ms | `{ x: 0, y: 0, width: '100%', height: '100%' }` | `{ src: assetKey }` |
| Audio | from metadata | N/A (no visual) | `{ src: assetKey, volume: 1 }` |
| Video | from metadata | `{ x: 0, y: 0, width: '100%', height: '100%' }` | `{ src: assetKey, volume: 1, startFrom: 0, playbackRate: 1 }` |

### AssetsPanel Extension

- Accept `accept="image/*,audio/*,video/*"` on file input
- Show type badge per asset (image/audio/video icon based on `mimeType`)
- **"Insert" button** on each uploaded asset → creates timeline item at playhead
- For audio: use `durationMs` from DB metadata for item duration
- For images: default 5s duration
- For video: use `durationMs` from DB metadata

### Timeline Drop Zone

Handle `dragover` + `drop` events on timeline canvas:
- Read `application/x-broll-asset` (existing BrollPanel format) or new `application/x-project-asset` data transfer
- Determine target track from drop Y position (reuse `hitTester.getTrackAtY()`)
- Determine time from drop X position (reuse `hitTester.xToTime()`)
- Create item at that track/time
- If dropped on empty area below tracks, auto-create appropriate track

### Track Creation UI

"+" button at bottom of track headers section:
- Click → small dropdown menu: "Video Track", "Audio Track", "Overlay Track"
- Auto-names: "Video 2", "Audio 1", "Overlay 1" based on existing track count
- Calls `addTrack()` + `dispatchOps`

---

## P2: Timeline Interactions Polish

### Goal
Improve existing trim handle UX with better visual feedback.

### Context
Trim handles already exist:
- `DragType` includes `'resize-left' | 'resize-right'` (`types.ts:561`)
- `HitTester` has `EDGE_THRESHOLD = 8` for edge detection
- `CanvasRenderer.drawResizeHandles()` renders handles on selected items
- `TimelineCanvas.tsx` handles resize drag operations
- `resizeItem()` store action dispatches to sandbox

### Improvements (polish, not new functionality)

| Improvement | Details |
|-------------|---------|
| Time tooltip during resize | Show `mm:ss.ms` tooltip near cursor while dragging edge |
| Snap feedback lines | Draw vertical dotted lines at snap targets during resize |
| Duration label update | Show live duration change (e.g., "+0.5s") during drag |
| Cursor consistency | Ensure `ew-resize` cursor shows on all item types, not just selected |

### Modified Files

| File | Change |
|------|--------|
| `apps/web/src/features/editor-v2/timeline/canvas/CanvasRenderer.ts` | Add time tooltip rendering during resize, snap indicator lines |
| `apps/web/src/features/editor-v2/timeline/TimelineCanvas.tsx` | Track resize tooltip state, pass to renderer |

---

## P3: Advanced Features

### Goal
Shape rendering, keyframe animation interpolation in preview, filter rendering.

### New Files

| File | Responsibility |
|------|---------------|
| `packages/worker/remotion-template/src/composition/ShapeOverlay.tsx` | Renders rectangle/circle/line with fill/stroke |

### Modified Files

| File | Change |
|------|--------|
| `packages/worker/remotion-template/src/composition/OverlayLayer.tsx` | Add shape type handling; add keyframe interpolation; add CSS filter rendering |
| `apps/web/src/features/editor-v2/components/AddItemToolbar.tsx` | Add "Add Shape" button |

### Shape Rendering

**Rectangle:** `<div>` with `backgroundColor: fill`, `border: ${strokeWidth}px solid ${stroke}`, `borderRadius`
**Circle:** `<div>` with `borderRadius: '50%'`, `backgroundColor: fill`, `border`
**Line:** `<div>` with `height: strokeWidth || 2`, `backgroundColor: fill`, rotated via transform

### Keyframe Animation in Preview

For each overlay item with `keyframes[]`:

1. Convert `keyframe.timeMs` to frame numbers (relative to item start within `<Sequence>`)
2. For each transform property that has keyframes, use Remotion `interpolate()`:
   ```typescript
   interpolate(currentFrame, [kf1Frame, kf2Frame], [kf1Value, kf2Value], {
     easing: mapEasing(kf2.easing),
     extrapolateLeft: 'clamp',
     extrapolateRight: 'clamp',
   })
   ```
3. Easing mapping:
   - `linear` → `Easing.linear`
   - `ease-in` → `Easing.in(Easing.ease)`
   - `ease-out` → `Easing.out(Easing.ease)`
   - `ease-in-out` → `Easing.inOut(Easing.ease)`
   - `spring` → `spring({ config: { damping: 200 } })`
   - `cubic-bezier(x1,y1,x2,y2)` → `Easing.bezier(x1,y1,x2,y2)`
4. **Always clamp both sides** — `extrapolateLeft: 'clamp'`, `extrapolateRight: 'clamp'` (prevents runaway interpolation — documented bug from Feb 2026)

### Filter Rendering in Preview

Apply CSS filter string on each overlay's positioned div:

```typescript
// Only include non-default values to avoid unnecessary rendering overhead
const filterParts: string[] = [];
if (filters.brightness != null && filters.brightness !== 1) filterParts.push(`brightness(${filters.brightness})`);
if (filters.contrast != null && filters.contrast !== 1) filterParts.push(`contrast(${filters.contrast})`);
if (filters.saturation != null && filters.saturation !== 1) filterParts.push(`saturate(${filters.saturation})`);
if (filters.blur != null && filters.blur !== 0) filterParts.push(`blur(${filters.blur}px)`);
if (filters.hue != null && filters.hue !== 0) filterParts.push(`hue-rotate(${filters.hue}deg)`);
if (filters.grayscale != null && filters.grayscale !== 0) filterParts.push(`grayscale(${filters.grayscale})`);
if (filters.sepia != null && filters.sepia !== 0) filterParts.push(`sepia(${filters.sepia})`);
const filterStr = filterParts.join(' ') || undefined;
```

Filters can also be keyframe-animated by interpolating individual filter values between keyframes.

---

## Data Flow Summary

```
User Action (Add Text / Drop Asset / AI Tool)
  ↓
Store: addItem(trackId, item)  →  dispatchOps → sandbox POST /ops
  ↓
Manifest v2 JSON updated (items[], assets{})
  ↓
Player: useWorkspaceComposition re-evaluates
  ↓
PlayerComposition (codegen) → OverlayLayer reads manifest.items
  ↓
Remotion renders: TextOverlay / ImageOverlay / VideoOverlay / AudioOverlay / ShapeOverlay
  ↓
Export: same PlayerComposition renders to MP4
```

**AI integration:** The AI agent uses the same `addItem` / `updateItem` / `removeItem` sandbox tools. Since everything is manifest-driven JSON, the AI can create text overlays, add background music, position images — same as the user.

---

## Out of Scope

- Drag-to-reorder layers/z-index within overlay track (items render in manifest order)
- Multi-track compositing with blend modes
- Video effects (green screen, chroma key)
- Audio waveform visualization in preview
- Font upload (use system/Google fonts only)
- Transition effects between overlay items (only AI scenes have transitions)
