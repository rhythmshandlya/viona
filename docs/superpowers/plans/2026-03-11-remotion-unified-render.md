# Unified Remotion Render Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all FFmpeg video compositing — every render path (stacked, PiP, audio-only) uses the FullComposition React component, producing a single Remotion render + audio mux.

**Architecture:** Extend the existing `FullComposition` component to support three layout modes: `stacked` (existing), `pip` (new — visuals fullscreen, video as a small bubble), and `audio-only` (new — visuals fullscreen, no video). The render pipeline in `index.ts` will always produce `composition-props.json` and use `muxAudioOnly`, eliminating `renderWithPiPLayout`, `finalizeRemotionVideo`, the second-pass `renderVideo` call, and the separate subtitle render pass.

**Tech Stack:** React, Remotion (`interpolate`, `OffthreadVideo`, `Sequence`), TypeScript, FFmpeg (audio mux only)

---

## File Structure

### Remotion Composition (render-time React components)
| File | Responsibility |
|------|---------------|
| `packages/worker/remotion-template/src/composition/types.ts` | Add `PiPSettings`, `LayoutMode`, extend `FullCompositionProps` |
| `packages/worker/remotion-template/src/composition/PiPVideo.tsx` | **NEW** — PiP bubble: rounded corners, border, shadow, position |
| `packages/worker/remotion-template/src/composition/FullComposition.tsx` | Branch on `layoutMode` to render stacked vs PiP vs audio-only |
| `packages/worker/remotion-template/src/composition/utils.ts` | Add PiP layout math to `getRectsForMode` / `computeLayoutForFrame` |
| `packages/worker/remotion-template/src/composition/index.ts` | Export new types |

### Worker Render Pipeline
| File | Responsibility |
|------|---------------|
| `packages/worker/src/processors/render/types.ts` | Keep `LayoutSettings` (already has pip config) |
| `packages/worker/src/processors/render/index.ts` | Unify all 3 branches into single FullComposition path |
| `packages/worker/src/processors/render/ffmpeg.ts` | Update entry-point generation `defaultProps` |

### Preview (editor) — mirror changes
| File | Responsibility |
|------|---------------|
| `apps/web/src/features/editor-v2/player/layout-utils.ts` | Mirror PiP layout math from `composition/utils.ts` |

---

## Chunk 1: PiP Layout in FullComposition

### Task 1: Add PiP types to composition

**Files:**
- Modify: `packages/worker/remotion-template/src/composition/types.ts`
- Modify: `packages/worker/remotion-template/src/composition/index.ts`

- [ ] **Step 1: Add PiP types and extend FullCompositionProps**

In `types.ts`, add after `SplitSettings`:

```typescript
export type LayoutMode = 'stacked' | 'pip';

export interface PiPSettings {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  offsetX: number;
  offsetY: number;
  /** Percentage of canvas width (e.g. 25 = 25%) */
  size: number;
  shape: 'square' | 'circle' | 'rounded';
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  opacity: number;
  rotation: number;
}
```

Update `FullCompositionProps`:

```typescript
export interface FullCompositionProps {
  layoutMode?: LayoutMode;           // 'stacked' | 'pip', default 'stacked'
  splitSettings: SplitSettings;
  pipSettings?: PiPSettings;         // required when layoutMode === 'pip'
  layoutSegments: LayoutSegment[];
  videoCropSettings: VideoCropSettings;
  sourceVideoFile?: string;          // optional — null for audio-only projects
  subtitles?: SubtitleItemData[];
  defaultSubtitleStyle?: Record<string, unknown>;
}
```

Note: `sourceVideoFile` changes from required `string` to optional `string | undefined` to support audio-only projects.

- [ ] **Step 2: Update barrel exports**

In `index.ts`, add to the type export line:

```typescript
export type {
  FullCompositionProps, LayoutSegment, Rect, DisplayMode,
  SplitSettings, VideoCropSettings,
  LayoutMode, PiPSettings,         // NEW
  SubtitleItemData, SubtitleWordData, // NEW — needed by render pipeline
} from './types';
```

- [ ] **Step 3: Commit**

```bash
git add packages/worker/remotion-template/src/composition/types.ts packages/worker/remotion-template/src/composition/index.ts
git commit -m "feat(composition): add PiP types and make sourceVideoFile optional"
```

---

### Task 2: Create PiPVideo component

**Files:**
- Create: `packages/worker/remotion-template/src/composition/PiPVideo.tsx`

- [ ] **Step 1: Create PiPVideo component**

This component renders the speaker video as a styled bubble (border, shadow, rounded corners, positioned in a corner). It mirrors the `buildPiPStyle` logic from `apps/web/src/features/editor-v2/player/Composition.tsx:116-163`.

```tsx
import React from 'react';
import { OffthreadVideo, staticFile } from 'remotion';
import type { PiPSettings, VideoCropSettings } from './types';

interface PiPVideoProps {
  src: string;
  pip: PiPSettings;
  crop: VideoCropSettings;
  canvasWidth: number;
  canvasHeight: number;
  visible: boolean;
}

export const PiPVideo: React.FC<PiPVideoProps> = ({
  src, pip, crop, canvasWidth, canvasHeight, visible,
}) => {
  if (!visible) return null;

  const sizePx = Math.round(canvasWidth * pip.size / 100);

  // Position
  const positionStyle: React.CSSProperties = {};
  switch (pip.position) {
    case 'top-left':
      positionStyle.top = pip.offsetY;
      positionStyle.left = pip.offsetX;
      break;
    case 'top-right':
      positionStyle.top = pip.offsetY;
      positionStyle.right = pip.offsetX;
      break;
    case 'bottom-left':
      positionStyle.bottom = pip.offsetY;
      positionStyle.left = pip.offsetX;
      break;
    case 'bottom-right':
    default:
      positionStyle.bottom = pip.offsetY;
      positionStyle.right = pip.offsetX;
      break;
  }

  const borderRadius = pip.shape === 'circle'
    ? '50%'
    : pip.shape === 'square'
      ? 0
      : pip.borderRadius;

  const boxShadow = pip.shadowEnabled
    ? `0 4px ${pip.shadowBlur}px ${pip.shadowColor}`
    : 'none';

  // Crop math (same as SpeakerVideo.tsx)
  const aspectRatio = crop.sourceWidth / crop.sourceHeight;
  const scaledW = sizePx * crop.scale;
  const scaledH = scaledW / aspectRatio;
  const maxOffsetX = scaledW - sizePx;
  const maxOffsetY = scaledH - sizePx;
  const offsetX = -(crop.cropX / 100) * maxOffsetX;
  const offsetY = -(crop.cropY / 100) * maxOffsetY;

  return (
    <div
      style={{
        position: 'absolute',
        width: sizePx,
        height: sizePx,
        ...positionStyle,
        borderRadius,
        overflow: 'hidden',
        boxShadow,
        border: pip.borderWidth > 0
          ? `${pip.borderWidth}px solid ${pip.borderColor}`
          : 'none',
        opacity: pip.opacity,
        transform: pip.rotation ? `rotate(${pip.rotation}deg)` : undefined,
        zIndex: 10,
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

- [ ] **Step 2: Commit**

```bash
git add packages/worker/remotion-template/src/composition/PiPVideo.tsx
git commit -m "feat(composition): add PiPVideo bubble component"
```

---

### Task 3: Add PiP display mode logic to utils.ts

**Files:**
- Modify: `packages/worker/remotion-template/src/composition/utils.ts`

- [ ] **Step 1: Update computeLayoutForFrame for PiP mode**

In PiP mode, the layout logic is simpler than stacked — the visuals are always fullscreen and the video is always fullscreen. Display modes change what's visible, not spatial arrangement:

- `default` → visuals fullscreen, PiP bubble visible
- `fullscreen` → visuals fullscreen, PiP bubble hidden
- `overlay` → video fullscreen, visuals on top (same as stacked)
- `gap` → video fullscreen, visuals hidden

Add a new function and update the export:

```typescript
import type { Rect, DisplayMode, LayoutSegment, SplitSettings, LayoutMode } from './types';

/**
 * For PiP mode, compute visibility flags per-frame.
 * Spatial layout is handled by the PiPVideo component; this just decides
 * what's shown/hidden and whether overlay is active.
 */
export function computePiPLayoutForFrame(
  frame: number,
  segments: LayoutSegment[],
): { showVideo: boolean; showVisuals: boolean; isOverlay: boolean } {
  if (segments.length === 0) {
    return { showVideo: true, showVisuals: true, isOverlay: false };
  }

  let segIdx = segments.length - 1;
  for (let i = 0; i < segments.length; i++) {
    if (frame < segments[i].endFrame) {
      segIdx = i;
      break;
    }
  }

  const mode = segments[segIdx].displayMode;

  switch (mode) {
    case 'fullscreen':
      return { showVideo: false, showVisuals: true, isOverlay: false };
    case 'overlay':
      return { showVideo: true, showVisuals: true, isOverlay: true };
    case 'default':
    default:
      return { showVideo: true, showVisuals: true, isOverlay: false };
  }
}
```

Note: Gap segments (no visual item) already map to `displayMode: 'default'` in `buildLayoutSegments`. For PiP gaps, the render pipeline should map them to a new internal concept. However, looking at the existing code, gaps ARE `'default'` segments — in PiP that means visuals fullscreen + PiP bubble visible. This is correct because during gaps, we want the video visible (PiP bubble) with no visuals playing (the visual `<Sequence>` just won't have content for that time range).

Actually, we need to handle gaps differently for PiP. In the current FFmpeg pipeline, gaps show video fullscreen with no visuals. We should preserve this. The solution: the render pipeline already knows about gaps and creates `'default'` layout segments for them. We can change this to create gap-specific segments. But adding a new display mode is invasive.

**Simpler approach:** In PiP mode, during a "gap" (no active visual `<Sequence>`), the visuals layer is naturally empty — the AI-generated scene components only render during their `<Sequence>` time ranges. So PiP bubble + empty visuals layer = effectively "video only with black background". This matches behavior. No special gap handling needed — the visual content simply isn't there during gaps, and the PiP bubble shows the speaker.

- [ ] **Step 2: Commit**

```bash
git add packages/worker/remotion-template/src/composition/utils.ts
git commit -m "feat(composition): add PiP display mode layout computation"
```

---

### Task 4: Update FullComposition to support all layout modes

**Files:**
- Modify: `packages/worker/remotion-template/src/composition/FullComposition.tsx`

- [ ] **Step 1: Add PiP and audio-only rendering paths**

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { computeLayoutForFrame, computePiPLayoutForFrame } from './utils';
import { SpeakerVideo } from './SpeakerVideo';
import { PiPVideo } from './PiPVideo';
import { VisualsLayer } from './VisualsLayer';
import { SubtitleLayer } from './SubtitleLayer';
import type { FullCompositionProps } from './types';

interface Props extends FullCompositionProps {
  children: React.ReactNode;
}

export const FullComposition: React.FC<Props> = ({
  layoutMode = 'stacked',
  splitSettings,
  pipSettings,
  layoutSegments,
  videoCropSettings,
  sourceVideoFile,
  subtitles,
  defaultSubtitleStyle,
  children,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const hasVideo = !!sourceVideoFile;

  // --- Audio-only: visuals fullscreen + subtitles, no video ---
  if (!hasVideo) {
    return (
      <AbsoluteFill style={{ backgroundColor: '#000' }}>
        <VisualsLayer
          rect={{ x: 0, y: 0, w: width, h: height }}
          opacity={1}
        >
          {children}
        </VisualsLayer>
        {subtitles && subtitles.length > 0 && (
          <SubtitleLayer
            subtitles={subtitles}
            videoRect={{ x: 0, y: 0, w: width, h: height }}
            defaultStyle={defaultSubtitleStyle}
          />
        )}
      </AbsoluteFill>
    );
  }

  // --- PiP mode: visuals fullscreen, video as bubble ---
  if (layoutMode === 'pip' && pipSettings) {
    const { showVideo, showVisuals, isOverlay } = computePiPLayoutForFrame(
      frame,
      layoutSegments,
    );

    // In overlay mode, video is fullscreen (not PiP bubble)
    const videoRect = { x: 0, y: 0, w: width, h: height };

    return (
      <AbsoluteFill style={{ backgroundColor: '#000' }}>
        {/* Overlay mode: video fullscreen behind visuals */}
        {isOverlay && (
          <SpeakerVideo
            rect={videoRect}
            src={sourceVideoFile}
            crop={videoCropSettings}
          />
        )}

        {/* Visuals layer — always fullscreen in PiP */}
        {showVisuals && (
          <VisualsLayer
            rect={{ x: 0, y: 0, w: width, h: height }}
            opacity={1}
          >
            {children}
          </VisualsLayer>
        )}

        {/* PiP bubble (non-overlay default mode) */}
        {showVideo && !isOverlay && (
          <PiPVideo
            src={sourceVideoFile}
            pip={pipSettings}
            crop={videoCropSettings}
            canvasWidth={width}
            canvasHeight={height}
            visible={true}
          />
        )}

        {/* Subtitles over video area */}
        {subtitles && subtitles.length > 0 && (
          <SubtitleLayer
            subtitles={subtitles}
            videoRect={isOverlay ? videoRect : {
              x: 0, y: 0, w: width, h: height,
            }}
            defaultStyle={defaultSubtitleStyle}
          />
        )}
      </AbsoluteFill>
    );
  }

  // --- Stacked mode (existing behavior) ---
  const { videoRect, visualsRect, visualsOpacity } = computeLayoutForFrame(
    frame,
    layoutSegments,
    width,
    height,
    splitSettings,
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <SpeakerVideo
        rect={videoRect}
        src={sourceVideoFile}
        crop={videoCropSettings}
      />
      <VisualsLayer rect={visualsRect} opacity={visualsOpacity}>
        {children}
      </VisualsLayer>
      {subtitles && subtitles.length > 0 && (
        <SubtitleLayer
          subtitles={subtitles}
          videoRect={videoRect}
          defaultStyle={defaultSubtitleStyle}
        />
      )}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/remotion-template/src/composition/FullComposition.tsx
git commit -m "feat(composition): support pip and audio-only layout modes"
```

---

## Chunk 2: Unify Render Pipeline

### Task 5: Update render pipeline to always use FullComposition

**Files:**
- Modify: `packages/worker/src/processors/render/index.ts`

This is the core change — all three branches (audio, stacked, PiP) collapse into one: build `composition-props.json` → single Remotion render → `muxAudioOnly`.

- [ ] **Step 1: Replace `useFullComposition` with always-true for projects that have visuals**

Change the condition at line ~491:

```typescript
// Old:
const useFullComposition = layoutSettings?.mode === 'stacked';

// New:
// Always use FullComposition for projects with visuals.
// Layout mode (stacked vs pip) is handled inside the React component.
const useFullComposition = true;
```

- [ ] **Step 2: Update composition-props.json to include layoutMode and pipSettings**

In the `if (useFullComposition)` block (line ~504), update the props object:

```typescript
if (useFullComposition) {
  const layoutSegments = buildLayoutSegments(visualItems, visualFps, project.durationMs || 60000);

  const subtitleData = subtitles.map((sub: any) => ({
    startMs: sub.startMs,
    endMs: sub.endMs,
    words: sub.words || [],
    style: sub.style,
  }));

  const defaultSubtitleStyle = {
    fontFamily: firstStyle.fontFamily || resolvedFontFamily || 'Inter',
    fontSize: firstStyle.fontSize || 56,
    fontWeight: firstStyle.fontWeight || 800,
    color: firstStyle.color || '#ffffff',
    activeColor: firstStyle.activeColor || '#ffff00',
    backgroundColor: firstStyle.backgroundColor || 'transparent',
    activeBackgroundColor: firstStyle.activeBackgroundColor || 'transparent',
    opacity: firstStyle.opacity ?? 1,
    lineHeight: firstStyle.lineHeight ?? 1.4,
    letterSpacing: firstStyle.letterSpacing ?? 0,
    textTransform: firstStyle.textTransform || 'none',
    stroke: firstStyle.stroke ?? null,
    displayMode: firstStyle.displayMode || 'phrase',
    wordsPerPhrase: firstStyle.wordsPerPhrase || 5,
    presetId: firstStyle.presetId,
    position: firstStyle.position || 'bottom',
    effects: firstStyle.effects,
    animation: firstStyle.animation,
    backgroundPadding: firstStyle.backgroundPadding,
    backgroundRadius: firstStyle.backgroundRadius,
  };

  // Resolve PiP size from named presets
  const pipSizeMap: Record<string, number> = { small: 18, medium: 25, large: 35, custom: 25 };
  const pipConfig = layoutSettings?.pip;
  const resolvedPipSize = pipConfig
    ? (pipConfig.size === 'custom' ? pipConfig.customSize : (pipSizeMap[pipConfig.size] || 25))
    : 25;

  const layoutMode = layoutSettings?.mode || 'stacked';

  const compositionProps: Record<string, unknown> = {
    layoutMode,
    splitSettings: layoutSettings?.split || { position: 'visuals-first' as const, ratio: 50, gap: 0 },
    pipSettings: layoutMode === 'pip' && pipConfig ? {
      position: pipConfig.position || 'bottom-right',
      offsetX: pipConfig.offsetX || 20,
      offsetY: pipConfig.offsetY || 20,
      size: resolvedPipSize,
      shape: pipConfig.shape || 'rounded',
      borderRadius: pipConfig.borderRadius || 16,
      borderWidth: pipConfig.borderWidth || 0,
      borderColor: pipConfig.borderColor || '#ffffff',
      shadowEnabled: pipConfig.shadowEnabled ?? true,
      shadowColor: pipConfig.shadowColor || 'rgba(0,0,0,0.3)',
      shadowBlur: pipConfig.shadowBlur || 12,
      opacity: pipConfig.opacity ?? 1,
      rotation: pipConfig.rotation || 0,
    } : undefined,
    layoutSegments,
    videoCropSettings: videoCrop,
    sourceVideoFile: isAudioProject ? undefined : 'source.mp4',
    subtitles: subtitleData,
    defaultSubtitleStyle,
  };

  compositionPropsPath = join(workDir, 'composition-props.json');
  await writeFile(compositionPropsPath, JSON.stringify(compositionProps), 'utf-8');
  logger.info({
    compositionPropsPath,
    layoutMode,
    segmentCount: layoutSegments.length,
    subtitleCount: subtitleData.length,
  }, 'Wrote composition props for full composition render');
}
```

- [ ] **Step 3: Replace all three post-render branches with single muxAudioOnly call**

Replace the entire `if (isAudioProject) { ... } else if (useFullComposition) { ... } else { ... }` block (lines ~623-778) with:

```typescript
// FullComposition renders everything (video + visuals + subtitles + layout).
// Just mux the audio track.
const audioSource = enhancedAudioPath || (isAudioProject ? audioOnlyPath : videoPath);
if (audioSource) {
  await muxAudioOnly({
    videoPath: remotionTempPath,
    audioPath: audioSource,
    sourceVideoPath: videoPath || audioSource, // fallback for audio extraction
    outputPath,
    onProgress: (progress) => {
      const jobProgress = 75 + Math.round(progress * 20);
      publishJobProgress(jobId, jobProgress, `Muxing audio: ${Math.round(progress * 100)}%`);
    },
  });
} else {
  // No audio at all — just copy Remotion output
  await copyFile(remotionTempPath, outputPath);
}
```

- [ ] **Step 4: Remove unused imports**

Remove from the import block:
- `renderVideo` from `@viona/renderer`
- `renderWithPiPLayout` from `./ffmpeg.js`
- `finalizeRemotionVideo` from `./ffmpeg.js`

The imports should become:

```typescript
import {
  buildVideoCropFilter,
  downloadVideoClipsForRender,
  encodeVideoWithAudio,
  renderWithRemotion,
  hasZoneBasedVisuals,
  muxAudioOnly,
} from './ffmpeg.js';
```

Also remove any variables that were only used for the old paths:
- `fullscreenVisualSegments`, `overlaySegments`, `gapSegments` — these were only needed by `renderWithPiPLayout`. Keep them if they're used elsewhere (e.g. logging), otherwise remove.

- [ ] **Step 5: Remove the source video copy condition**

The `if (useFullComposition && videoPath)` block that copies source video to bundle's `public/` should now run for all non-audio projects:

```typescript
// Old:
if (useFullComposition && videoPath) {

// New:
if (videoPath) {
```

- [ ] **Step 6: Run TypeScript compilation**

```bash
cd packages/worker && npx tsc --noEmit --pretty false
```

Expected: Clean compilation (0 errors).

- [ ] **Step 7: Commit**

```bash
git add packages/worker/src/processors/render/index.ts
git commit -m "feat(render): unify all render paths through FullComposition"
```

---

### Task 6: Update entry-point generation defaultProps

**Files:**
- Modify: `packages/worker/src/processors/render/ffmpeg.ts:594-601`

- [ ] **Step 1: Add new fields to defaultProps in dynamic entry point**

In the `rebuildBundleFromCJS` function, update the `defaultProps` in the generated entry content (around line 594):

```typescript
    defaultProps={{
      layoutMode: "stacked",
      splitSettings: { position: "visuals-first", ratio: 50, gap: 0 },
      layoutSegments: [],
      videoCropSettings: { sourceWidth: 1920, sourceHeight: 1080, cropX: 50, cropY: 50, scale: 1.0 },
      sourceVideoFile: "source.mp4",
    }}
```

Note: `pipSettings` is optional so it can be omitted from defaultProps. `subtitles` and `defaultSubtitleStyle` are also optional. Remotion merges `defaultProps` with `inputProps` from the JSON file, so only defaults needed for the `<Composition>` schema are required here.

- [ ] **Step 2: Commit**

```bash
git add packages/worker/src/processors/render/ffmpeg.ts
git commit -m "feat(render): add layoutMode to entry-point defaultProps"
```

---

### Task 7: Mirror PiP layout in editor preview

**Files:**
- Modify: `apps/web/src/features/editor-v2/player/layout-utils.ts`

- [ ] **Step 1: Add computePiPLayoutForFrame**

Copy the `computePiPLayoutForFrame` function from `composition/utils.ts` into `layout-utils.ts`:

```typescript
/**
 * For PiP mode, compute visibility flags per-frame.
 */
export function computePiPLayoutForFrame(
  frame: number,
  segments: LayoutSegment[],
): { showVideo: boolean; showVisuals: boolean; isOverlay: boolean } {
  if (segments.length === 0) {
    return { showVideo: true, showVisuals: true, isOverlay: false };
  }

  let segIdx = segments.length - 1;
  for (let i = 0; i < segments.length; i++) {
    if (frame < segments[i].endFrame) {
      segIdx = i;
      break;
    }
  }

  const mode = segments[segIdx].displayMode;

  switch (mode) {
    case 'fullscreen':
      return { showVideo: false, showVisuals: true, isOverlay: false };
    case 'overlay':
      return { showVideo: true, showVisuals: true, isOverlay: true };
    case 'default':
    default:
      return { showVideo: true, showVisuals: true, isOverlay: false };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/player/layout-utils.ts
git commit -m "feat(preview): mirror PiP layout computation in editor"
```

---

## Chunk 3: Cleanup Dead Code

### Task 8: Remove dead FFmpeg compositing functions

**Files:**
- Modify: `packages/worker/src/processors/render/ffmpeg.ts`
- Modify: `packages/worker/src/processors/render/index.ts`

- [ ] **Step 1: Identify dead exports**

After Task 5, these functions in `ffmpeg.ts` are no longer called:
- `renderWithPiPLayout` (~500 lines, lines 1073-1600+)
- `finalizeRemotionVideo` (~100 lines, lines 1734-1836)

And this import in `index.ts` is removed:
- `renderVideo` from `@viona/renderer`

Verify by searching for references:

```bash
cd /c/Users/armaa/Documents/cllipify
grep -rn "renderWithPiPLayout\|finalizeRemotionVideo" packages/worker/src/ --include="*.ts" | grep -v "ffmpeg.ts"
```

Expected: Only references should be in the import line (already removed in Task 5) and possibly re-exports. If no other consumers exist, delete the functions.

- [ ] **Step 2: Delete `renderWithPiPLayout` from ffmpeg.ts**

Remove the entire function and its type import if unused elsewhere.

- [ ] **Step 3: Delete `finalizeRemotionVideo` from ffmpeg.ts**

Remove the entire function.

- [ ] **Step 4: Remove unused type interfaces**

In `types.ts`, these interfaces were only used by the deleted functions:
- `RenderWithPiPLayoutOptions`
- `FinalizeRemotionVideoOptions`
- `CompositeFullVideoOptions`
- `AddAudioAndSubtitlesOptions`

Check each for references before deleting.

- [ ] **Step 5: Remove unused imports from ffmpeg.ts**

Any helpers/constants only used by the deleted functions (e.g. display-mode segment processing, FFmpeg filter graph builders) can be removed. Be conservative — only remove if truly unreferenced.

- [ ] **Step 6: Run TypeScript compilation**

```bash
cd packages/worker && npx tsc --noEmit --pretty false
```

Expected: Clean compilation.

- [ ] **Step 7: Commit**

```bash
git add packages/worker/src/processors/render/ffmpeg.ts packages/worker/src/processors/render/types.ts
git commit -m "refactor(render): remove dead FFmpeg compositing code"
```

---

### Task 9: Verify end-to-end

- [ ] **Step 1: Run full TypeScript check across monorepo**

```bash
cd /c/Users/armaa/Documents/cllipify
npx turbo run typecheck --filter=@viona/worker --filter=@viona/web
```

Or if turbo isn't set up for typecheck:

```bash
cd packages/worker && npx tsc --noEmit --pretty false
cd ../../apps/web && npx tsc --noEmit --pretty false
```

- [ ] **Step 2: Verify the composition files compile in isolation**

```bash
cd packages/worker/remotion-template && npx tsc --noEmit --pretty false
```

Note: This may show errors for missing `remotion`/`react` modules since the template has no `node_modules`. That's expected — the real test is that the files compile when bundled during render.

- [ ] **Step 3: Commit any fixes**

---

## Summary of Changes

| Before | After |
|--------|-------|
| 3 render paths (audio, stacked, PiP) | 1 render path (FullComposition + muxAudioOnly) |
| FFmpeg filter graph for PiP compositing | React PiPVideo component |
| FFmpeg filter graph for stacked compositing | React FullComposition (existing) |
| Separate Remotion render pass for subtitles | Inline SubtitleLayer in FullComposition |
| `renderWithPiPLayout` (~500 LOC) | Deleted |
| `finalizeRemotionVideo` (~100 LOC) | Deleted |
| `renderVideo` second pass | Eliminated |
| 2-3 FFmpeg re-encodes per render | 1 Remotion render + 1 audio mux (stream copy) |
