# P0: Remotion Overlay Rendering — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make text, image, additional video, and additional audio items from the manifest v2 actually render in both the Remotion preview player and export pipeline.

**Architecture:** New overlay components (TextOverlay, ImageOverlay, VideoOverlay, AudioOverlay) in the Remotion template read manifest items directly. An OverlayLayer iterates filtered items, wrapping each in `<Sequence>` + positioned div with transform. The codegen-generated PlayerComposition renders OverlayLayer alongside FullComposition. Manifest bridge fixes ensure store↔manifest roundtrip is correct for text/video items.

**Tech Stack:** Remotion (Sequence, Audio, OffthreadVideo, Img, interpolate, Easing), Zod, React, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-14-basic-editor-capabilities-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `packages/worker/remotion-template/src/composition/TextOverlay.tsx` | Renders text item with typography from v2 flat data |
| `packages/worker/remotion-template/src/composition/ImageOverlay.tsx` | Renders `<Img>` from asset key with object-fit |
| `packages/worker/remotion-template/src/composition/VideoOverlay.tsx` | Renders `<OffthreadVideo>` for additional clips |
| `packages/worker/remotion-template/src/composition/AudioOverlay.tsx` | Renders `<Audio>` for background music |
| `packages/worker/remotion-template/src/composition/OverlayLayer.tsx` | Iterates overlay items, wraps in Sequence + positioned div |

### Modified Files

| File | Change |
|------|--------|
| `packages/api/src/workspace/workspace-codegen.ts` | Add overlay rendering to PlayerComposition, fix scene type filtering, add text font loading |
| `apps/web/src/features/editor-v2/store/types.ts` | Add `startFrom` to `VideoItemData` |
| `apps/web/src/features/editor-v2/store/manifest-bridge.ts` | Fix text flatten/nest, map video `startFrom`, fix image to use transform |

---

## Chunk 1: Overlay Components

### Task 1: TextOverlay Component

**Files:**
- Create: `packages/worker/remotion-template/src/composition/TextOverlay.tsx`

- [ ] **Step 1: Create TextOverlay component**

```tsx
// packages/worker/remotion-template/src/composition/TextOverlay.tsx
import React from 'react';

interface TextOverlayProps {
  data: {
    text: string;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    color?: string;
    backgroundColor?: string;
    borderRadius?: number;
    padding?: number;
    textAlign?: 'left' | 'center' | 'right';
    lineHeight?: number;
    letterSpacing?: number;
    textTransform?: 'none' | 'uppercase' | 'lowercase';
  };
}

export const TextOverlay: React.FC<TextOverlayProps> = ({ data }) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent:
          data.textAlign === 'left'
            ? 'flex-start'
            : data.textAlign === 'right'
              ? 'flex-end'
              : 'center',
        fontFamily: data.fontFamily || 'Inter',
        fontSize: data.fontSize || 48,
        fontWeight: data.fontWeight || 600,
        color: data.color || '#FFFFFF',
        backgroundColor: data.backgroundColor || 'transparent',
        borderRadius: data.borderRadius ?? 0,
        padding: data.padding ?? 0,
        textAlign: data.textAlign || 'center',
        lineHeight: data.lineHeight ? `${data.lineHeight}` : undefined,
        letterSpacing: data.letterSpacing ? `${data.letterSpacing}px` : undefined,
        textTransform: data.textTransform || 'none',
        overflow: 'hidden',
        wordBreak: 'break-word',
      }}
    >
      {data.text}
    </div>
  );
};
```

- [ ] **Step 2: Verify file compiles**

Run: `cd packages/worker && npx tsc --noEmit --skipLibCheck 2>&1 | grep TextOverlay || echo "No errors"`
Expected: No errors mentioning TextOverlay

- [ ] **Step 3: Commit**

```bash
git add packages/worker/remotion-template/src/composition/TextOverlay.tsx
git commit -m "feat(remotion): add TextOverlay component for manifest text items"
```

---

### Task 2: ImageOverlay Component

**Files:**
- Create: `packages/worker/remotion-template/src/composition/ImageOverlay.tsx`

- [ ] **Step 1: Create ImageOverlay component**

```tsx
// packages/worker/remotion-template/src/composition/ImageOverlay.tsx
import React from 'react';
import { Img, staticFile } from 'remotion';
import { resolveVideoSrc } from './utils';

interface ImageOverlayProps {
  data: {
    src: string;
  };
}

export const ImageOverlay: React.FC<ImageOverlayProps> = ({ data }) => {
  const src = resolveVideoSrc(data.src);

  return (
    <Img
      src={src}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
      }}
    />
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/remotion-template/src/composition/ImageOverlay.tsx
git commit -m "feat(remotion): add ImageOverlay component for manifest image items"
```

---

### Task 3: VideoOverlay Component

**Files:**
- Create: `packages/worker/remotion-template/src/composition/VideoOverlay.tsx`

- [ ] **Step 1: Create VideoOverlay component**

```tsx
// packages/worker/remotion-template/src/composition/VideoOverlay.tsx
import React from 'react';
import { OffthreadVideo, useVideoConfig } from 'remotion';
import { resolveVideoSrc } from './utils';

interface VideoOverlayProps {
  data: {
    src: string;
    startFrom?: number;  // ms offset into source clip
    volume?: number;
    playbackRate?: number;
  };
}

export const VideoOverlay: React.FC<VideoOverlayProps> = ({ data }) => {
  const { fps } = useVideoConfig();
  const src = resolveVideoSrc(data.src);
  const startFromFrames = Math.round(((data.startFrom || 0) / 1000) * fps);

  return (
    <OffthreadVideo
      src={src}
      startFrom={startFromFrames}
      volume={data.volume ?? 1}
      playbackRate={data.playbackRate ?? 1}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      }}
    />
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/remotion-template/src/composition/VideoOverlay.tsx
git commit -m "feat(remotion): add VideoOverlay component for additional video clips"
```

---

### Task 4: AudioOverlay Component

**Files:**
- Create: `packages/worker/remotion-template/src/composition/AudioOverlay.tsx`

- [ ] **Step 1: Create AudioOverlay component**

```tsx
// packages/worker/remotion-template/src/composition/AudioOverlay.tsx
import React from 'react';
import { Audio } from 'remotion';
import { resolveVideoSrc } from './utils';

interface AudioOverlayProps {
  data: {
    src: string;
    volume?: number;
    playbackRate?: number;
  };
}

export const AudioOverlay: React.FC<AudioOverlayProps> = ({ data }) => {
  const src = resolveVideoSrc(data.src);

  return (
    <Audio
      src={src}
      volume={data.volume ?? 1}
      playbackRate={data.playbackRate ?? 1}
    />
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/remotion-template/src/composition/AudioOverlay.tsx
git commit -m "feat(remotion): add AudioOverlay component for background music"
```

---

### Task 5: OverlayLayer Component

**Files:**
- Create: `packages/worker/remotion-template/src/composition/OverlayLayer.tsx`

- [ ] **Step 1: Create OverlayLayer component**

This is the main orchestrator. It filters manifest items by overlay type, wraps each in a `<Sequence>` with the correct timing, and applies transform/filters via a positioned div.

```tsx
// packages/worker/remotion-template/src/composition/OverlayLayer.tsx
import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { TextOverlay } from './TextOverlay';
import { ImageOverlay } from './ImageOverlay';
import { VideoOverlay } from './VideoOverlay';
import { AudioOverlay } from './AudioOverlay';

interface OverlayItem {
  id: string;
  type: string;
  startMs: number;
  endMs: number;
  data: any;
  transform?: {
    x: number | string;
    y: number | string;
    width: number | string;
    height: number | string;
    rotation: number;
    opacity: number;
  };
  filters?: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    blur?: number;
    hue?: number;
    grayscale?: number;
    sepia?: number;
  };
}

interface OverlayLayerProps {
  items: OverlayItem[];
  fps: number;
}

function buildFilterString(filters?: OverlayItem['filters']): string | undefined {
  if (!filters) return undefined;
  const parts: string[] = [];
  if (filters.brightness != null && filters.brightness !== 1) parts.push(`brightness(${filters.brightness})`);
  if (filters.contrast != null && filters.contrast !== 1) parts.push(`contrast(${filters.contrast})`);
  if (filters.saturation != null && filters.saturation !== 1) parts.push(`saturate(${filters.saturation})`);
  if (filters.blur != null && filters.blur !== 0) parts.push(`blur(${filters.blur}px)`);
  if (filters.hue != null && filters.hue !== 0) parts.push(`hue-rotate(${filters.hue}deg)`);
  if (filters.grayscale != null && filters.grayscale !== 0) parts.push(`grayscale(${filters.grayscale})`);
  if (filters.sepia != null && filters.sepia !== 0) parts.push(`sepia(${filters.sepia})`);
  return parts.length > 0 ? parts.join(' ') : undefined;
}

export const OverlayLayer: React.FC<OverlayLayerProps> = ({ items, fps }) => {
  return (
    <AbsoluteFill>
      {items.map((item) => {
        const startFrame = Math.round((item.startMs / 1000) * fps);
        const endFrame = Math.round((item.endMs / 1000) * fps);
        const durationInFrames = Math.max(1, endFrame - startFrame);

        const t = item.transform;
        const filterStr = buildFilterString(item.filters);

        // Audio items have no visual — handled separately
        if (item.type === 'audio') {
          return (
            <Sequence key={item.id} from={startFrame} durationInFrames={durationInFrames}>
              <AudioOverlay data={item.data} />
            </Sequence>
          );
        }

        return (
          <Sequence key={item.id} from={startFrame} durationInFrames={durationInFrames}>
            <div
              style={{
                position: 'absolute',
                left: t?.x ?? 0,
                top: t?.y ?? 0,
                width: t?.width ?? '100%',
                height: t?.height ?? '100%',
                transform: t?.rotation ? `rotate(${t.rotation}deg)` : undefined,
                opacity: t?.opacity ?? 1,
                filter: filterStr,
              }}
            >
              {item.type === 'text' && <TextOverlay data={item.data} />}
              {item.type === 'image' && <ImageOverlay data={item.data} />}
              {item.type === 'video' && <VideoOverlay data={item.data} />}
            </div>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Verify all overlay components compile together**

Run: `cd packages/worker && npx tsc --noEmit --skipLibCheck 2>&1 | grep -E "Overlay|overlay" || echo "No overlay errors"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/worker/remotion-template/src/composition/OverlayLayer.tsx
git commit -m "feat(remotion): add OverlayLayer — orchestrates overlay item rendering"
```

---

## Chunk 2: Codegen Integration

### Task 6: Update workspace-codegen to render overlays

**Files:**
- Modify: `packages/api/src/workspace/workspace-codegen.ts`

This is the critical integration. The codegen generates `PlayerComposition.tsx` as a template literal string. We need to:
1. Import OverlayLayer in the generated code
2. Filter overlay items from manifest
3. Render `<OverlayLayer>` alongside `<FullComposition>`
4. Render audio overlay items as `<Audio>` in `<Sequence>`
5. Fix `buildSceneItems` and `buildLayoutSegments` to match both `visual` and `scene` types

- [ ] **Step 1: Read current codegen file**

Read `packages/api/src/workspace/workspace-codegen.ts` to find the exact location of:
- The import block in the generated template string (search for `import { FullComposition`)
- The `renderFullComposition()` function (where `<FullComposition>` is rendered)
- The `PlayerComposition` component body where the JSX is returned
- `buildSceneItems()` function — the `it.type === 'visual'` filter
- `buildLayoutSegments()` function — the `it.type === 'visual'` filter

- [ ] **Step 2: Fix scene type filtering in buildSceneItems**

In `buildSceneItems()`, find the line filtering `it.type === 'visual'` and change to:

```typescript
// Before:
.filter((it: any) => it.type === 'visual')
// After:
.filter((it: any) => it.type === 'visual' || it.type === 'scene')
```

- [ ] **Step 3: Fix scene type filtering in buildLayoutSegments**

Same pattern — find `it.type === 'visual'` in `buildLayoutSegments()` and change to:

```typescript
.filter((it: any) => it.type === 'visual' || it.type === 'scene')
```

- [ ] **Step 4: Add OverlayLayer import to generated template**

In the template literal that generates `PlayerComposition.tsx`, find the import block and add:

```typescript
import { OverlayLayer } from './composition/OverlayLayer';
import { AbsoluteFill, Sequence, Audio } from 'remotion';
```

Note: `AbsoluteFill` may already be imported — check and avoid duplicates. `Audio` and `Sequence` may also be imported already.

- [ ] **Step 5: Add overlay filtering + rendering to PlayerComposition**

Inside the generated `PlayerComposition` component, after the existing subtitle/layout/scene building code, add:

```typescript
// Filter overlay items (text, image, video, shape — NOT caption, scene, audio)
const overlayTypes = new Set(['text', 'image', 'video', 'shape']);
const overlayItems = (manifest.items || []).filter((i: any) => overlayTypes.has(i.type));
const audioOverlayItems = (manifest.items || []).filter((i: any) => i.type === 'audio');
```

Then modify the return JSX to wrap in `<AbsoluteFill>` and add overlay rendering:

```tsx
return (
  <AbsoluteFill>
    {/* Existing FullComposition rendering (renderFullComposition or ProjectComposition) */}
    {existingJSX}
    {overlayItems.length > 0 && (
      <OverlayLayer items={overlayItems} fps={fps} />
    )}
    {audioOverlayItems.map((item: any) => {
      const startFrame = Math.round((item.startMs / 1000) * fps);
      const endFrame = Math.round((item.endMs / 1000) * fps);
      return (
        <Sequence key={item.id} from={startFrame} durationInFrames={Math.max(1, endFrame - startFrame)}>
          <Audio src={staticFile(item.data?.src || '')} volume={item.data?.volume ?? 1} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
```

- [ ] **Step 6: Add text font collection for overlay text items**

Find the section where `captionFontFamily` is detected (search for `loadFont` or `fontFamily` in the codegen). After the caption font loading, add:

```typescript
// Collect unique font families from text overlay items
const textFonts = (manifest.items || [])
  .filter((i: any) => i.type === 'text' && i.data?.fontFamily)
  .map((i: any) => i.data.fontFamily as string);
const allFonts = [...new Set([captionFontFamily, ...textFonts].filter(Boolean))];
// Generate loadFont() calls for each font
```

Modify the font import generation loop to iterate `allFonts` instead of just `captionFontFamily`.

- [ ] **Step 7: Verify codegen compiles**

Run: `cd packages/api && npx tsc --noEmit --skipLibCheck 2>&1 | head -20`
Expected: No new errors (pre-existing errors are OK)

- [ ] **Step 8: Commit**

```bash
git add packages/api/src/workspace/workspace-codegen.ts
git commit -m "feat(codegen): render overlay items alongside FullComposition in PlayerComposition"
```

---

### Task 7: Copy overlay components to workspace on init

**Files:**
- Modify: `packages/api/src/workspace/workspace-codegen.ts` or `packages/sandbox/src/workspace-init.ts`

The overlay component files (TextOverlay.tsx, ImageOverlay.tsx, etc.) live in `packages/worker/remotion-template/src/composition/`. When a workspace is initialized, the template files are copied into the workspace directory. Verify that the existing copy mechanism already handles new files in `src/composition/` — if it copies the entire `remotion-template/` directory recursively, no changes are needed.

- [ ] **Step 1: Verify template copy mechanism**

Check how the workspace is initialized. Search for where `remotion-template` files are copied to the workspace directory. If it uses recursive copy of the entire template, the new overlay files will be included automatically.

- [ ] **Step 2: If needed, add overlay files to copy list**

If the copy is file-by-file (not recursive), add the 5 new files to the copy list.

- [ ] **Step 3: Commit (if changes were needed)**

```bash
git commit -m "fix(workspace): ensure overlay components are copied to workspace"
```

---

## Chunk 3: Manifest Bridge Fixes

### Task 8: Add startFrom to VideoItemData

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/types.ts`

- [ ] **Step 1: Add startFrom field**

In `types.ts`, find `VideoItemData` (around line 64) and add `startFrom`:

```typescript
export interface VideoItemData {
  src: string;
  width: number;
  height: number;
  volume: number;
  playbackRate: number;
  startFrom?: number;  // ms offset into source clip (v2)
  previewUrl?: string;
  muted?: boolean;
  separatedAudioItemId?: string;
  segmentation?: SegmentationData;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/store/types.ts
git commit -m "feat(types): add startFrom to VideoItemData for v2 clip offset"
```

---

### Task 9: Fix manifest bridge — text item flatten/nest

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/manifest-bridge.ts`

The v2 manifest stores text data as flat fields (`fontFamily`, `fontSize`, etc.) but the store uses nested `TextItemData { text, style: { ... }, position, size }`. We need to fix both directions.

- [ ] **Step 1: Fix manifestToStore for v2 text items**

In `convertManifestItemV2()` (around line 458), find the text case. Currently it falls through to default. Add explicit text handling:

After the `case 'caption':` block, before the existing text/image/shape handling, find where text items are converted. The current v2 converter may just pass through `d` as-is. Fix it to nest the flat fields:

```typescript
case 'text': {
  const data: TextItemData = {
    text: d.text || '',
    style: {
      fontFamily: d.fontFamily || 'Inter',
      fontSize: d.fontSize || 48,
      fontWeight: d.fontWeight || 600,
      color: d.color || '#FFFFFF',
      backgroundColor: d.backgroundColor,
      textAlign: d.textAlign || 'center',
    },
    position: {
      x: item.transform?.x ?? 0,
      y: item.transform?.y ?? 0,
    },
    size: {
      width: typeof item.transform?.width === 'number' ? item.transform.width : 800,
      height: typeof item.transform?.height === 'number' ? item.transform.height : 200,
    },
  };
  return { ...base, data } as TimelineItem;
}
```

- [ ] **Step 2: Fix manifestToStore for v2 image items**

Similarly, fix image items to use transform for position:

```typescript
case 'image': {
  const data: ImageItemData = {
    src: resolvedSrc(d.src || ''),
    width: typeof item.transform?.width === 'number' ? item.transform.width : 1920,
    height: typeof item.transform?.height === 'number' ? item.transform.height : 1080,
    position: {
      x: typeof item.transform?.x === 'number' ? item.transform.x : 0,
      y: typeof item.transform?.y === 'number' ? item.transform.y : 0,
    },
    opacity: item.transform?.opacity ?? 1,
  };
  return { ...base, data } as TimelineItem;
}
```

- [ ] **Step 3: Fix manifestToStore for v2 video items — add startFrom**

In the video case of `convertManifestItemV2()` (around line 460), add `startFrom`:

```typescript
case 'video': {
  const data: VideoItemData = {
    src: resolvedSrc(d.src || ''),
    width: d.width || 1920,
    height: d.height || 1080,
    volume: d.volume ?? 1,
    playbackRate: d.playbackRate ?? 1,
    startFrom: d.startFrom ?? 0,
  };
  return { ...base, data } as TimelineItem;
}
```

- [ ] **Step 4: Fix storeToManifest for text items**

In the `convertStoreItemData()` function (around line 635), fix the text case to flatten:

```typescript
case 'text': {
  const td = d as TextItemData;
  return {
    text: td.text || '',
    fontFamily: td.style?.fontFamily || 'Inter',
    fontSize: td.style?.fontSize || 48,
    fontWeight: td.style?.fontWeight || 600,
    color: td.style?.color || '#FFFFFF',
    backgroundColor: td.style?.backgroundColor,
    textAlign: td.style?.textAlign || 'center',
  };
}
```

- [ ] **Step 5: Fix storeToManifest for image items**

The image case currently outputs `{ src, width, height, position, opacity }` but v2 schema only has `{ src }`. Position/size should go into item transform. Fix:

```typescript
case 'image':
  return {
    src: d.src || '',
  };
```

The transform fields are already handled by `storeToManifest`'s item-level transform serialization (where it spreads `item.transform`).

- [ ] **Step 6: Fix storeToManifest for video items — add startFrom**

In the video data conversion within `saveProject()` or `convertStoreItemData()`, add `startFrom`:

Find where video item data is serialized and add:
```typescript
startFrom: d.startFrom ?? 0,
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -20`
Expected: Only pre-existing errors (missing module `@viona/shared/manifest`, missing `GenerateVisualsOptions`)

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/editor-v2/store/manifest-bridge.ts apps/web/src/features/editor-v2/store/types.ts
git commit -m "fix(manifest-bridge): correct text flatten/nest, image transform, video startFrom for v2"
```

---

### Task 10: Verify end-to-end data flow

This is a manual verification task — no code changes, just confirming the pipeline works.

- [ ] **Step 1: Trace the text overlay data flow**

Verify mentally (or with console.logs if needed):
1. User creates text item → store has `TextItemData { text, style: {...}, position, size }`
2. `storeToManifest()` → manifest has `{ type: 'text', data: { text, fontFamily, fontSize, ... }, transform: { x, y, width, height } }`
3. Manifest passed to Remotion Player → codegen filters `type === 'text'` into overlayItems
4. `OverlayLayer` receives item → wraps in `<Sequence>` + positioned div
5. `TextOverlay` reads `data.fontFamily`, `data.fontSize`, etc. — flat format matches v2 schema

- [ ] **Step 2: Trace the audio overlay data flow**

1. User adds audio → store has `AudioItemData` or v2 audio data with `{ src: assetKey, volume }`
2. `storeToManifest()` → manifest has `{ type: 'audio', data: { src: assetKey, volume } }`
3. Codegen filters `type === 'audio'` into audioOverlayItems
4. Each rendered as `<Sequence><Audio src={staticFile(src)} volume={vol} /></Sequence>`
5. `staticFile(assetKey)` → `customStaticFile` checks `_currentAssetsMap` → presigned S3 URL

- [ ] **Step 3: Commit verification notes (optional)**

No commit needed — this is a verification step.

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | TextOverlay component | New: TextOverlay.tsx |
| 2 | ImageOverlay component | New: ImageOverlay.tsx |
| 3 | VideoOverlay component | New: VideoOverlay.tsx |
| 4 | AudioOverlay component | New: AudioOverlay.tsx |
| 5 | OverlayLayer orchestrator | New: OverlayLayer.tsx |
| 6 | Codegen integration | Modify: workspace-codegen.ts |
| 7 | Workspace template copy | Verify/modify: workspace-init.ts |
| 8 | VideoItemData startFrom | Modify: types.ts |
| 9 | Manifest bridge fixes | Modify: manifest-bridge.ts, types.ts |
| 10 | E2E verification | Manual check |
