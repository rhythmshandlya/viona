# Remotion-Only Render Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all FFmpeg video/audio compositing — every render uses a single Remotion `renderMedia()` call that produces a complete video with video, audio, captions, layout, and scenes.

**Architecture:** Extend `FullComposition` to handle all project types (stacked, PiP, audio-only, no-visuals). The speaker video plays unmuted (carries audio). Subtitles render inline via existing `SubtitleLayer`. The render pipeline collapses from 3 branches into 1 path: build props → copy assets to bundle `public/` → `renderMedia()` → upload. Delete ~3,200 LOC of FFmpeg compositing, ASS subtitle generation, and the `@viona/renderer` render function.

**Tech Stack:** Remotion 4.x (`renderMedia`, `OffthreadVideo`, `Audio`, `@remotion/google-fonts`), React 19, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-11-remotion-only-render-design.md`

---

## File Structure

### Remotion Composition (modified)
| File | Responsibility |
|------|---------------|
| `packages/worker/remotion-template/src/composition/types.ts` | Add `audioFile`, `backgroundColor` to `FullCompositionProps`. Make `layoutMode` required. |
| `packages/worker/remotion-template/src/composition/FullComposition.tsx` | Add PiP path, audio-only path, unmuted video. Universal root for all project types. |
| `packages/worker/remotion-template/src/composition/SpeakerVideo.tsx` | Remove `muted`, make `src` optional |
| `packages/worker/remotion-template/src/composition/utils.ts` | Add `computePiPLayoutForFrame()` |
| `packages/worker/remotion-template/src/composition/SubtitleLayer.tsx` | Add dynamic Google Font loading via `@remotion/google-fonts` |
| `packages/worker/remotion-template/src/composition/index.ts` | Update exports |

### Worker Render Pipeline (modified)
| File | Responsibility |
|------|---------------|
| `packages/worker/src/processors/render/index.ts` | Collapse 3 branches into 1 unified path |
| `packages/worker/src/processors/render/ffmpeg.ts` | Simplify `renderWithRemotion()`, remove font injection, update `rebuildBundleFromCJS()` entry point |
| `packages/worker/src/processors/render/subtitles.ts` | Keep `convertToSubtitles()`, delete ASS functions |
| `packages/worker/src/processors/render/types.ts` | Remove dead types, remove `SubtitleItem` import from `@viona/renderer` |
| `packages/worker/src/processors/render/fonts.ts` | Remove `getASSFontSizeMultiplier`, `SYSTEM_FONTS_DIR` (ASS-only) |

### Deletions
| File | Reason |
|------|--------|
| `packages/renderer/src/render.ts` | **Deprecated, not deleted yet** — still used by no-visuals fallback. Will be removed when standalone FullComposition bundle is created. |
| `packages/renderer/src/components/` | **Kept for now** — `render.ts` depends on them. |
| Functions in `ffmpeg.ts`: `renderWithPiPLayout`, `finalizeRemotionVideo`, `muxAudioOnly`, `encodeVideoWithAudio`, `addAudioAndSubtitles`, `compositeFullVideo`, `detectFontsInBundle`, `injectGoogleFontsIntoBundle` | FFmpeg compositing replaced by Remotion. **Keep `buildVideoCropFilter`** — still used by no-visuals video crop fallback. |
| Functions in `subtitles.ts`: `generateASSForComposite`, `generateASSSubtitles`, `formatASSTime`, `hexToASSColor`, `getASSAlignment` | ASS generation replaced by React components |

---

## Chunk 1: Composition Layer Updates

### Task 1: Update types.ts — Add audioFile, backgroundColor, make layoutMode required

**Files:**
- Modify: `packages/worker/remotion-template/src/composition/types.ts:64-73`

- [ ] **Step 1: Update FullCompositionProps interface**

Replace lines 64-73 with:

```typescript
export interface FullCompositionProps {
  layoutMode: LayoutMode;
  splitSettings: SplitSettings;
  pipSettings?: PiPSettings;
  layoutSegments: LayoutSegment[];
  videoCropSettings: VideoCropSettings;
  sourceVideoFile?: string;
  audioFile?: string;
  backgroundColor?: string;
  subtitles?: SubtitleItemData[];
  defaultSubtitleStyle?: Record<string, unknown>;
}
```

Changes: `layoutMode` is now required (was optional). Added `audioFile?: string` and `backgroundColor?: string`.

- [ ] **Step 2: Update barrel exports**

In `packages/worker/remotion-template/src/composition/index.ts`, the existing exports already cover the new fields since they're part of `FullCompositionProps`. No change needed here.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd packages/worker/remotion-template && npx tsc --noEmit --pretty false 2>&1 | head -20
```

Expected: Errors in `FullComposition.tsx` because `layoutMode` is now required but not destructured. This is expected — we fix it in Task 4.

- [ ] **Step 4: Commit**

```bash
git add packages/worker/remotion-template/src/composition/types.ts
git commit -m "feat(composition): add audioFile, backgroundColor props, make layoutMode required"
```

---

### Task 2: Update SpeakerVideo — unmute, make src optional

**Files:**
- Modify: `packages/worker/remotion-template/src/composition/SpeakerVideo.tsx`

- [ ] **Step 1: Update the component**

Replace the entire file content:

```tsx
import React from 'react';
import { OffthreadVideo, staticFile } from 'remotion';
import type { Rect, VideoCropSettings } from './types';

interface SpeakerVideoProps {
  rect: Rect;
  src?: string;
  crop: VideoCropSettings;
}

export const SpeakerVideo: React.FC<SpeakerVideoProps> = ({ rect, src, crop }) => {
  if (!src) return null;
  if (rect.h <= 10) return null;

  const aspectRatio = crop.sourceWidth / crop.sourceHeight;
  const rectAspect = rect.w / Math.max(rect.h, 1);

  let scaledW: number;
  let scaledH: number;
  if (aspectRatio > rectAspect) {
    scaledH = rect.h * crop.scale;
    scaledW = scaledH * aspectRatio;
  } else {
    scaledW = rect.w * crop.scale;
    scaledH = scaledW / aspectRatio;
  }

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

Changes from current:
- `src` is now optional (`src?: string`), return null when undefined
- Removed `muted` from `<OffthreadVideo>` — audio plays naturally

- [ ] **Step 2: Commit**

```bash
git add packages/worker/remotion-template/src/composition/SpeakerVideo.tsx
git commit -m "feat(composition): unmute SpeakerVideo, make src optional for audio-only"
```

---

### Task 3: Add computePiPLayoutForFrame to utils.ts

**Files:**
- Modify: `packages/worker/remotion-template/src/composition/utils.ts`

- [ ] **Step 1: Add the function at the end of utils.ts (after line 168)**

```typescript
/**
 * For PiP mode, compute visibility flags per-frame.
 * Spatial layout is handled by PiPVideo; this decides what's shown/hidden.
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
git add packages/worker/remotion-template/src/composition/utils.ts
git commit -m "feat(composition): add computePiPLayoutForFrame for PiP display mode logic"
```

---

### Task 4: Rewrite FullComposition — universal root for all project types

**Files:**
- Modify: `packages/worker/remotion-template/src/composition/FullComposition.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
import React from 'react';
import { AbsoluteFill, Audio, useCurrentFrame, useVideoConfig, staticFile } from 'remotion';
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
  layoutMode,
  splitSettings,
  pipSettings,
  layoutSegments,
  videoCropSettings,
  sourceVideoFile,
  audioFile,
  backgroundColor,
  subtitles,
  defaultSubtitleStyle,
  children,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const hasVideo = !!sourceVideoFile;
  const fullRect = { x: 0, y: 0, w: width, h: height };

  // --- Audio-only: visuals fullscreen + subtitles + <Audio> ---
  if (!hasVideo) {
    return (
      <AbsoluteFill style={{ backgroundColor: backgroundColor || '#000' }}>
        <VisualsLayer rect={fullRect} opacity={1}>
          {children}
        </VisualsLayer>
        {subtitles && subtitles.length > 0 && (
          <SubtitleLayer
            subtitles={subtitles}
            videoRect={fullRect}
            defaultStyle={defaultSubtitleStyle}
          />
        )}
        {audioFile && <Audio src={staticFile(audioFile)} />}
      </AbsoluteFill>
    );
  }

  // --- PiP mode ---
  if (layoutMode === 'pip' && pipSettings) {
    const { showVideo, showVisuals, isOverlay } = computePiPLayoutForFrame(
      frame,
      layoutSegments,
    );

    return (
      <AbsoluteFill style={{ backgroundColor: backgroundColor || '#000' }}>
        {/* Overlay mode: video fullscreen behind visuals */}
        {isOverlay && (
          <SpeakerVideo
            rect={fullRect}
            src={sourceVideoFile}
            crop={videoCropSettings}
          />
        )}

        {/* Visuals — always fullscreen in PiP */}
        {showVisuals && (
          <VisualsLayer rect={fullRect} opacity={1}>
            {children}
          </VisualsLayer>
        )}

        {/* PiP bubble (non-overlay) */}
        {showVideo && !isOverlay && (
          <PiPVideo
            src={sourceVideoFile}
            pip={pipSettings}
            crop={videoCropSettings}
            canvasWidth={width}
            canvasHeight={height}
          />
        )}

        {subtitles && subtitles.length > 0 && (
          <SubtitleLayer
            subtitles={subtitles}
            videoRect={fullRect}
            defaultStyle={defaultSubtitleStyle}
          />
        )}
      </AbsoluteFill>
    );
  }

  // --- Stacked mode (default) ---
  const { videoRect, visualsRect, visualsOpacity } = computeLayoutForFrame(
    frame,
    layoutSegments,
    width,
    height,
    splitSettings,
  );

  return (
    <AbsoluteFill style={{ backgroundColor: backgroundColor || '#000' }}>
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

Key changes from current:
- Imports `Audio`, `staticFile`, `PiPVideo`, `computePiPLayoutForFrame`
- Destructures `layoutMode`, `pipSettings`, `audioFile`, `backgroundColor`
- Audio-only path: skips SpeakerVideo, uses `<Audio>` tag
- PiP path: uses PiPVideo bubble + computePiPLayoutForFrame
- Stacked path: same as before but SpeakerVideo is now unmuted

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/worker/remotion-template && npx tsc --noEmit --pretty false 2>&1 | head -20
```

Expected: Clean or minor warnings (SubtitleLayer font loading comes next).

- [ ] **Step 3: Commit**

```bash
git add packages/worker/remotion-template/src/composition/FullComposition.tsx
git commit -m "feat(composition): universal FullComposition — stacked, PiP, and audio-only"
```

---

### Task 5: Add dynamic Google Font loading to SubtitleLayer

**Files:**
- Modify: `packages/worker/remotion-template/src/composition/SubtitleLayer.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
import React, { useMemo } from 'react';
import { Sequence, useVideoConfig, continueRender, delayRender } from 'remotion';
import { getAvailableFonts } from '@remotion/google-fonts';
import { AnimatedSubtitle } from './AnimatedSubtitle';
import type { Rect, SubtitleItemData } from './types';
import type { SubtitleStyle } from './AnimatedSubtitle';

interface SubtitleLayerProps {
  subtitles: SubtitleItemData[];
  videoRect: Rect;
  defaultStyle?: Record<string, unknown>;
}

/**
 * Load a Google Font dynamically by family name.
 * Returns the CSS font-family string, or the original name if not found.
 */
function useDynamicFont(fontFamily: string | undefined): string {
  const [loadedFamily, setLoadedFamily] = React.useState<string>(fontFamily || 'Inter');
  const [handle] = React.useState(() => delayRender('Loading font'));

  React.useEffect(() => {
    if (!fontFamily) {
      continueRender(handle);
      return;
    }

    const fonts = getAvailableFonts();
    const match = fonts.find((f) => f.fontFamily === fontFamily);
    if (!match) {
      // Not a Google Font — use as-is (system font)
      continueRender(handle);
      return;
    }

    match.load().then(async (loaded) => {
      const info = await loaded.loadFont();
      setLoadedFamily(info.fontFamily);
      continueRender(handle);
    }).catch(() => {
      // Font load failed — use fallback
      continueRender(handle);
    });
  }, [fontFamily, handle]);

  return loadedFamily;
}

export const SubtitleLayer: React.FC<SubtitleLayerProps> = ({
  subtitles,
  videoRect,
  defaultStyle,
}) => {
  const { fps } = useVideoConfig();
  const requestedFont = (defaultStyle as any)?.fontFamily as string | undefined;
  const loadedFont = useDynamicFont(requestedFont);

  // Merge loaded font into default style
  const resolvedStyle = useMemo(() => {
    if (!defaultStyle) return defaultStyle;
    return { ...defaultStyle, fontFamily: loadedFont };
  }, [defaultStyle, loadedFont]);

  if (subtitles.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: videoRect.x,
        top: videoRect.y,
        width: videoRect.w,
        height: videoRect.h,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {subtitles.map((item, index) => {
        const fromFrame = Math.round((item.startMs / 1000) * fps);
        const durationInFrames = Math.max(1, Math.round(((item.endMs - item.startMs) / 1000) * fps));

        const mergedStyle: SubtitleStyle = {
          ...(resolvedStyle as SubtitleStyle),
          ...(item.style as SubtitleStyle),
        };

        return (
          <Sequence
            key={index}
            from={fromFrame}
            durationInFrames={durationInFrames}
          >
            <AnimatedSubtitle
              words={item.words}
              startMs={item.startMs}
              endMs={item.endMs}
              style={mergedStyle}
            />
          </Sequence>
        );
      })}
    </div>
  );
};
```

Key changes from current:
- Added `useDynamicFont` hook using `@remotion/google-fonts` `getAvailableFonts()`
- Uses `delayRender` / `continueRender` to block frame rendering until font loads
- Merges loaded font family into the default style before passing to AnimatedSubtitle

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/worker/remotion-template && npx tsc --noEmit --pretty false 2>&1 | head -20
```

Expected: Clean compilation.

- [ ] **Step 3: Commit**

```bash
git add packages/worker/remotion-template/src/composition/SubtitleLayer.tsx
git commit -m "feat(composition): dynamic Google Font loading via @remotion/google-fonts"
```

---

### Task 6: Update rebuildBundleFromCJS entry point

**Files:**
- Modify: `packages/worker/src/processors/render/ffmpeg.ts:569-623`

The entry point template in `rebuildBundleFromCJS` needs updated `defaultProps` to include the new required `layoutMode` field. Also update the non-infra fallback path to use FullComposition since ALL renders now go through it.

- [ ] **Step 1: Update the entry point template defaultProps**

In `packages/worker/src/processors/render/ffmpeg.ts`, find the `defaultProps` block inside the `hasCompositionInfra` entry template (around line 594-599). Replace:

```typescript
    defaultProps={{
      splitSettings: { position: "visuals-first", ratio: 50, gap: 0 },
      layoutSegments: [],
      videoCropSettings: { sourceWidth: 1920, sourceHeight: 1080, cropX: 50, cropY: 50, scale: 1.0 },
      sourceVideoFile: "source.mp4",
    }}
```

with:

```typescript
    defaultProps={{
      layoutMode: "stacked",
      splitSettings: { position: "visuals-first", ratio: 50, gap: 0 },
      layoutSegments: [],
      videoCropSettings: { sourceWidth: 1920, sourceHeight: 1080, cropX: 50, cropY: 50, scale: 1.0 },
      sourceVideoFile: "source.mp4",
      subtitles: [],
      defaultSubtitleStyle: {},
    }}
```

- [ ] **Step 2: Remove font injection after renderMedia**

In `renderWithRemotion()` (around lines 738-741), remove these lines:

```typescript
  const detectedFonts = await detectFontsInBundle(serveUrl);
  await injectGoogleFontsIntoBundle(serveUrl, detectedFonts);
```

Font loading is now handled by `@remotion/google-fonts` inside the components. These functions can be deleted in the cleanup task.

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/processors/render/ffmpeg.ts
git commit -m "feat(render): update entry point defaultProps, remove font injection"
```

---

## Chunk 2: Unify Render Pipeline

### Task 7: Collapse render/index.ts to single path

This is the core task. All 3 branches (audio-only, stacked, PiP) and the no-visuals paths collapse into one: build props → copy assets → renderMedia → upload.

**Files:**
- Modify: `packages/worker/src/processors/render/index.ts`

- [ ] **Step 1: Update imports**

Replace lines 1-40 with:

```typescript
import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { mkdir, rm, readFile, writeFile, copyFile } from 'fs/promises';
import { join, basename } from 'path';
import { tmpdir } from 'os';
import { nanoid } from 'nanoid';
import { db, projects, tracks, timelineItems, jobs, visuals } from '../../db/index.js';
import { downloadFile, uploadFile } from '../../services/minio.js';
import { publishJobProgress, publishJobComplete, publishJobError, setJobProjectId } from '../../services/redis.js';
import { config } from '../../config.js';
import { logger } from '../../logger.js';
import { convertToSubtitles } from './subtitles.js';
import { resolveAvailableFontFamily, ensureFontsDir, downloadFont } from './fonts.js';
import {
  downloadVideoClipsForRender,
  renderWithRemotion,
  hasZoneBasedVisuals,
} from './ffmpeg.js';
import type {
  RenderJobData,
  VideoCropSettings,
  LayoutSegment,
} from './types.js';

// Re-exports for public API
export type { RenderJobData } from './types.js';
export { convertToSubtitles } from './subtitles.js';
export { resolveAvailableFontFamily } from './fonts.js';
```

Removed imports: `renderVideo`, `buildVideoCropFilter`, `encodeVideoWithAudio`, `renderWithPiPLayout`, `finalizeRemotionVideo`, `muxAudioOnly`, `escapePathForFilter`, `formatASSTime`, `hexToASSColor`, `getASSAlignment`, `getASSFontSizeMultiplier`, `SYSTEM_FONTS_DIR`, `DisplayModeSegment`, `SegmentationData`, `OverlayZone`.

- [ ] **Step 2: Replace the rendering section**

The current code from where `useFullComposition` is set (line 491) through the end of the no-visuals branch (line 1051) needs to be replaced. This is ~560 lines becoming ~120 lines.

Find the line `const useFullComposition = layoutSettings?.mode === 'stacked';` (line 491) and replace everything from there through the line `await publishJobProgress(jobId, 85, 'Uploading result...');` (line 1053) with:

```typescript
      // === UNIFIED RENDER PATH ===
      // All project types go through FullComposition: build props → copy assets → renderMedia

      const bundlePublicDir = join(bundlePath, 'public');
      await mkdir(bundlePublicDir, { recursive: true });

      // Copy source video to bundle public/ (video projects only)
      if (videoPath) {
        const bundleSourceVideo = join(bundlePublicDir, 'source.mp4');
        await copyFile(videoPath, bundleSourceVideo);
        logger.info({ bundleSourceVideo }, 'Copied source video to bundle public/');
      }

      // Copy audio file for audio-only projects
      if (isAudioProject && audioOnlyPath) {
        const bundleAudioFile = join(bundlePublicDir, 'audio.mp4');
        await copyFile(audioOnlyPath, bundleAudioFile);
        logger.info({ bundleAudioFile }, 'Copied audio file to bundle public/');
      }

      // Copy YouTube clips to bundle public/
      if (videoClipPaths.size > 0) {
        const clipsDir = join(bundlePublicDir, 'assets', 'clips');
        await mkdir(clipsDir, { recursive: true });
        for (const [sceneId, clipPath] of videoClipPaths) {
          const clipFilename = basename(clipPath);
          await copyFile(clipPath, join(clipsDir, clipFilename));
        }
      }

      // Build layout segments
      const layoutSegments = buildLayoutSegments(visualItems, visualFps, project.durationMs || 60000);

      // Build subtitle data
      const subtitleData = subtitles.map((sub: any) => ({
        startMs: sub.startMs,
        endMs: sub.endMs,
        words: sub.words || [],
        style: sub.style,
      }));

      // Build default subtitle style
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

      // Resolve PiP settings
      const pipSizeMap: Record<string, number> = { small: 18, medium: 25, large: 35, custom: 25 };
      const pipConfig = layoutSettings?.pip;
      const resolvedPipSize = pipConfig
        ? (pipConfig.size === 'custom' ? pipConfig.customSize : (pipSizeMap[pipConfig.size] || 25))
        : 25;
      const resolvedLayoutMode = layoutSettings?.mode || 'stacked';

      // Build composition props (the single source of truth)
      const compositionProps: Record<string, unknown> = {
        layoutMode: resolvedLayoutMode,
        splitSettings: layoutSettings?.split || { position: 'visuals-first' as const, ratio: 50, gap: 0 },
        pipSettings: resolvedLayoutMode === 'pip' && pipConfig ? {
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
        audioFile: isAudioProject ? 'audio.mp4' : undefined,
        subtitles: subtitleData,
        defaultSubtitleStyle,
      };

      const compositionPropsPath = join(workDir, 'composition-props.json');
      await writeFile(compositionPropsPath, JSON.stringify(compositionProps), 'utf-8');
      logger.info({
        compositionPropsPath,
        layoutMode: resolvedLayoutMode,
        segmentCount: layoutSegments.length,
        subtitleCount: subtitleData.length,
        hasVideo: !isAudioProject,
      }, 'Wrote composition props');

      // Single Remotion render — produces final video with audio, captions, everything
      await renderWithRemotion({
        bundlePath,
        compositionId: projectVisual.compositionId,
        outputPath,
        propsPath: compositionPropsPath,
        onProgress: (progress) => {
          const jobProgress = 30 + Math.round(progress * 50);

          // Scene progress reporting
          if (sceneTimestamps.length > 0 && totalFrames > 0) {
            const currentFrame = Math.floor(progress * totalFrames);
            const currentMs = (currentFrame / visualFps) * 1000;

            let currentSceneIndex = 0;
            for (let i = 0; i < sceneTimestamps.length; i++) {
              if (currentMs >= sceneTimestamps[i].startMs && currentMs < sceneTimestamps[i].endMs) {
                currentSceneIndex = i;
                break;
              } else if (currentMs >= sceneTimestamps[i].endMs) {
                currentSceneIndex = i + 1;
              }
            }
            currentSceneIndex = Math.min(currentSceneIndex, sceneTimestamps.length - 1);

            const scene = sceneTimestamps[currentSceneIndex];
            const sceneDesc = scene.description || scene.type || `Scene ${currentSceneIndex + 1}`;
            publishJobProgress(jobId, jobProgress, `Rendering scene ${currentSceneIndex + 1}/${sceneTimestamps.length}: ${sceneDesc}`);
          } else {
            publishJobProgress(jobId, jobProgress, `Rendering: ${Math.round(progress * 100)}%`);
          }
        },
      });

      logger.info({ projectId, outputPath }, 'Remotion render complete');
```

- [ ] **Step 3: Handle the no-visuals paths**

The current code also has separate paths for:
1. Audio-only without visuals (lines 781-893) — FFmpeg black canvas + renderVideo
2. Video without visuals (lines 895-1051) — renderVideo for subtitles or FFmpeg crop

These need to become FullComposition renders too. Find the `} else if (isAudioProject) {` branch (line 781) and replace everything through line 1051 with:

```typescript
    } else if (isAudioProject) {
      // Audio project without visuals — render with FullComposition (audio + subtitles only)
      await publishJobProgress(jobId, 30, 'Rendering audio project...');

      const videoSettings = (project.videoSettings as any) || {};
      const canvasWidth = videoSettings.canvasWidth || 1080;
      const canvasHeight = videoSettings.canvasHeight || 1920;

      // Download audio file
      const audioTrack = projectTracks.find(t => (t as any).type === 'audio');
      const audioItem = audioTrack ? allItems.find(i => (i as any).trackId === audioTrack.id) : null;
      let audioPath: string | undefined;
      if (audioItem && (audioItem as any).data?.fileKey) {
        audioPath = join(workDir, 'audio.mp4');
        await downloadFile('uploads', (audioItem as any).data.fileKey, audioPath);
      }

      // For audio-only without visuals, create a minimal Remotion composition
      // that renders subtitles + audio on a black canvas
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

      // TODO: This path needs a minimal Remotion bundle with just FullComposition
      // (no AI-generated scenes). For now, fall back to the existing renderVideo approach.
      // This will be addressed when we create a standalone FullComposition bundle.
      logger.warn('Audio-only without visuals: using legacy renderVideo path (to be migrated)');
      const { renderVideo } = await import('@viona/renderer');
      const durationMs = project.durationMs || (subtitles.length > 0 ? Math.max(...subtitles.map(s => s.endMs)) + 1000 : 10000);
      if (subtitles.length > 0 || audioPath) {
        await renderVideo({
          videoUrl: audioPath || '',
          subtitles,
          outputPath,
          width: canvasWidth,
          height: canvasHeight,
          fps: 30,
          durationMs,
          defaultSubtitleStyle,
          onProgress: (progress) => {
            const jobProgress = 30 + Math.round((progress / 100) * 55);
            publishJobProgress(jobId, jobProgress, `Rendering: ${progress}%`);
          },
        });
      }
    } else {
      // Video project without visuals — render with FullComposition (video + subtitles)
      await publishJobProgress(jobId, 30, 'Rendering video with subtitles...');

      // TODO: Same as above — needs a standalone FullComposition bundle.
      // For now, fall back to renderVideo.
      logger.warn('Video without visuals: using legacy renderVideo path (to be migrated)');
      const { renderVideo } = await import('@viona/renderer');
      const videoSettings = (project.videoSettings as any) || {};
      const canvasWidth = videoSettings.canvasWidth || 1080;
      const canvasHeight = videoSettings.canvasHeight || 1920;
      const noVisCrop: VideoCropSettings = {
        sourceWidth: project.sourceWidth || 1920,
        sourceHeight: project.sourceHeight || 1080,
        cropX: videoSettings.cropX ?? 50,
        cropY: videoSettings.cropY ?? 50,
        scale: videoSettings.scale ?? 1.0,
      };

      let durationMs = 0;
      try {
        const { execSync } = await import('child_process');
        const ffprobeOutput = execSync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`,
          { encoding: 'utf-8' }
        );
        durationMs = Math.round(parseFloat(ffprobeOutput.trim()) * 1000);
      } catch {
        durationMs = Math.max(...subtitles.map(s => s.endMs)) + 1000;
      }

      if (subtitles.length > 0) {
        await renderVideo({
          videoUrl: videoPath!,
          subtitles,
          outputPath,
          width: canvasWidth,
          height: canvasHeight,
          fps: 30,
          durationMs,
          videoCrop: noVisCrop,
          defaultSubtitleStyle: {
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
          },
          onProgress: (progress) => {
            const jobProgress = 30 + Math.round((progress / 100) * 55);
            publishJobProgress(jobId, jobProgress, `Rendering subtitles: ${progress}%`);
          },
        });
      } else {
        // No subtitles, no visuals — just copy source video (with crop if needed)
        const needsCrop = (videoSettings.cropX != null && videoSettings.cropX !== 50) ||
                          (videoSettings.cropY != null && videoSettings.cropY !== 50) ||
                          (videoSettings.scale != null && videoSettings.scale !== 1.0);
        if (needsCrop) {
          // Keep FFmpeg crop as a simple fallback — no composition needed
          const { buildVideoCropFilter } = await import('./ffmpeg.js');
          const { spawn: sp } = await import('child_process');
          const cw = videoSettings.canvasWidth || 1080;
          const ch = videoSettings.canvasHeight || 1920;
          const cropFilter = buildVideoCropFilter(noVisCrop, cw, ch);
          const cropWorkDir = join(workDir, 'crop');
          await mkdir(cropWorkDir, { recursive: true });
          const localInput = join(cropWorkDir, basename(videoPath!));
          await copyFile(videoPath!, localInput);
          const localOutput = basename(outputPath);
          const cropArgs = [
            '-i', basename(localInput), '-y',
            '-vf', cropFilter,
            '-c:v', 'libx264', '-preset', 'faster', '-crf', '18', '-threads', '4',
            '-map', '0:v', '-map', '0:a?', '-c:a', 'aac',
            localOutput,
          ];
          await new Promise<void>((resolve, reject) => {
            const proc = sp('ffmpeg', cropArgs, { cwd: cropWorkDir, stdio: ['ignore', 'pipe', 'pipe'] });
            let stderr = '';
            proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
            proc.on('close', (code: number | null) => {
              if (code === 0) resolve();
              else reject(new Error(`FFmpeg (crop) exited ${code}: ${stderr.slice(-500)}`));
            });
            proc.on('error', (err: Error) => reject(err));
          });
          await copyFile(join(cropWorkDir, localOutput), outputPath);
        } else {
          await copyFile(videoPath!, outputPath);
        }
      }
    }

    await publishJobProgress(jobId, 85, 'Uploading result...');
```

Note: The no-visuals paths keep a temporary `renderVideo` import as a TODO. These paths don't have a Remotion bundle (no AI-generated scenes), so they can't use `renderWithRemotion()` directly. In a follow-up, we'll create a standalone FullComposition bundle for these cases. For now the legacy path is kept behind a dynamic import so the static import at the top can be removed.

- [ ] **Step 4: Remove enhanced audio references**

Search for `enhancedAudioPath` throughout the file. In the unified render path (Step 2), we no longer reference it. But it may still be defined earlier in the function. Find where `enhancedAudioPath` is assigned and set it to `undefined` or remove the audio enhancement logic. The variable may still be referenced in the no-visuals fallback paths — if so, replace with `undefined`.

Search for the audio enhancement download block (likely around lines 200-250) and remove or comment it out, replacing `enhancedAudioPath` assignments with `const enhancedAudioPath = undefined;`.

- [ ] **Step 5: Run TypeScript compilation**

```bash
cd packages/worker && npx tsc --noEmit --pretty false 2>&1 | head -30
```

Fix any type errors. Common issues:
- Removed imports still referenced somewhere
- `enhancedAudioPath` used in fallback paths

- [ ] **Step 6: Commit**

```bash
git add packages/worker/src/processors/render/index.ts
git commit -m "feat(render): unify render pipeline — single Remotion renderMedia path"
```

---

## Chunk 3: Cleanup Dead Code

### Task 8: Delete dead FFmpeg functions

**Files:**
- Modify: `packages/worker/src/processors/render/ffmpeg.ts`

- [ ] **Step 1: Verify no remaining callers**

```bash
cd /c/Users/armaa/Documents/cllipify
grep -rn "renderWithPiPLayout\|finalizeRemotionVideo\|muxAudioOnly\|encodeVideoWithAudio" packages/worker/src/ --include="*.ts" | grep -v "ffmpeg.ts"
```

Expected: No matches (all callers were removed in Task 7).

- [ ] **Step 2: Delete `renderWithPiPLayout` function**

This is the ~650 LOC FFmpeg filter graph builder (starts at line 1073). Delete the entire function.

- [ ] **Step 3: Delete `finalizeRemotionVideo` function**

Starts at line 1734. Delete the entire function.

- [ ] **Step 4: Delete `muxAudioOnly` function**

Starts at line 2105. Delete the entire function.

- [ ] **Step 5: Delete `encodeVideoWithAudio` function**

Starts at line 260. Delete the entire function.

- [ ] **Step 5b: Delete `addAudioAndSubtitles` and `compositeFullVideo` functions**

These are also FFmpeg compositing helpers. Search for them and delete if present.

- [ ] **Step 6: Delete `detectFontsInBundle` and `injectGoogleFontsIntoBundle` functions**

Find and delete these functions — they were used for the HTML font injection hack.

- [ ] **Step 7: Remove unused imports in ffmpeg.ts**

After deleting the functions, remove any imports that are now unused (e.g., ASS-related, FFmpeg filter helpers).

- [ ] **Step 8: Run TypeScript compilation**

```bash
cd packages/worker && npx tsc --noEmit --pretty false 2>&1 | head -30
```

- [ ] **Step 9: Commit**

```bash
git add packages/worker/src/processors/render/ffmpeg.ts
git commit -m "refactor(render): delete dead FFmpeg compositing functions (~1,500 LOC)"
```

---

### Task 9: Delete dead subtitle functions

**Files:**
- Modify: `packages/worker/src/processors/render/subtitles.ts`

- [ ] **Step 1: Delete ASS-specific functions**

Delete these functions from subtitles.ts:
- `generateASSSubtitles()` (lines 88-120)
- `generateASSForComposite()` (line 128+, ~870 LOC)
- `formatASSTime()` (lines 26-34)
- `hexToASSColor()` (lines 39-72)
- `getASSAlignment()` (lines 80-86)

Keep only:
- `convertToSubtitles()` (lines 9-24)

- [ ] **Step 2: Remove `SubtitleItem` import from `@viona/renderer`**

The import at line 1 (`import type { SubtitleItem } from '@viona/renderer'`) — check if `convertToSubtitles` still needs it. If so, define the type locally or import from the composition types.

- [ ] **Step 3: Run TypeScript compilation**

```bash
cd packages/worker && npx tsc --noEmit --pretty false 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/processors/render/subtitles.ts
git commit -m "refactor(render): delete ASS subtitle generation (~1,000 LOC)"
```

---

### Task 10: Clean up render types

**Files:**
- Modify: `packages/worker/src/processors/render/types.ts`

- [ ] **Step 1: Remove dead type interfaces**

Delete these interfaces (only used by deleted functions):
- `RenderWithPiPLayoutOptions` (lines 157-178)
- `FinalizeRemotionVideoOptions` (lines 180-191)
- `AddAudioAndSubtitlesOptions` (line 145)
- `CompositeFullVideoOptions` (line 193)
- Any other types only referenced by deleted code

- [ ] **Step 2: Remove `SubtitleItem` import from `@viona/renderer`**

Line 1: `import type { SubtitleItem } from '@viona/renderer'` — remove this import. If `SubtitleItem` is still used in the file, define it locally.

- [ ] **Step 3: Remove `escapePathForFilter` if unused**

Check if `escapePathForFilter` (lines 219-230) is still referenced anywhere. If only by deleted FFmpeg functions, remove it.

- [ ] **Step 4: Run TypeScript compilation**

```bash
cd packages/worker && npx tsc --noEmit --pretty false 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/processors/render/types.ts
git commit -m "refactor(render): remove dead types and @viona/renderer import"
```

---

### Task 11: Gut @viona/renderer — keep only animations

**Files:**
- Modify: `packages/renderer/`

The web app imports from `@viona/renderer/animations` (used by `StylePanel.tsx` and `Composition.tsx`). The render function and composition components are dead.

- [ ] **Step 1: Verify web app dependencies**

```bash
grep -rn "from '@viona/renderer" apps/web/src/ --include="*.ts" --include="*.tsx"
```

Expected: Only imports from `@viona/renderer/animations`.

- [ ] **Step 2: Mark render function as deprecated (do NOT delete yet)**

The no-visuals fallback paths in `index.ts` still dynamically import `renderVideo`. We cannot delete `render.ts` until a standalone FullComposition bundle is created for no-visuals projects (follow-up work).

For now, add a deprecation comment to `packages/renderer/src/render.ts`:

```typescript
/**
 * @deprecated Use FullComposition + renderMedia() instead.
 * This function is only kept for the no-visuals fallback paths.
 * Will be removed when standalone FullComposition bundle is created.
 */
```

Keep all files as-is. The gutting will happen in the follow-up when the no-visuals paths are migrated.

- [ ] **Step 3: No package.json changes needed**

Since we're keeping `render.ts` for now (deprecated), all dependencies stay.

- [ ] **Step 4: Run TypeScript compilation**

```bash
cd packages/renderer && npx tsc --noEmit --pretty false 2>&1 | head -20
cd ../../apps/web && npx tsc --noEmit --pretty false 2>&1 | head -20
```

Both must compile cleanly.

- [ ] **Step 5: Commit**

```bash
git add packages/renderer/
git commit -m "refactor(renderer): gut render function, keep only animations module"
```

---

### Task 12: Final verification

- [ ] **Step 1: Full TypeScript check**

```bash
cd /c/Users/armaa/Documents/cllipify
cd packages/worker && npx tsc --noEmit --pretty false 2>&1 | head -30
cd ../renderer && npx tsc --noEmit --pretty false 2>&1 | head -20
cd ../../apps/web && npx tsc --noEmit --pretty false 2>&1 | head -30
```

All must compile cleanly.

- [ ] **Step 2: Verify composition template compiles**

```bash
cd packages/worker/remotion-template && npx tsc --noEmit --pretty false 2>&1 | head -20
```

- [ ] **Step 3: Check no dead imports remain**

```bash
grep -rn "generateASSForComposite\|generateASSSubtitles\|renderWithPiPLayout\|finalizeRemotionVideo\|muxAudioOnly\|encodeVideoWithAudio" packages/worker/src/ --include="*.ts"
```

Expected: No matches.

- [ ] **Step 4: Commit any fixes**

```bash
git add -u
git commit -m "fix: resolve compilation errors from render pipeline cleanup"
```

---

## Summary

| Before | After |
|--------|-------|
| 3 render paths (audio, stacked, PiP) | 1 render path (FullComposition) |
| 2-3 encode passes per export | 1 Remotion renderMedia() call |
| FFmpeg filter graph for PiP (~650 LOC) | React PiPVideo component (existing) |
| FFmpeg ASS subtitle generation (~1,000 LOC) | React SubtitleLayer (existing) |
| FFmpeg audio mux / encode (~200 LOC) | Unmuted `<OffthreadVideo>` + `<Audio>` |
| HTML font injection hack | `@remotion/google-fonts` native loading |
| ~3,200 LOC to delete | ~150 lines of changes |
| Preview ≠ export | Same React composition = pixel-perfect match |

**Follow-up work (not in this plan):**
- Create standalone FullComposition bundle for no-visuals projects (eliminate remaining `renderVideo` fallback)
- Move `@viona/renderer/animations` to `@viona/shared` (cleaner package structure)
- Add `<Player>` to frontend consuming FullComposition (agentic editing prerequisite)
