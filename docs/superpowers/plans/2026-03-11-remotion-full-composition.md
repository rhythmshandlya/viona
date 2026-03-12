# Remotion Full Composition — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all video composition (speaker video, visuals, layout transitions, subtitles) into a single Remotion React composition, replacing the FFmpeg filter chain.

**Architecture:** New shared components in `remotion-template/src/composition/` wrap the AI-generated scene tree. LayoutManager interpolates element positions during display mode transitions. The render pipeline copies source.mp4 to the bundle's public/ dir and passes layout props via `--props`. FFmpeg reduces to audio-only muxing.

**Tech Stack:** Remotion 4.x (`<OffthreadVideo>`, `interpolate()`, `useCurrentFrame()`), React 19, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-11-remotion-full-composition-design.md`

---

## File Structure

### New Files (in `packages/worker/remotion-template/src/composition/`)
| File | Responsibility |
|------|---------------|
| `types.ts` | `Rect`, `LayoutSegment`, `FullCompositionProps` types |
| `utils.ts` | `getRectForMode()`, `interpolateRect()`, `msToFrame()` helpers |
| `LayoutManager.tsx` | Per-frame rect calculation with 12-frame transition interpolation |
| `SpeakerVideo.tsx` | `<OffthreadVideo>` wrapper with crop/pan/zoom |
| `VisualsLayer.tsx` | Wraps AI-generated scene tree, scales to fit layout rect |
| `FullComposition.tsx` | Root composition assembling all layers |

### Modified Files
| File | Change |
|------|--------|
| `packages/worker/src/processors/generate-visuals/index.ts` | Update Root.tsx generation to use FullComposition wrapper |
| `packages/worker/src/processors/render/index.ts` | Copy source.mp4 to bundle, pass props, skip FFmpeg composite for stacked mode |
| `packages/worker/src/processors/render/types.ts` | Add `LayoutSegment` type |
| `packages/worker/src/processors/render/ffmpeg.ts` | Add `renderWithRemotion` props support, add `muxAudioOnly()` function |
| `packages/worker/remotion-template/package.json` | Ensure `@remotion/media-utils` is available (already has video deps) |

---

## Chunk 1: Composition Components

### Task 1: Types

**Files:**
- Create: `packages/worker/remotion-template/src/composition/types.ts`

- [ ] **Step 1: Create types file**

```typescript
// packages/worker/remotion-template/src/composition/types.ts

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type DisplayMode = 'default' | 'fullscreen' | 'overlay';

export interface LayoutSegment {
  startFrame: number;
  endFrame: number;
  displayMode: DisplayMode;
  overlayOpacity?: number; // default 0.85
}

export interface SplitSettings {
  position: 'visuals-first' | 'video-first';
  ratio: number; // 0-100
  gap: number;   // pixels
}

export interface VideoCropSettings {
  sourceWidth: number;
  sourceHeight: number;
  cropX: number;  // 0-100, 50=center
  cropY: number;  // 0-100, 50=center
  scale: number;  // 1.0=fill, >1=zoom
}

export interface FullCompositionProps {
  splitSettings: SplitSettings;
  layoutSegments: LayoutSegment[];
  videoCropSettings: VideoCropSettings;
  sourceVideoFile: string; // staticFile path, e.g. 'source.mp4'
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/worker/remotion-template && npx tsc --noEmit --pretty false 2>&1 | head -20`
Expected: No errors from composition/types.ts

- [ ] **Step 3: Commit**

```bash
git add packages/worker/remotion-template/src/composition/types.ts
git commit -m "feat(composition): add types for Remotion full composition"
```

---

### Task 2: Utility Functions

**Files:**
- Create: `packages/worker/remotion-template/src/composition/utils.ts`

- [ ] **Step 1: Create utils file**

```typescript
// packages/worker/remotion-template/src/composition/utils.ts
import { interpolate } from 'remotion';
import type { Rect, DisplayMode, LayoutSegment, SplitSettings } from './types';

const TRANSITION_FRAMES = 12; // 400ms at 30fps

/**
 * Calculate the static rects for a given display mode.
 * canvasWidth/canvasHeight come from useVideoConfig().
 */
export function getRectsForMode(
  mode: DisplayMode,
  canvasWidth: number,
  canvasHeight: number,
  split: SplitSettings,
  overlayOpacity?: number,
): { videoRect: Rect; visualsRect: Rect; opacity: number } {
  const gap = split.gap || 0;
  const ratio = (split.ratio || 50) / 100;
  const visualsFirst = split.position === 'visuals-first';

  switch (mode) {
    case 'fullscreen':
      return {
        videoRect: { x: 0, y: canvasHeight, w: canvasWidth, h: 0 }, // off-canvas
        visualsRect: { x: 0, y: 0, w: canvasWidth, h: canvasHeight },
        opacity: 1.0,
      };

    case 'overlay':
      return {
        videoRect: { x: 0, y: 0, w: canvasWidth, h: canvasHeight },
        visualsRect: { x: 0, y: 0, w: canvasWidth, h: canvasHeight },
        opacity: overlayOpacity ?? 0.85,
      };

    case 'default':
    default: {
      const visualsH = Math.round((canvasHeight - gap) * ratio);
      const videoH = Math.round((canvasHeight - gap) * (1 - ratio));

      if (visualsFirst) {
        return {
          videoRect: { x: 0, y: visualsH + gap, w: canvasWidth, h: videoH },
          visualsRect: { x: 0, y: 0, w: canvasWidth, h: visualsH },
          opacity: 1.0,
        };
      } else {
        return {
          videoRect: { x: 0, y: 0, w: canvasWidth, h: videoH },
          visualsRect: { x: 0, y: videoH + gap, w: canvasWidth, h: visualsH },
          opacity: 1.0,
        };
      }
    }
  }
}

/**
 * Interpolate between two rects over TRANSITION_FRAMES.
 * `progress` is 0..1 within the transition window.
 */
export function interpolateRect(from: Rect, to: Rect, frame: number, transStart: number, transEnd: number): Rect {
  const range = [transStart, transEnd] as [number, number];
  const opts = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
  return {
    x: interpolate(frame, range, [from.x, to.x], opts),
    y: interpolate(frame, range, [from.y, to.y], opts),
    w: interpolate(frame, range, [from.w, to.w], opts),
    h: interpolate(frame, range, [from.h, to.h], opts),
  };
}

/**
 * Find the current segment and compute animated rects for a given frame.
 */
export function computeLayoutForFrame(
  frame: number,
  segments: LayoutSegment[],
  canvasWidth: number,
  canvasHeight: number,
  split: SplitSettings,
): { videoRect: Rect; visualsRect: Rect; visualsOpacity: number } {
  if (segments.length === 0) {
    // No segments = show default stacked layout
    const { videoRect, visualsRect, opacity } = getRectsForMode('default', canvasWidth, canvasHeight, split);
    return { videoRect, visualsRect, visualsOpacity: opacity };
  }

  // Find which segment the current frame is in
  let segIdx = 0;
  for (let i = 0; i < segments.length; i++) {
    if (frame >= segments[i].startFrame && frame < segments[i].endFrame) {
      segIdx = i;
      break;
    }
    if (frame >= segments[i].endFrame) {
      segIdx = i + 1;
    }
  }
  segIdx = Math.min(segIdx, segments.length - 1);

  const currentSeg = segments[segIdx];
  const currentRects = getRectsForMode(currentSeg.displayMode, canvasWidth, canvasHeight, split, currentSeg.overlayOpacity);

  // Check if we're in a transition window from the previous segment
  if (segIdx > 0) {
    const prevSeg = segments[segIdx - 1];
    const transStart = currentSeg.startFrame;
    const transEnd = transStart + TRANSITION_FRAMES;

    if (frame < transEnd && prevSeg.displayMode !== currentSeg.displayMode) {
      const prevRects = getRectsForMode(prevSeg.displayMode, canvasWidth, canvasHeight, split, prevSeg.overlayOpacity);
      const videoRect = interpolateRect(prevRects.videoRect, currentRects.videoRect, frame, transStart, transEnd);
      const visualsRect = interpolateRect(prevRects.visualsRect, currentRects.visualsRect, frame, transStart, transEnd);
      const visualsOpacity = interpolate(
        frame,
        [transStart, transEnd],
        [prevRects.opacity, currentRects.opacity],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
      );
      return { videoRect, visualsRect, visualsOpacity };
    }
  }

  return {
    videoRect: currentRects.videoRect,
    visualsRect: currentRects.visualsRect,
    visualsOpacity: currentRects.opacity,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/worker/remotion-template && npx tsc --noEmit --pretty false 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/worker/remotion-template/src/composition/utils.ts
git commit -m "feat(composition): add layout rect calculation and interpolation utils"
```

---

### Task 3: SpeakerVideo Component

**Files:**
- Create: `packages/worker/remotion-template/src/composition/SpeakerVideo.tsx`

- [ ] **Step 1: Create SpeakerVideo component**

```tsx
// packages/worker/remotion-template/src/composition/SpeakerVideo.tsx
import React from 'react';
import { OffthreadVideo, staticFile } from 'remotion';
import type { Rect, VideoCropSettings } from './types';

interface SpeakerVideoProps {
  rect: Rect;
  src: string;
  crop: VideoCropSettings;
}

export const SpeakerVideo: React.FC<SpeakerVideoProps> = ({ rect, src, crop }) => {
  // Don't render when off-canvas (fullscreen mode)
  if (rect.h <= 1) return null;

  // Calculate crop transform: the video is scaled to fill the rect,
  // then offset based on cropX/cropY (0-100 range, 50=center)
  const aspectRatio = crop.sourceWidth / crop.sourceHeight;
  const rectAspect = rect.w / rect.h;

  // Scale to cover the rect area
  let scaledW: number;
  let scaledH: number;
  if (aspectRatio > rectAspect) {
    // Video is wider — scale by height, crop width
    scaledH = rect.h * crop.scale;
    scaledW = scaledH * aspectRatio;
  } else {
    // Video is taller — scale by width, crop height
    scaledW = rect.w * crop.scale;
    scaledH = scaledW / aspectRatio;
  }

  // Compute pan offsets (cropX/cropY: 0=left/top, 50=center, 100=right/bottom)
  const maxOffsetX = scaledW - rect.w;
  const maxOffsetY = scaledH - rect.h;
  const offsetX = -(crop.cropX / 100) * maxOffsetX;
  const offsetY = -(crop.cropY / 100) * maxOffsetY;

  return (
    <div
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        overflow: 'hidden',
      }}
    >
      <OffthreadVideo
        muted
        src={staticFile(src)}
        style={{
          width: scaledW,
          height: scaledH,
          objectFit: 'cover',
          transform: `translate(${offsetX}px, ${offsetY}px)`,
        }}
      />
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/worker/remotion-template && npx tsc --noEmit --pretty false 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/worker/remotion-template/src/composition/SpeakerVideo.tsx
git commit -m "feat(composition): add SpeakerVideo component with crop/pan/zoom"
```

---

### Task 4: VisualsLayer Component

**Files:**
- Create: `packages/worker/remotion-template/src/composition/VisualsLayer.tsx`

- [ ] **Step 1: Create VisualsLayer component**

```tsx
// packages/worker/remotion-template/src/composition/VisualsLayer.tsx
import React from 'react';
import { useVideoConfig } from 'remotion';
import type { Rect } from './types';

interface VisualsLayerProps {
  rect: Rect;
  opacity: number;
  children: React.ReactNode;
}

/**
 * Wraps the AI-generated scene composition tree.
 * Scenes render at full canvas size internally, then get scaled
 * to fit the layout rect via CSS transform.
 */
export const VisualsLayer: React.FC<VisualsLayerProps> = ({ rect, opacity, children }) => {
  const { width, height } = useVideoConfig();

  if (rect.h <= 1) return null;

  const scaleX = rect.w / width;
  const scaleY = rect.h / height;

  return (
    <div
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        overflow: 'hidden',
        opacity,
      }}
    >
      <div
        style={{
          transform: `scale(${scaleX}, ${scaleY})`,
          transformOrigin: 'top left',
          width,
          height,
        }}
      >
        {children}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/worker/remotion-template && npx tsc --noEmit --pretty false 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/worker/remotion-template/src/composition/VisualsLayer.tsx
git commit -m "feat(composition): add VisualsLayer with CSS transform scaling"
```

---

### Task 5: FullComposition Component

**Files:**
- Create: `packages/worker/remotion-template/src/composition/FullComposition.tsx`
- Create: `packages/worker/remotion-template/src/composition/index.ts`

- [ ] **Step 1: Create FullComposition**

```tsx
// packages/worker/remotion-template/src/composition/FullComposition.tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { computeLayoutForFrame } from './utils';
import { SpeakerVideo } from './SpeakerVideo';
import { VisualsLayer } from './VisualsLayer';
import type { FullCompositionProps } from './types';

interface Props extends FullCompositionProps {
  children: React.ReactNode; // The AI-generated scene tree
}

export const FullComposition: React.FC<Props> = ({
  splitSettings,
  layoutSegments,
  videoCropSettings,
  sourceVideoFile,
  children,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const { videoRect, visualsRect, visualsOpacity } = computeLayoutForFrame(
    frame,
    layoutSegments,
    width,
    height,
    splitSettings,
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Visuals layer renders behind speaker video in stacked mode */}
      <VisualsLayer rect={visualsRect} opacity={visualsOpacity}>
        {children}
      </VisualsLayer>

      {/* Speaker video on top (in stacked: bottom half; in overlay: fullscreen behind visuals) */}
      <SpeakerVideo
        rect={videoRect}
        src={sourceVideoFile}
        crop={videoCropSettings}
      />

      {/* In overlay mode, visuals go on TOP of speaker video */}
      {visualsOpacity < 1.0 && (
        <VisualsLayer rect={visualsRect} opacity={visualsOpacity}>
          {children}
        </VisualsLayer>
      )}
    </AbsoluteFill>
  );
};
```

**Wait — the layer order depends on display mode.** In `default` (stacked), visuals and video are side by side. In `overlay`, video is behind and visuals on top. In `fullscreen`, only visuals show. Let me fix the render logic:

The issue is that in overlay mode, the speaker video should render BEHIND the visuals. In stacked/default, they're side by side (no overlap). So the approach should be:
- Always render speaker video first (as background)
- Always render visuals on top
- In stacked mode: rects don't overlap, so z-order doesn't matter
- In overlay mode: visuals render on top with reduced opacity
- In fullscreen: video is off-canvas, only visuals show

This simplifies things — always render video first, visuals second:

```tsx
// packages/worker/remotion-template/src/composition/FullComposition.tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { computeLayoutForFrame } from './utils';
import { SpeakerVideo } from './SpeakerVideo';
import { VisualsLayer } from './VisualsLayer';
import type { FullCompositionProps } from './types';

interface Props extends FullCompositionProps {
  children: React.ReactNode;
}

export const FullComposition: React.FC<Props> = ({
  splitSettings,
  layoutSegments,
  videoCropSettings,
  sourceVideoFile,
  children,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const { videoRect, visualsRect, visualsOpacity } = computeLayoutForFrame(
    frame,
    layoutSegments,
    width,
    height,
    splitSettings,
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Speaker video renders first (behind everything) */}
      <SpeakerVideo
        rect={videoRect}
        src={sourceVideoFile}
        crop={videoCropSettings}
      />

      {/* Visuals layer renders on top */}
      <VisualsLayer rect={visualsRect} opacity={visualsOpacity}>
        {children}
      </VisualsLayer>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Create barrel export**

```typescript
// packages/worker/remotion-template/src/composition/index.ts
export { FullComposition } from './FullComposition';
export type { FullCompositionProps, LayoutSegment, Rect, DisplayMode, SplitSettings, VideoCropSettings } from './types';
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/worker/remotion-template && npx tsc --noEmit --pretty false 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/worker/remotion-template/src/composition/
git commit -m "feat(composition): add FullComposition assembling all layers"
```

---

## Chunk 2: Generator & Render Pipeline Integration

### Task 6: Update Root.tsx Generation

**Files:**
- Modify: `packages/worker/src/processors/generate-visuals/index.ts:218-257`

The generator rewrites `Root.tsx` after the AI generates scene code. Currently it registers the `MainComposition` directly. We need it to wrap in `FullComposition` and accept `inputProps` for layout data.

- [ ] **Step 1: Update Root.tsx template in generator**

In `packages/worker/src/processors/generate-visuals/index.ts`, find the Root.tsx write block (lines 225-242) and replace with:

```typescript
// OLD (lines 225-242):
await writeFile(rootTsx, `import "./index.css";
import { Composition } from "remotion";
import MainComposition from "./${compositionId}";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="${compositionIdDashed}"
        component={MainComposition}
        durationInFrames={${durationFrames}}
        fps={${project.fps || 30}}
        width={${dimensions?.width || 1080}}
        height={${dimensions?.height || 1920}}
      />
    </>
  );
};
`, 'utf-8');

// NEW:
await writeFile(rootTsx, `import "./index.css";
import React from "react";
import { Composition } from "remotion";
import MainComposition from "./${compositionId}";
import { FullComposition } from "./composition";
import type { FullCompositionProps } from "./composition";

const Wrapped: React.FC<FullCompositionProps> = (props) => {
  return (
    <FullComposition {...props}>
      <MainComposition />
    </FullComposition>
  );
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="${compositionIdDashed}"
        component={Wrapped}
        durationInFrames={${durationFrames}}
        fps={${project.fps || 30}}
        width={${dimensions?.width || 1080}}
        height={${dimensions?.height || 1920}}
        defaultProps={{
          splitSettings: { position: "visuals-first", ratio: 50, gap: 0 },
          layoutSegments: [],
          videoCropSettings: { sourceWidth: 1920, sourceHeight: 1080, cropX: 50, cropY: 50, scale: 1.0 },
          sourceVideoFile: "source.mp4",
        }}
      />
    </>
  );
};
`, 'utf-8');
```

The `defaultProps` provide sensible defaults so the composition can still be previewed standalone. During render, actual props are passed via `--props`.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/worker && npx tsc --noEmit --pretty false 2>&1 | head -20`
Expected: No errors in generate-visuals/index.ts

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/processors/generate-visuals/index.ts
git commit -m "feat(generator): update Root.tsx to wrap scenes in FullComposition"
```

---

### Task 7: Add `LayoutSegment` to Render Types

**Files:**
- Modify: `packages/worker/src/processors/render/types.ts`

- [ ] **Step 1: Add LayoutSegment type**

Add after the `DisplayModeSegment` interface (after line 99):

```typescript
/** Unified layout segment for Remotion full composition (frame-based) */
export interface LayoutSegment {
  startFrame: number;
  endFrame: number;
  displayMode: 'default' | 'fullscreen' | 'overlay';
  overlayOpacity?: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/src/processors/render/types.ts
git commit -m "feat(render): add LayoutSegment type for Remotion composition props"
```

---

### Task 8: Add Audio Mux Helper to FFmpeg

**Files:**
- Modify: `packages/worker/src/processors/render/ffmpeg.ts`

- [ ] **Step 1: Add `muxAudioOnly()` function**

Add a new exported function (at the end of ffmpeg.ts, before the last closing brace or at module level):

```typescript
/**
 * Simple audio mux: takes a Remotion-rendered video (which has no audio since
 * OffthreadVideo is muted) and muxes in the audio track.
 * If audioPath is provided, uses that. Otherwise extracts from sourceVideoPath.
 */
export async function muxAudioOnly(options: {
  videoPath: string;         // Remotion output (video only, no audio)
  audioPath: string | null;  // Enhanced audio, or null to extract from source
  sourceVideoPath: string;   // Original source video (fallback audio)
  outputPath: string;
  onProgress?: (progress: number) => void;
}): Promise<void> {
  const { videoPath, audioPath, sourceVideoPath, outputPath, onProgress } = options;
  const { spawn } = await import('child_process');

  const audioSource = audioPath || sourceVideoPath;

  const args = [
    '-i', videoPath,
    '-i', audioSource,
    '-map', '0:v',
    '-map', '1:a',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-shortest',
    '-y',
    outputPath,
  ];

  return new Promise<void>((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on('close', (code) => {
      if (code === 0) {
        onProgress?.(1.0);
        resolve();
      } else {
        reject(new Error(`FFmpeg audio mux exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });
    proc.on('error', (err) => reject(new Error(`Failed to spawn ffmpeg: ${err.message}`)));
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/src/processors/render/ffmpeg.ts
git commit -m "feat(render): add muxAudioOnly helper for simplified composition pipeline"
```

---

### Task 9: Update Render Pipeline for Stacked Layout

**Files:**
- Modify: `packages/worker/src/processors/render/index.ts`

This is the key integration task. For stacked layout mode, we:
1. Copy `source.mp4` to the Remotion bundle's `public/` directory
2. Build `LayoutSegment[]` from the visual display data
3. Write props JSON and pass to `renderWithRemotion` via `--props`
4. Replace FFmpeg composite step with `muxAudioOnly()`

- [ ] **Step 1: Add imports at top of render/index.ts**

Add import for the new types and mux function:

```typescript
import { muxAudioOnly } from './ffmpeg';
import type { LayoutSegment } from './types';
```

- [ ] **Step 2: Add helper to build layout segments**

Add this function near the top of the file (after imports):

```typescript
/**
 * Convert visual display data to frame-based LayoutSegments for Remotion composition.
 * Normalizes 'pip' → 'default' display mode.
 */
function buildLayoutSegments(
  visualItems: Array<{ startMs: number; endMs: number; data: { displayMode: string; overlayOpacity?: number } }>,
  fps: number,
): LayoutSegment[] {
  return visualItems.map((item) => {
    let dm = item.data.displayMode || 'default';
    if (dm === 'pip') dm = 'default'; // normalize
    return {
      startFrame: Math.round((item.startMs / 1000) * fps),
      endFrame: Math.round((item.endMs / 1000) * fps),
      displayMode: dm as 'default' | 'fullscreen' | 'overlay',
      overlayOpacity: item.data.overlayOpacity,
    };
  });
}
```

- [ ] **Step 3: Copy source video to bundle public/ before Remotion render**

In the video project with visuals path (around line 400, after video clip copying), add:

```typescript
// Copy source video to bundle's public/ dir so <OffthreadVideo> can access it via staticFile()
const useFullComposition = layoutSettings?.mode === 'stacked';
if (useFullComposition && videoPath) {
  const bundlePublicDir = join(bundlePath, 'public');
  await mkdir(bundlePublicDir, { recursive: true });
  const bundleSourceVideo = join(bundlePublicDir, 'source.mp4');
  await copyFile(videoPath, bundleSourceVideo);
  logger.info({ bundleSourceVideo }, 'Copied source video to bundle public/ for FullComposition');
}
```

- [ ] **Step 4: Write composition props JSON and pass to renderWithRemotion**

Before the `renderWithRemotion` call (around line 465), add props generation:

```typescript
// Build composition props for full composition mode
if (useFullComposition) {
  const layoutSegments = buildLayoutSegments(visualItems, visualFps);
  const compositionProps = {
    splitSettings: layoutSettings?.split || { position: 'visuals-first', ratio: 50, gap: 0 },
    layoutSegments,
    videoCropSettings: videoCrop,
    sourceVideoFile: 'source.mp4',
  };
  const propsPath = join(workDir, 'composition-props.json');
  await writeFile(propsPath, JSON.stringify(compositionProps), 'utf-8');
  logger.info({ propsPath, segmentCount: layoutSegments.length }, 'Wrote composition props for full composition render');
}
```

Then modify the `renderWithRemotion` call to pass props:

```typescript
await renderWithRemotion({
  bundlePath,
  compositionId: projectVisual.compositionId,
  outputPath: remotionTempPath,
  propsPath: useFullComposition ? join(workDir, 'composition-props.json') : undefined,
  onProgress: (progress) => { /* existing progress callback */ },
});
```

- [ ] **Step 5: Replace FFmpeg composite with audio mux for stacked mode**

In the video project with visuals path (around line 576-607), wrap the existing `renderWithPiPLayout` call:

```typescript
if (useFullComposition) {
  // Full composition mode: Remotion already composited video + visuals.
  // Just mux audio.
  const compositedPath = hasSubtitles ? join(workDir, 'composited.mp4') : outputPath;
  await muxAudioOnly({
    videoPath: remotionTempPath,
    audioPath: enhancedAudioPath,
    sourceVideoPath: videoPath!,
    outputPath: compositedPath,
    onProgress: (progress) => {
      const jobProgress = 75 + Math.round(progress * 7);
      publishJobProgress(jobId, jobProgress, `Muxing audio: ${Math.round(progress * 100)}%`);
    },
  });

  // Pass 2: Overlay subtitles (same as before)
  if (hasSubtitles) {
    // ... existing subtitle overlay code stays unchanged ...
  }
} else {
  // PiP or other layout modes: use existing FFmpeg composite pipeline
  const compositedPath = hasSubtitles ? join(workDir, 'composited.mp4') : outputPath;
  await renderWithPiPLayout({
    // ... existing call unchanged ...
  });

  if (hasSubtitles) {
    // ... existing subtitle overlay code stays unchanged ...
  }
}
```

- [ ] **Step 6: Update `RenderRemotionOptions` to support props**

In `types.ts`, add `propsPath` to `RenderRemotionOptions`:

```typescript
export interface RenderRemotionOptions {
  bundlePath: string;
  compositionId: string;
  outputPath: string;
  propsPath?: string;  // Path to JSON file with composition inputProps
  onProgress?: (progress: number) => void;
}
```

- [ ] **Step 7: Update `renderWithRemotion()` in ffmpeg.ts to use props**

In the `renderWithRemotion` function (ffmpeg.ts), when calling `selectComposition` and `renderMedia`, pass the props:

```typescript
// After loading/rebuilding bundle, before selectComposition:
let inputProps = {};
if (options.propsPath) {
  const { readFile } = await import('fs/promises');
  const propsJson = await readFile(options.propsPath, 'utf-8');
  inputProps = JSON.parse(propsJson);
}

// In selectComposition call:
const composition = await selectComposition({
  serveUrl,
  id: compositionId,
  inputProps,
});

// In renderMedia call:
await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  outputLocation: outputPath,
  inputProps,
  // ... rest of options unchanged
});
```

- [ ] **Step 8: Verify TypeScript compiles**

Run: `cd packages/worker && npx tsc --noEmit --pretty false 2>&1 | head -30`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add packages/worker/src/processors/render/index.ts packages/worker/src/processors/render/ffmpeg.ts packages/worker/src/processors/render/types.ts
git commit -m "feat(render): integrate FullComposition for stacked layout — skip FFmpeg composite"
```

---

## Chunk 3: Verification & Edge Cases

### Task 10: Handle Bundle Rebuild Path

**Files:**
- Modify: `packages/worker/src/processors/render/ffmpeg.ts`

The `rebuildBundleFromCJS` function creates an entry point wrapper. It needs to also wrap with `FullComposition`. Check the rebuild logic and ensure the composition components are available.

- [ ] **Step 1: Ensure composition/ dir is preserved during bundle operations**

The composition/ directory lives in the remotion-template's `src/` folder. During visual generation, the workspace is copied from the template. The AI generates scene files in `src/proj_*/`. The composition components are already in `src/composition/` and will be included in the bundle.

For the **rebuild from CJS** path (which downloads source files from S3), the composition components need to be available. Since they're part of the template and get bundled, they should be in the webpack bundle. Verify this works by checking that the CJS rebuild path doesn't strip non-project files.

Read the `rebuildBundleFromCJS` function to confirm. If it only downloads project-specific files, we may need to ensure composition/ is uploaded to S3 alongside the source files.

- [ ] **Step 2: Update source upload to include composition/ dir**

Check `packages/worker/src/processors/generate-visuals/index.ts` for where sources are uploaded to S3. Ensure `src/composition/` files are included in the upload.

Search for `outputs/sources` or `uploadFile` in generate-visuals to find the upload logic. The composition components must be in the S3 source bundle for rebuild to work.

- [ ] **Step 3: Test the full pipeline manually**

Run a test render with a stacked layout project:
1. Trigger a render job for an existing project with stacked layout
2. Check worker logs for: "Copied source video to bundle public/ for FullComposition"
3. Check worker logs for: "Wrote composition props for full composition render"
4. Verify the output video has smooth layout transitions

- [ ] **Step 4: Commit any fixes**

```bash
git add -u
git commit -m "fix(render): ensure composition components available in bundle rebuild path"
```

---

### Task 11: Handle Default/Gap Segments

**Files:**
- Modify: `packages/worker/src/processors/render/index.ts`

Currently, the render pipeline computes separate `fullscreenVisualSegments`, `overlaySegments`, and `gapSegments`. For the new FullComposition, we need a unified `LayoutSegment[]` that also includes `default` segments (times when visuals are active in stacked mode).

The existing `visualItems` array already has all visual items with their display modes. But gaps between visual items need to be filled with `default` segments so the speaker video is always visible.

- [ ] **Step 1: Update `buildLayoutSegments` to fill gaps**

```typescript
function buildLayoutSegments(
  visualItems: Array<{ startMs: number; endMs: number; data: { displayMode: string; overlayOpacity?: number } }>,
  fps: number,
  totalDurationMs: number,
): LayoutSegment[] {
  const segments: LayoutSegment[] = [];
  let lastEndMs = 0;

  for (const item of visualItems) {
    // Fill gap before this item with 'default' mode
    if (item.startMs > lastEndMs + 50) {
      segments.push({
        startFrame: Math.round((lastEndMs / 1000) * fps),
        endFrame: Math.round((item.startMs / 1000) * fps),
        displayMode: 'default',
      });
    }

    let dm = item.data.displayMode || 'default';
    if (dm === 'pip') dm = 'default';

    segments.push({
      startFrame: Math.round((item.startMs / 1000) * fps),
      endFrame: Math.round((item.endMs / 1000) * fps),
      displayMode: dm as 'default' | 'fullscreen' | 'overlay',
      overlayOpacity: item.data.overlayOpacity,
    });

    lastEndMs = item.endMs;
  }

  // Fill trailing gap
  if (lastEndMs < totalDurationMs - 50) {
    segments.push({
      startFrame: Math.round((lastEndMs / 1000) * fps),
      endFrame: Math.round((totalDurationMs / 1000) * fps),
      displayMode: 'default',
    });
  }

  return segments;
}
```

- [ ] **Step 2: Pass `totalDurationMs` to the helper**

Update the call site to pass `project.durationMs`:

```typescript
const layoutSegments = buildLayoutSegments(visualItems, visualFps, project.durationMs || 60000);
```

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/processors/render/index.ts
git commit -m "fix(render): fill gaps in layout segments with default display mode"
```

---

### Task 12: Update Edit Pipeline

**Files:**
- Modify: `packages/worker/src/processors/edit-visuals/index.ts`

The edit pipeline also rebuilds Root.tsx after edits. It needs the same FullComposition wrapper.

- [ ] **Step 1: Check edit-visuals for Root.tsx writes**

Search for Root.tsx writes in edit-visuals/. If it rewrites Root.tsx, apply the same FullComposition wrapper pattern from Task 6.

- [ ] **Step 2: Update if needed**

Apply the same Root.tsx template as Task 6.

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/processors/edit-visuals/
git commit -m "feat(edit): update edit pipeline Root.tsx to use FullComposition"
```

---

## Summary

**Phase 1 (this plan):** Tasks 1-12 deliver:
- Smooth animated transitions between stacked ↔ fullscreen ↔ overlay display modes
- Speaker video composited in Remotion (no FFmpeg filter chain for stacked layout)
- PiP mode falls back to existing FFmpeg path (unchanged)
- Subtitles still rendered by `@viona/renderer` as a separate pass (unchanged)

**Phase 2 (future):** Move subtitle rendering into FullComposition
**Phase 3 (future):** Move video clips into FullComposition, delete FFmpeg composition code entirely
