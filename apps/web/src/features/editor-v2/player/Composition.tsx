/**
 * Composition Component
 * Remotion composition that renders video and captions
 */

'use client';

import React from 'react';
import { AbsoluteFill, Sequence, Video, Audio, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  resolveAnimation,
  isAnimationConfig,
  migrateAnimation,
} from '@viona/renderer/animations';
import type { AnimationConfig } from '@viona/renderer/animations';
import {
  useItems,
  useItemIds,
  useFps,
  useVideoSettings,
  useSourceDimensions,
  useLayoutSettings,
  useIsAudioProject,
  useShowCaptions,
} from '../store/use-editor-store';
import {
  TimelineItem,
  VideoItemData,
  AudioItemData,
  CaptionItemData,
  VisualItemData,
  PiPSettings,
  SplitSettings,
  LayoutMode,
  PIP_SIZE_MAP,
  CaptionPosition,
  CaptionEffects,
  CaptionWord,
  WordStyleOverrides,
  DEFAULT_CAPTION_POSITION,
  migrateTextShadow,
} from '../store/types';
import { effectsToCss } from '@/lib/effects-utils';
import { DynamicVisualLoader } from './DynamicVisualLoader';
import {
  classifyWordTier,
  computeEmotionalSegments,
  findActiveSegment,
} from '@viona/shared';

// Calculate video transform for crop/pan
function calculateVideoTransform(
  sourceWidth: number,
  sourceHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  cropX: number,
  cropY: number,
  scale: number
) {
  const sourceAspect = sourceWidth / sourceHeight;
  const canvasAspect = canvasWidth / canvasHeight;

  let baseScale: number;
  let translateX = 0;
  let translateY = 0;

  if (sourceAspect > canvasAspect) {
    // Source is wider than canvas (landscape video in portrait canvas)
    baseScale = (canvasHeight / sourceHeight) * scale;
    const scaledWidth = sourceWidth * baseScale;
    const overflow = scaledWidth - canvasWidth;
    translateX = -(overflow * (cropX / 100));
  } else {
    // Source is taller than canvas
    baseScale = (canvasWidth / sourceWidth) * scale;
    const scaledHeight = sourceHeight * baseScale;
    const overflow = scaledHeight - canvasHeight;
    translateY = -(overflow * (cropY / 100));
  }

  return { scale: baseScale, translateX, translateY };
}

// Calculate video transform to achieve "cover" behavior for an arbitrary container
function calculateCoverTransform(
  sourceWidth: number,
  sourceHeight: number,
  containerWidth: number,
  containerHeight: number,
) {
  const scale = Math.max(containerWidth / sourceWidth, containerHeight / sourceHeight);
  const scaledWidth = sourceWidth * scale;
  const scaledHeight = sourceHeight * scale;
  // Center the scaled video within the container
  const translateX = (containerWidth - scaledWidth) / 2;
  const translateY = (containerHeight - scaledHeight) / 2;
  return { scale, translateX, translateY };
}

// Helper to build PiP container style from settings
function buildPiPStyle(pip: PiPSettings): React.CSSProperties {
  const size = pip.size === 'custom' ? pip.customSize : PIP_SIZE_MAP[pip.size];

  const positionProps: React.CSSProperties = {};
  switch (pip.position) {
    case 'top-left':
      positionProps.top = pip.offsetY;
      positionProps.left = pip.offsetX;
      break;
    case 'top-right':
      positionProps.top = pip.offsetY;
      positionProps.right = pip.offsetX;
      break;
    case 'bottom-left':
      positionProps.bottom = pip.offsetY;
      positionProps.left = pip.offsetX;
      break;
    case 'bottom-right':
    default:
      positionProps.bottom = pip.offsetY;
      positionProps.right = pip.offsetX;
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

  return {
    position: 'absolute',
    ...positionProps,
    width: `${size}%`,
    aspectRatio: '1',
    borderRadius,
    overflow: 'hidden',
    boxShadow,
    border: pip.borderWidth > 0 ? `${pip.borderWidth}px solid ${pip.borderColor}` : 'none',
    opacity: pip.opacity,
    transform: pip.rotation ? `rotate(${pip.rotation}deg)` : undefined,
    zIndex: 10,
  };
}

// Helper to resolve position (handles both legacy string and new CaptionPosition object)
function resolvePosition(position: CaptionPosition | 'top' | 'center' | 'bottom'): CaptionPosition {
  if (typeof position === 'object' && 'anchor' in position) {
    return position;
  }
  // Legacy string format
  return {
    ...DEFAULT_CAPTION_POSITION,
    anchor: position as 'top' | 'center' | 'bottom',
  };
}

// Calculate position styles for caption rendering
function calculatePositionStyles(
  position: CaptionPosition,
  lineHeight: number
): React.CSSProperties {
  const { anchor, offsetX, offsetY, rotation, textAlign } = position;
  const captionWidth = position.width ?? 90;

  // Free mode: absolute x,y positioning
  if (position.mode === 'free' && position.x != null && position.y != null) {
    const transforms: string[] = ['translate(-50%, -50%)'];
    if (rotation !== 0) {
      transforms.push(`rotate(${rotation}deg)`);
    }

    const baseStyles: React.CSSProperties = {
      position: 'absolute',
      left: `${position.x}%`,
      top: `${position.y}%`,
      width: `${captionWidth}%`,
      maxWidth: `${captionWidth}%`,
      overflow: 'hidden',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      lineHeight,
      textAlign,
      transform: transforms.join(' '),
    };

    // Justify content based on text alignment
    switch (textAlign) {
      case 'left':
        baseStyles.justifyContent = 'flex-start';
        break;
      case 'right':
        baseStyles.justifyContent = 'flex-end';
        break;
      default:
        baseStyles.justifyContent = 'center';
        break;
    }

    return baseStyles;
  }

  // Anchor mode (default / legacy)
  const baseStyles: React.CSSProperties = {
    position: 'absolute',
    left: `${50 + offsetX}%`,
    width: `${captionWidth}%`,
    maxWidth: `${captionWidth}%`,
    overflow: 'hidden',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    lineHeight,
    textAlign,
  };

  // Build transform
  const transforms: string[] = ['translateX(-50%)'];

  switch (anchor) {
    case 'top':
      baseStyles.top = `${10 + offsetY}%`;
      break;
    case 'center':
      baseStyles.top = `${50 + offsetY}%`;
      transforms[0] = 'translate(-50%, -50%)';
      break;
    case 'bottom':
      baseStyles.bottom = `${15 - offsetY}%`;
      break;
  }

  if (rotation !== 0) {
    transforms.push(`rotate(${rotation}deg)`);
  }

  baseStyles.transform = transforms.join(' ');

  // Justify content based on text alignment
  switch (textAlign) {
    case 'left':
      baseStyles.justifyContent = 'flex-start';
      break;
    case 'right':
      baseStyles.justifyContent = 'flex-end';
      break;
    default:
      baseStyles.justifyContent = 'center';
      break;
  }

  return baseStyles;
}

// Helper to build split layout styles
function buildSplitStyles(
  split: SplitSettings,
  isHorizontal: boolean
): { visualsStyle: React.CSSProperties; videoStyle: React.CSSProperties } {
  const visualsPercent = split.ratio;
  const videoPercent = 100 - split.ratio;
  const gap = split.gap;

  if (isHorizontal) {
    // Horizontal split (top/bottom)
    const isVisualsFirst = split.position === 'visuals-first';
    return {
      visualsStyle: {
        position: 'absolute',
        left: 0,
        [isVisualsFirst ? 'top' : 'bottom']: 0,
        width: '100%',
        height: `calc(${visualsPercent}% - ${gap / 2}px)`,
        overflow: 'hidden',
      },
      videoStyle: {
        position: 'absolute',
        left: 0,
        [isVisualsFirst ? 'bottom' : 'top']: 0,
        width: '100%',
        height: `calc(${videoPercent}% - ${gap / 2}px)`,
        overflow: 'hidden',
      },
    };
  } else {
    // Vertical split (left/right)
    const isVisualsFirst = split.position === 'visuals-first';
    return {
      visualsStyle: {
        position: 'absolute',
        top: 0,
        [isVisualsFirst ? 'left' : 'right']: 0,
        width: `calc(${visualsPercent}% - ${gap / 2}px)`,
        height: '100%',
        overflow: 'hidden',
      },
      videoStyle: {
        position: 'absolute',
        top: 0,
        [isVisualsFirst ? 'right' : 'left']: 0,
        width: `calc(${videoPercent}% - ${gap / 2}px)`,
        height: '100%',
        overflow: 'hidden',
      },
    };
  }
}

// Build animated split styles that interpolate from fullscreen to split position.
// progress=0 means fullscreen (visual 100%, video 0%), progress=1 means final split.
function buildAnimatedSplitStyles(
  split: SplitSettings,
  isHorizontal: boolean,
  progress: number,
): { visualsStyle: React.CSSProperties; videoStyle: React.CSSProperties } {
  const targetVisualsPercent = split.ratio;
  const targetVideoPercent = 100 - split.ratio;
  const targetGap = split.gap;

  // Interpolate: visual goes from 100% to its ratio, video from 0% to its ratio, gap from 0 to gap
  const currentVisualsPercent = 100 - (100 - targetVisualsPercent) * progress;
  const currentVideoPercent = targetVideoPercent * progress;
  const currentGap = targetGap * progress;

  if (isHorizontal) {
    const isVisualsFirst = split.position === 'visuals-first';
    return {
      visualsStyle: {
        position: 'absolute',
        left: 0,
        [isVisualsFirst ? 'top' : 'bottom']: 0,
        width: '100%',
        height: `calc(${currentVisualsPercent}% - ${currentGap / 2}px)`,
        overflow: 'hidden',
      },
      videoStyle: {
        position: 'absolute',
        left: 0,
        [isVisualsFirst ? 'bottom' : 'top']: 0,
        width: '100%',
        height: `calc(${currentVideoPercent}% - ${currentGap / 2}px)`,
        overflow: 'hidden',
      },
    };
  } else {
    const isVisualsFirst = split.position === 'visuals-first';
    return {
      visualsStyle: {
        position: 'absolute',
        top: 0,
        [isVisualsFirst ? 'left' : 'right']: 0,
        width: `calc(${currentVisualsPercent}% - ${currentGap / 2}px)`,
        height: '100%',
        overflow: 'hidden',
      },
      videoStyle: {
        position: 'absolute',
        top: 0,
        [isVisualsFirst ? 'right' : 'left']: 0,
        width: `calc(${currentVideoPercent}% - ${currentGap / 2}px)`,
        height: '100%',
        overflow: 'hidden',
      },
    };
  }
}

// Compute eased transition progress (ease-out cubic) for enter/exit animations
function getTransitionProgress(
  currentTimeMs: number,
  transitionStartMs: number,
  transitionDurationMs: number,
): number {
  if (transitionDurationMs <= 0) return 1;
  const elapsed = currentTimeMs - transitionStartMs;
  if (elapsed <= 0) return 0;
  if (elapsed >= transitionDurationMs) return 1;
  const t = elapsed / transitionDurationMs;
  return 1 - Math.pow(1 - t, 3); // ease-out cubic
}

// Find the visual item whose time range contains currentTimeMs
function findActiveVisualItem(
  visualItems: TimelineItem[],
  currentTimeMs: number,
): TimelineItem | null {
  for (const item of visualItems) {
    if (currentTimeMs >= item.startMs && currentTimeMs < item.endMs) {
      return item;
    }
  }
  return null;
}

// Find the visual item immediately before the given item (by startMs order)
function findPreviousVisualItem(
  visualItems: TimelineItem[],
  currentItem: TimelineItem,
): TimelineItem | null {
  let prev: TimelineItem | null = null;
  for (const item of visualItems) {
    if (item.endMs <= currentItem.startMs) {
      if (!prev || item.endMs > prev.endMs) prev = item;
    }
  }
  return prev;
}

// Find the visual item immediately after the given item (by startMs order)
function findNextVisualItem(
  visualItems: TimelineItem[],
  currentItem: TimelineItem,
): TimelineItem | null {
  let next: TimelineItem | null = null;
  for (const item of visualItems) {
    if (item.startMs >= currentItem.endMs) {
      if (!next || item.startMs < next.startMs) next = item;
    }
  }
  return next;
}

// Get the effective layout mode for an item ('gap' if null, otherwise its displayMode)
function getEffectiveLayout(item: TimelineItem | null, isSplitMode: boolean): string {
  if (!item) return 'gap';
  const rawDm = (item.data as VisualItemData)?.displayMode;
  // Normalize legacy 'pip' → 'default'
  const dm = (!rawDm || (rawDm as string) === 'pip') ? 'default' : rawDm;
  // In stacked mode, 'default' becomes 'split' for layout comparison purposes
  if (isSplitMode && dm === 'default') return 'split';
  return dm;
}

export function Composition() {
  const fps = useFps();
  const items = useItems();
  const itemIds = useItemIds();
  const videoSettings = useVideoSettings();
  const sourceDimensions = useSourceDimensions();
  const layoutSettings = useLayoutSettings();
  const isAudioProject = useIsAudioProject();
  const showCaptions = useShowCaptions();

  // Get items by type
  const videoItems = itemIds
    .map((id) => items[id])
    .filter((item): item is TimelineItem => item?.type === 'video');

  const captionItems = showCaptions
    ? itemIds.map((id) => items[id]).filter((item): item is TimelineItem => item?.type === 'caption')
    : [];

  const audioItems = itemIds
    .map((id) => items[id])
    .filter((item): item is TimelineItem => item?.type === 'audio');

  const visualItems = itemIds
    .map((id) => items[id])
    .filter((item): item is TimelineItem => item?.type === 'visual');

  // Check if we have visuals (triggers PiP layout for talking head)
  const hasVisuals = visualItems.length > 0;

  const effectiveHasVisuals = hasVisuals;

  // Mute the video only when a separate audio item has a playable source.
  // If the audio item exists but has no src (e.g., enhancement still processing
  // or failed), keep the video unmuted so the user hears the original audio.
  const hasSeparateAudio = audioItems.some((item) => {
    const data = item.data as AudioItemData;
    return !!data.src;
  });

  // Check if any visual scene uses fullscreen display mode — in fullscreen the
  // video layer is hidden, so we need to extract audio separately.
  const hasFullscreenVisuals = visualItems.some((v) => {
    const vd = v.data as VisualItemData;
    return vd.displayMode === 'fullscreen';
  });

  // When we extract video audio as a separate <Audio> element (fullscreen + no
  // separate audio track), tell DynamicLayoutComposition to mute the <Video> so
  // audio doesn't play twice during non-fullscreen scenes.
  const videoAudioExtracted = hasFullscreenVisuals && !hasSeparateAudio;

  // Calculate video transform for crop/pan
  // Ensure we have valid dimensions to avoid NaN
  const hasValidDimensions =
    videoSettings &&
    sourceDimensions &&
    sourceDimensions.width > 0 &&
    sourceDimensions.height > 0 &&
    videoSettings.canvasWidth > 0 &&
    videoSettings.canvasHeight > 0;

  const transform = hasValidDimensions
    ? calculateVideoTransform(
        sourceDimensions.width,
        sourceDimensions.height,
        videoSettings.canvasWidth,
        videoSettings.canvasHeight,
        videoSettings.cropX,
        videoSettings.cropY,
        videoSettings.scale
      )
    : { scale: 1, translateX: 0, translateY: 0 };

  // Determine layout based on mode and whether visuals exist
  const { mode, pip, split } = layoutSettings;

  // Full-screen style for single-content modes
  const fullScreenStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  };

  // For non-audio projects with visuals, delegate to DynamicLayoutComposition
  // which switches compositing mode per-frame based on each item's displayMode.
  // This supports pip and stacked layout modes.
  const useDynamicLayout = !isAudioProject && effectiveHasVisuals;

  // Calculate styles for the STATIC layout path (audio project or no visuals)
  let videoContainerStyle: React.CSSProperties;
  let visualContainerStyle: React.CSSProperties;
  let showVideo = true;
  let showVisuals = effectiveHasVisuals;
  let usePiPMode = false;

  if (useDynamicLayout) {
    // These won't be used — DynamicLayoutComposition handles rendering
    videoContainerStyle = { display: 'none' };
    visualContainerStyle = { display: 'none' };
    showVideo = false;
    showVisuals = false;
  } else if (isAudioProject) {
    // Audio project: no video, visuals fill entire canvas (or black bg)
    showVideo = false;
    videoContainerStyle = { display: 'none' };
    if (effectiveHasVisuals) {
      visualContainerStyle = fullScreenStyle;
      showVisuals = true;
    } else {
      visualContainerStyle = { display: 'none' };
      showVisuals = false;
    }
  } else if (!effectiveHasVisuals) {
    // No visuals: full-screen video
    videoContainerStyle = fullScreenStyle;
    visualContainerStyle = { display: 'none' };
    showVisuals = false;
  } else if (mode === 'stacked') {
    // Stacked mode: visuals top, video bottom
    const styles = buildSplitStyles(split, true /* always horizontal for stacked */);
    videoContainerStyle = styles.videoStyle;
    visualContainerStyle = styles.visualsStyle;
  } else {
    // Fallback: full-screen video (should not reach here due to useDynamicLayout)
    videoContainerStyle = fullScreenStyle;
    visualContainerStyle = { display: 'none' };
    showVisuals = false;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Dynamic layout: per-frame compositing with displayMode switching */}
      {useDynamicLayout && (
        <DynamicLayoutComposition
          fps={fps}
          visualItems={visualItems}
          videoItems={videoItems}
          pip={pip}
          split={split}
          mode={mode}
          canvasWidth={videoSettings?.canvasWidth || 1920}
          canvasHeight={videoSettings?.canvasHeight || 1080}
          transform={transform}
          hasSeparateAudio={hasSeparateAudio || videoAudioExtracted}
          fullScreenStyle={fullScreenStyle}
        />
      )}

      {/* Static visual container (audio project / no dynamic layout) */}
      {showVisuals && (
        <div style={visualContainerStyle}>
          <VisualSequences visualItems={visualItems} fps={fps} />
        </div>
      )}

      {/* Static video container (audio project / no visuals) */}
      {showVideo && (
        <div style={videoContainerStyle}>
          <VideoSequences
            videoItems={videoItems}
            fps={fps}
            hasSeparateAudio={hasSeparateAudio}
            transform={transform}
            useSimpleRender={usePiPMode || mode === 'stacked'}
          />
        </div>
      )}

      {/* Audio layer */}
      {audioItems.map((item) => {
        const data = item.data as AudioItemData;
        if (!data.src) return null;
        const fromFrame = Math.round((item.startMs / 1000) * fps);
        const durationInFrames = Math.max(
          1,
          Math.floor(((item.endMs - item.startMs) / 1000) * fps) - 2,
        );

        return (
          <Sequence
            key={item.id}
            from={fromFrame}
            durationInFrames={durationInFrames}
          >
            <Audio
              src={data.src}
              volume={data.volume}
              onError={(e) => {
                console.warn('Audio playback error (suppressed):', e?.message);
              }}
            />
          </Sequence>
        );
      })}

      {/* Video-as-audio: when no separate audio exists and some scenes use fullscreen
          display mode, the video layer inside DynamicLayoutComposition is hidden — losing
          the embedded audio. Render a dedicated Audio element from the video source here
          (always mounted), and tell DynamicLayoutComposition to mute the video to avoid
          doubling audio during non-fullscreen scenes. */}
      {hasFullscreenVisuals && !hasSeparateAudio && videoItems.map((item) => {
        const data = item.data as VideoItemData;
        if (!data.src) return null;
        const fromFrame = Math.round((item.startMs / 1000) * fps);
        const durationInFrames = Math.max(1, Math.floor(((item.endMs - item.startMs) / 1000) * fps) - 2);
        const trimStartFrame = item.trim ? Math.round((item.trim.startMs / 1000) * fps) : undefined;
        return (
          <Sequence key={`vid-audio-${item.id}`} from={fromFrame} durationInFrames={durationInFrames}>
            <Audio
              src={data.src}
              volume={data.volume}
              playbackRate={data.playbackRate || 1}
              startFrom={trimStartFrame}
              onError={(e) => {
                console.warn('Video-audio playback error (suppressed):', e?.message);
              }}
            />
          </Sequence>
        );
      })}

      {/* Captions layer */}
      {captionItems.map((item) => {
        const fromFrame = Math.round((item.startMs / 1000) * fps);
        const durationInFrames = Math.round(((item.endMs - item.startMs) / 1000) * fps);

        return (
          <Sequence
            key={item.id}
            from={fromFrame}
            durationInFrames={durationInFrames}
          >
            <CaptionRenderer
              item={item}
              fps={fps}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Extracted sub-components for visual and video sequences
// ---------------------------------------------------------------------------

/** Renders grouped visual item Sequences (shared by static and dynamic paths).
 *  Visuals are generated at full canvas dimensions with per-scene effective areas.
 *  The container clips via overflow:hidden — no contain-fit scaling needed. */
function VisualSequences({
  visualItems,
  fps,
}: {
  visualItems: TimelineItem[];
  fps: number;
}) {
  // Group visual items by compositionId so each composition renders
  // once across its full time span. The generated Remotion composition
  // uses useCurrentFrame() internally to switch between scenes, so it
  // must see the correct frame offset — not restart from 0 per item.
  const groups = new Map<string, {
    bundleUrl: string;
    compositionId: string;
    videoUrl: string | undefined;
    minStartMs: number;
    maxEndMs: number;
    width: number;
    height: number;
    fps: number;
  }>();

  for (const item of visualItems) {
    const data = item.data as VisualItemData;
    const key = data.compositionId;
    const existing = groups.get(key);
    if (existing) {
      existing.minStartMs = Math.min(existing.minStartMs, item.startMs);
      existing.maxEndMs = Math.max(existing.maxEndMs, item.endMs);
      if (data.videoUrl && !existing.videoUrl) {
        existing.videoUrl = data.videoUrl;
      }
    } else {
      groups.set(key, {
        bundleUrl: data.bundleUrl,
        compositionId: data.compositionId,
        videoUrl: data.videoUrl,
        minStartMs: item.startMs,
        maxEndMs: item.endMs,
        width: data.width,
        height: data.height,
        fps: data.fps,
      });
    }
  }

  return (
    <>
      {Array.from(groups.entries()).map(([key, group]) => {
        const fromFrame = Math.round((group.minStartMs / 1000) * fps);
        const durationInFrames = Math.round(((group.maxEndMs - group.minStartMs) / 1000) * fps);

        const videoSrc = group.videoUrl
          ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${group.videoUrl}`
          : null;

        return (
          <Sequence
            key={key}
            from={fromFrame}
            durationInFrames={durationInFrames}
          >
            <AbsoluteFill>
              {videoSrc ? (
                <Video
                  src={videoSrc}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  onError={(e) => {
                    console.warn('Visual video playback error:', e?.message);
                  }}
                />
              ) : (
                <DynamicVisualLoader
                  bundleUrl={group.bundleUrl}
                  compositionId={group.compositionId}
                />
              )}
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </>
  );
}

/** Renders video item Sequences with crop/pan or cover transform */
function VideoSequences({
  videoItems,
  fps,
  hasSeparateAudio,
  transform,
  useSimpleRender,
}: {
  videoItems: TimelineItem[];
  fps: number;
  hasSeparateAudio: boolean;
  transform: { scale: number; translateX: number; translateY: number };
  useSimpleRender: boolean;
}) {
  return (
    <>
      {videoItems.map((item) => {
        const data = item.data as VideoItemData;
        if (!data.src) return null;
        const fromFrame = Math.round((item.startMs / 1000) * fps);
        const durationInFrames = Math.max(
          1,
          Math.floor(((item.endMs - item.startMs) / 1000) * fps) - 2,
        );

        const trimStartFrame = item.trim
          ? Math.round((item.trim.startMs / 1000) * fps)
          : undefined;
        const trimEndFrame = item.trim
          ? Math.max(
              (trimStartFrame ?? 0) + 1,
              Math.floor((item.trim.endMs / 1000) * fps) - 2,
            )
          : undefined;

        return (
          <Sequence
            key={item.id}
            from={fromFrame}
            durationInFrames={durationInFrames}
          >
            <AbsoluteFill style={{ overflow: 'hidden' }}>
              {useSimpleRender ? (
                <Video
                  src={data.src}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  muted={hasSeparateAudio}
                  volume={hasSeparateAudio ? undefined : data.volume}
                  playbackRate={data.playbackRate || 1}
                  startFrom={trimStartFrame}
                  endAt={trimEndFrame}
                  onError={(e) => {
                    console.warn('Video playback error (suppressed):', e?.message);
                  }}
                />
              ) : (
                <div
                  style={{
                    position: 'absolute',
                    width: data.width,
                    height: data.height,
                    transform: `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale})`,
                    transformOrigin: 'top left',
                  }}
                >
                  <Video
                    src={data.src}
                    style={{
                      width: data.width,
                      height: data.height,
                    }}
                    muted={hasSeparateAudio}
                    volume={hasSeparateAudio ? undefined : data.volume}
                    playbackRate={data.playbackRate || 1}
                    startFrom={trimStartFrame}
                    endAt={trimEndFrame}
                    onError={(e) => {
                      console.warn('Video playback error (suppressed):', e?.message);
                    }}
                  />
                </div>
              )}
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// DynamicLayoutComposition — per-frame layout switching
// ---------------------------------------------------------------------------

interface DynamicLayoutProps {
  fps: number;
  visualItems: TimelineItem[];
  videoItems: TimelineItem[];
  pip: PiPSettings;
  split: SplitSettings;
  mode: LayoutMode;
  canvasWidth: number;
  canvasHeight: number;
  transform: { scale: number; translateX: number; translateY: number };
  hasSeparateAudio: boolean;
  fullScreenStyle: React.CSSProperties;
}

/**
 * Renders the visual + video layers with per-frame compositing.
 * On each frame it looks up the active visual item and picks the
 * compositing mode from `item.data.displayMode`:
 *   - gap (no item)   → speaker video fullscreen
 *   - 'default'       → pip mode: visual fullscreen + video as PiP bubble
 *                        stacked mode: side-by-side layout (top/bottom)
 *   - 'fullscreen'    → visual fullscreen, video hidden (all layouts)
 *   - 'overlay'       → video fullscreen + visual on top at 0.7 opacity (all layouts)
 *
 * Enter/exit transitions (fade, zoom) are applied at item boundaries.
 */
function DynamicLayoutComposition({
  fps,
  visualItems,
  videoItems,
  pip,
  split,
  mode,
  canvasWidth,
  canvasHeight,
  transform,
  hasSeparateAudio,
  fullScreenStyle,
}: DynamicLayoutProps) {
  const frame = useCurrentFrame();
  const currentTimeMs = (frame / fps) * 1000;

  // Determine the active visual item at the current time
  const activeItem = findActiveVisualItem(visualItems, currentTimeMs);
  const activeData = activeItem ? (activeItem.data as VisualItemData) : null;
  const rawDisplayMode = activeData?.displayMode;
  // Normalize legacy 'pip' → 'default'
  const displayMode = (!rawDisplayMode || (rawDisplayMode as string) === 'pip') ? 'default' : rawDisplayMode;

  // Determine previous/next items and whether the layout actually changes
  const isSplitMode = mode === 'stacked';
  const currentLayout = getEffectiveLayout(activeItem, isSplitMode);
  const prevItem = activeItem ? findPreviousVisualItem(visualItems, activeItem) : null;
  const prevLayout = activeItem ? getEffectiveLayout(
    // If there's a gap between prev and current, the previous layout is 'gap'
    prevItem && prevItem.endMs >= activeItem.startMs - 50 ? prevItem : null,
    isSplitMode,
  ) : 'gap';

  const nextItem = activeItem ? findNextVisualItem(visualItems, activeItem) : null;
  const nextLayout = activeItem ? getEffectiveLayout(
    nextItem && nextItem.startMs <= activeItem.endMs + 50 ? nextItem : null,
    isSplitMode,
  ) : 'gap';

  const layoutChangesOnEnter = currentLayout !== prevLayout;
  const layoutChangesOnExit = currentLayout !== nextLayout;

  // Calculate transition opacity/scale for the active item
  let transitionOpacity = 1;
  let transitionScale = 1;
  // Layout progress: 0 = previous layout, 1 = current layout (for animating split/pip positions)
  // Only used when layout actually changes between scenes
  let layoutEnterProgress = 1;
  let layoutExitProgress = 0;

  // Use explicit transition if set, otherwise default to a 300ms fade in/out
  const DEFAULT_FADE_TRANSITION = {
    enter: { type: 'fade' as const, durationMs: 300 },
    exit: { type: 'fade' as const, durationMs: 300 },
  };
  const effectiveTransition = activeData?.transition ?? DEFAULT_FADE_TRANSITION;

  if (activeItem) {
    const itemDurationMs = activeItem.endMs - activeItem.startMs;
    const { enter, exit } = effectiveTransition;

    // Clamp transition durations to at most half the item duration
    const maxDuration = itemDurationMs / 2;
    const enterDuration = Math.min(enter.durationMs, maxDuration);
    const exitDuration = Math.min(exit.durationMs, maxDuration);

    // Enter transition
    if (enter.type !== 'cut' && enterDuration > 0) {
      const enterProgress = getTransitionProgress(
        currentTimeMs,
        activeItem.startMs,
        enterDuration,
      );
      // Only animate layout if the display mode actually changed
      if (layoutChangesOnEnter) {
        layoutEnterProgress = enterProgress;
      }

      if (enter.type === 'fade') {
        transitionOpacity = Math.min(transitionOpacity, enterProgress);
      } else if (enter.type === 'zoom-in') {
        // Scale from 1.3 down to 1.0
        transitionOpacity = Math.min(transitionOpacity, enterProgress);
        transitionScale *= 1.3 - 0.3 * enterProgress;
      } else if (enter.type === 'zoom-out') {
        // Scale from 0.7 up to 1.0
        transitionOpacity = Math.min(transitionOpacity, enterProgress);
        transitionScale *= 0.7 + 0.3 * enterProgress;
      }
    }

    // Exit transition
    const exitStartMs = activeItem.endMs - exitDuration;
    if (exit.type !== 'cut' && exitDuration > 0 && currentTimeMs >= exitStartMs) {
      const exitProgress = getTransitionProgress(
        currentTimeMs,
        exitStartMs,
        exitDuration,
      );
      // Only animate layout if the next scene has a different layout
      if (layoutChangesOnExit) {
        layoutExitProgress = exitProgress;
      }

      if (exit.type === 'fade') {
        transitionOpacity = Math.min(transitionOpacity, 1 - exitProgress);
      } else if (exit.type === 'zoom-in') {
        // Scale from 1.0 to 1.3
        transitionOpacity = Math.min(transitionOpacity, 1 - exitProgress);
        transitionScale *= 1.0 + 0.3 * exitProgress;
      } else if (exit.type === 'zoom-out') {
        // Scale from 1.0 to 0.7
        transitionOpacity = Math.min(transitionOpacity, 1 - exitProgress);
        transitionScale *= 1.0 - 0.3 * exitProgress;
      }
    }
  }

  // Build container styles based on the current display mode
  const isGap = !activeItem;
  const showVideoLayer = isGap || displayMode === 'default' || displayMode === 'overlay';
  const showVisualLayer = !isGap;
  const hideVideoCompletely = !isGap && displayMode === 'fullscreen';

  // For stacked mode, displayMode 'default' means "use the stacked layout"
  const useSplitLayout = isSplitMode && displayMode === 'default' && !isGap;

  // Video layer style
  let videoLayerStyle: React.CSSProperties;
  let visualLayerStyle: React.CSSProperties;

  if (useSplitLayout) {
    // Stacked layout: video and visuals top/bottom
    // Animate layout from fullscreen → stacked during enter, stacked → fullscreen during exit
    const layoutProgress = Math.min(layoutEnterProgress, 1 - layoutExitProgress);
    const styles = buildAnimatedSplitStyles(split, true /* always horizontal for stacked */, layoutProgress);
    videoLayerStyle = styles.videoStyle;
    visualLayerStyle = {
      ...styles.visualsStyle,
      opacity: transitionOpacity,
      transform: transitionScale !== 1 ? `scale(${transitionScale})` : undefined,
      transformOrigin: 'center center',
    };
  } else if (isGap || displayMode === 'overlay') {
    // Fullscreen video (speaker-only gap or overlay background)
    videoLayerStyle = fullScreenStyle;
    visualLayerStyle = {
      ...fullScreenStyle,
      opacity: transitionOpacity,
      transform: transitionScale !== 1 ? `scale(${transitionScale})` : undefined,
      transformOrigin: 'center center',
    };
  } else if (displayMode === 'default') {
    // Video as PiP bubble on top of visual (PiP layout mode)
    videoLayerStyle = buildPiPStyle(pip);
    visualLayerStyle = {
      ...fullScreenStyle,
      opacity: transitionOpacity,
      transform: transitionScale !== 1 ? `scale(${transitionScale})` : undefined,
      transformOrigin: 'center center',
    };
  } else {
    // displayMode === 'fullscreen' — video hidden
    videoLayerStyle = { display: 'none' };
    visualLayerStyle = {
      ...fullScreenStyle,
      opacity: transitionOpacity,
      transform: transitionScale !== 1 ? `scale(${transitionScale})` : undefined,
      transformOrigin: 'center center',
    };
  }

  // For overlay mode, visuals sit on top of video with real alpha compositing.
  // The generated index.tsx conditionally removes Background during overlay frames,
  // so the composition is genuinely transparent. FFmpeg export still uses screen blend
  // for H.264 compositing (render.ts). The face mask below is a safety net against
  // AI-generated scenes that place elements over the speaker's face.
  const overlayOpacity = activeData?.overlayOpacity ?? 0.85;
  const speakerBbox = activeData?.speakerBbox;
  // Build a CSS mask that fades out the overlay over the speaker's face area.
  // Uses a radial gradient: transparent at the face center, opaque everywhere else.
  // This is a safety net — even if the AI places elements on the face, they'll be masked.
  let faceMask: string | undefined;
  if (speakerBbox && displayMode === 'overlay') {
    const cx = (speakerBbox.x + speakerBbox.w / 2) * 100;
    const cy = (speakerBbox.y + speakerBbox.h / 2) * 100;
    // Ellipse radii: face bbox size + 10% buffer for breathing room
    const rx = (speakerBbox.w / 2 + 0.05) * 100;
    const ry = (speakerBbox.h / 2 + 0.05) * 100;
    faceMask = `radial-gradient(ellipse ${rx}% ${ry}% at ${cx}% ${cy}%, transparent 60%, black 100%)`;
  }
  const overlayVisualStyle: React.CSSProperties = {
    ...fullScreenStyle,
    opacity: transitionOpacity * overlayOpacity,
    transform: transitionScale !== 1 ? `scale(${transitionScale})` : undefined,
    transformOrigin: 'center center',
    zIndex: 5,
    // No blend mode — overlay compositions use real alpha transparency.
    // index.tsx conditionally removes Background during overlay frames.
    // FFmpeg export still uses blend=all_mode=screen for H.264 compositing.
    ...(faceMask ? {
      WebkitMaskImage: faceMask,
      maskImage: faceMask,
    } : {}),
  };

  // Determine whether the video should use simple (cover) or crop/pan rendering
  // PiP mode uses simple render (objectFit: cover); fullscreen/overlay/gap use crop/pan
  const { width: compWidth, height: compHeight } = useVideoConfig();

  // For stacked mode, compute a cover transform for the video container so the
  // speaker video fills the bottom half without gaps. We use the transform-based
  // rendering path (same as crop/pan) since objectFit: cover is unreliable inside
  // Remotion's flex-based AbsoluteFill containers.
  let videoUseSimpleRender: boolean;
  let videoTransform = transform;

  if (useSplitLayout && videoItems.length > 0) {
    // Stacked mode: use transform-based cover for the stacked container
    videoUseSimpleRender = false;
    const containerW = compWidth;
    const containerH = Math.round(compHeight * (100 - split.ratio) / 100);
    const firstVideoData = videoItems[0].data as VideoItemData;
    if (firstVideoData.width > 0 && firstVideoData.height > 0) {
      videoTransform = calculateCoverTransform(
        firstVideoData.width, firstVideoData.height,
        containerW, containerH,
      );
    }
  } else if (mode === 'pip' && displayMode === 'default' && !isGap) {
    // PiP mode: use transform-based rendering with PiP-specific crop settings
    videoUseSimpleRender = false;
    const pipCrop = pip.crop || { cropX: 50, cropY: 50, zoom: 1.0 };
    // Get PiP container dimensions for transform calculation
    const pipSizePercent = pip.size === 'custom' ? pip.customSize : PIP_SIZE_MAP[pip.size];
    const containerW = Math.round(compWidth * (pipSizePercent / 100));
    const containerH = containerW; // PiP is square aspect ratio
    const firstVideoData = videoItems.length > 0 ? videoItems[0].data as VideoItemData : null;
    if (firstVideoData && firstVideoData.width > 0 && firstVideoData.height > 0) {
      videoTransform = calculateVideoTransform(
        firstVideoData.width,
        firstVideoData.height,
        containerW,
        containerH,
        pipCrop.cropX,
        pipCrop.cropY,
        pipCrop.zoom,
      );
    }
  } else {
    videoUseSimpleRender = !isGap && displayMode === 'default';
  }

  return (
    <>
      {/* Visual layer (behind video for pip/split) */}
      {displayMode !== 'overlay' && showVisualLayer && (
        <div style={visualLayerStyle}>
          <VisualSequences visualItems={visualItems} fps={fps} />
        </div>
      )}

      {/* Video layer */}
      {showVideoLayer && !hideVideoCompletely && (
        <div
          style={{ ...videoLayerStyle, zIndex: displayMode === 'overlay' ? 1 : undefined }}
          {...(mode === 'pip' && displayMode === 'default' && !isGap ? { 'data-pip-overlay': true } : {})}
        >
          <VideoSequences
            videoItems={videoItems}
            fps={fps}
            hasSeparateAudio={hasSeparateAudio}
            transform={videoTransform}
            useSimpleRender={videoUseSimpleRender}
          />
        </div>
      )}


      {/* Overlay mode: visual on top of video with real alpha compositing */}
      {displayMode === 'overlay' && showVisualLayer && (
        <div style={overlayVisualStyle}>
          <VisualSequences visualItems={visualItems} fps={fps} />
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Dynamic Hierarchy — word classification imported from @viona/shared
// getDynamicHierarchyOverrides uses platform-specific scale values
// ---------------------------------------------------------------------------

function getDynamicHierarchyOverrides(
  wordText: string,
  existingOverrides?: WordStyleOverrides
): WordStyleOverrides {
  const tier = classifyWordTier(wordText);
  const computed: WordStyleOverrides = {};

  if (tier === 'power') {
    computed.scale = 1.6;
    computed.fontWeight = 900;
    computed.color = '#ffffff';
    computed.activeColor = '#FFD400';
    computed.textTransform = 'uppercase';
  } else if (tier === 'filler') {
    computed.scale = 1.0;
    computed.fontWeight = 500;
    computed.color = 'rgba(255,255,255,0.7)';
    computed.activeColor = 'rgba(255,255,255,0.85)';
  } else {
    // medium — normal size, standard weight
    computed.scale = 1.0;
    computed.fontWeight = 700;
  }

  // Merge: existing manual overrides take priority over computed
  return { ...computed, ...existingOverrides };
}

interface CaptionRendererProps {
  item: TimelineItem;
  fps: number;
}

function CaptionRenderer({ item, fps }: CaptionRendererProps) {
  // useCurrentFrame() inside a Sequence gives us the frame relative to that sequence
  const relativeFrame = useCurrentFrame();
  const { width: canvasWidth } = useVideoConfig();
  const data = item.data as CaptionItemData;
  const style = data.style;

  // Responsive font scale: preset font sizes are authored for 1080px wide canvas.
  // Scale proportionally so subtitles fit any aspect ratio (9:16=1080, 16:9=1920, etc.)
  const fontScale = canvasWidth / 1080;

  // Calculate relative time within caption (relativeFrame is already relative to sequence start)
  const relativeTimeMs = (relativeFrame / fps) * 1000;

  // Render caption with word highlighting
  const words = data.words;
  const hasWordTimings = words.length > 0;

  // Find active word
  const activeWordIndex = words.findIndex(
    (word) => relativeTimeMs >= word.startMs && relativeTimeMs < word.endMs
  );

  // Resolve animation config (handle legacy strings via migrateAnimation)
  const animConfig: AnimationConfig = isAnimationConfig(style.animation)
    ? style.animation
    : migrateAnimation(style.animation as string);

  // Position based on style - use new position system
  const position = resolvePosition(style.position);
  const positionStyles = calculatePositionStyles(position, style.lineHeight ?? 1.4);

  // Resolve effects (handles both legacy textShadow and new effects object)
  const effects: CaptionEffects = style.effects ?? migrateTextShadow(style.textShadow);
  const effectsStyles = effectsToCss(effects);

  // Resolve background padding and radius from style
  const bgPadding = style.backgroundPadding ?? { x: 4, y: 2 };
  const bgRadius = style.backgroundRadius ?? 0;

  // Scaled base font size — adapts to canvas width
  const baseFontSize = style.fontSize * fontScale;

  // Helper: build padding + borderRadius only when a background is visible
  const getBoxStyles = (bg: string | undefined): React.CSSProperties => {
    const hasBg = bg && bg !== 'transparent';
    return {
      padding: hasBg ? `${bgPadding.y}px ${bgPadding.x}px` : '0 4px',
      borderRadius: hasBg && bgRadius ? `${bgRadius}px` : undefined,
    };
  };

  // Build common typography styles
  const getTypographyStyles = (): React.CSSProperties => ({
    opacity: style.opacity ?? 1,
    letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined,
    textTransform: style.textTransform ?? 'none',
    // Use paint-order to draw stroke behind fill for cleaner rendering
    WebkitTextStroke: style.stroke
      ? `${style.stroke.width}px ${style.stroke.color}`
      : undefined,
    paintOrder: style.stroke ? 'stroke fill' : undefined,
    ...effectsStyles,
  });

  // Word-by-word mode: only show active word
  if (style.displayMode === 'word-by-word') {
    if (activeWordIndex < 0 || !hasWordTimings) return null;
    const activeWord = words[activeWordIndex];
    const overrides = style.presetId === 'dynamic-hierarchy'
      ? getDynamicHierarchyOverrides(activeWord.text, activeWord.styleOverrides)
      : activeWord.styleOverrides;

    // Resolve animation for the active word
    const elapsedMs = relativeTimeMs - activeWord.startMs;
    const wordDurationMs = activeWord.endMs - activeWord.startMs;
    const { style: animStyle } = resolveAnimation(animConfig, {
      elapsedMs: Math.max(0, elapsedMs),
      wordDurationMs,
      isActive: true,
      hasAppeared: false,
      isFuture: false,
    });

    const activeBg = overrides?.emphasisBg || style.activeBackgroundColor || 'transparent';
    return (
      <div style={positionStyles} data-caption-overlay>
        <span
          style={{
            fontFamily: overrides?.fontFamily || style.fontFamily,
            fontSize: (overrides?.scale || 1) * (overrides?.fontSize || baseFontSize),
            fontWeight: overrides?.fontWeight || style.fontWeight,
            color: overrides?.activeColor || overrides?.color || style.activeColor,
            backgroundColor: activeBg,
            ...getBoxStyles(activeBg),
            display: 'inline-block',
            whiteSpace: 'nowrap',
            ...getTypographyStyles(),
            ...(overrides?.letterSpacing != null ? { letterSpacing: `${overrides.letterSpacing}px` } : {}),
            ...(overrides?.textTransform ? { textTransform: overrides.textTransform } : {}),
            ...animStyle,
          }}
        >
          {activeWord.text}
        </span>
      </div>
    );
  }

  // Karaoke mode: progressive fill with V2 animation engine
  if (style.displayMode === 'karaoke') {
    const isDynHierarchy = style.presetId === 'dynamic-hierarchy';
    const karaokePhraseSize = style.wordsPerPhrase || 5;
    let karaokeLastAppeared = -1;
    for (let w = words.length - 1; w >= 0; w--) {
      if (relativeTimeMs >= words[w].startMs) { karaokeLastAppeared = w; break; }
    }
    const karaokeEffIdx = karaokeLastAppeared >= 0 ? karaokeLastAppeared : 0;
    const karaokeGroupIdx = Math.floor(karaokeEffIdx / karaokePhraseSize);
    const karaokeStart = karaokeGroupIdx * karaokePhraseSize;
    const karaokeEnd = Math.min(karaokeStart + karaokePhraseSize, words.length);
    const karaokeVisible = words.slice(karaokeStart, karaokeEnd);

    return (
      <div style={positionStyles} data-caption-overlay>
        {karaokeVisible.map((word, i) => {
          const index = karaokeStart + i;
          const isActive = index === activeWordIndex;
          const hasAppeared = relativeTimeMs >= word.startMs;
          const overrides = isDynHierarchy
            ? getDynamicHierarchyOverrides(word.text, word.styleOverrides)
            : word.styleOverrides;

          // Resolve animation for this word
          const elapsedMs = relativeTimeMs - word.startMs;
          const wordDurationMs = word.endMs - word.startMs;
          const { style: animStyle } = resolveAnimation(animConfig, {
            elapsedMs: Math.max(0, elapsedMs),
            wordDurationMs,
            isActive,
            hasAppeared: hasAppeared && !isActive,
            isFuture: !hasAppeared,
          });

          // Progressive fill calculation
          let fillPercent = 0;
          if (hasAppeared && !isActive) {
            fillPercent = 100;
          } else if (isActive) {
            const elapsed = relativeTimeMs - word.startMs;
            fillPercent = Math.min((elapsed / wordDurationMs) * 100, 100);
          }

          const wordBg = isActive
            ? style.activeBackgroundColor || 'transparent'
            : style.backgroundColor || 'transparent';
          const hasBg = wordBg && wordBg !== 'transparent';
          return (
            <span
              key={index}
              style={{
                fontFamily: overrides?.fontFamily || style.fontFamily,
                fontSize: (overrides?.scale || 1) * (overrides?.fontSize || baseFontSize),
                fontWeight: overrides?.fontWeight || style.fontWeight,
                ...getBoxStyles(wordBg),
                display: 'inline-block',
                whiteSpace: 'nowrap',
                ...(hasBg
                  ? {
                      // With background: use solid bg color, normal text color via gradient
                      backgroundColor: wordBg,
                      backgroundImage: hasAppeared
                        ? `linear-gradient(90deg, ${overrides?.activeColor || overrides?.color || style.activeColor} ${fillPercent}%, ${style.color} ${fillPercent}%)`
                        : `linear-gradient(90deg, ${style.color}, ${style.color})`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }
                  : {
                      // No background: gradient fill on text
                      backgroundImage: hasAppeared
                        ? `linear-gradient(90deg, ${overrides?.activeColor || overrides?.color || style.activeColor} ${fillPercent}%, ${style.color} ${fillPercent}%)`
                        : `linear-gradient(90deg, ${style.color}, ${style.color})`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }),
                ...getTypographyStyles(),
                ...(overrides?.letterSpacing != null ? { letterSpacing: `${overrides.letterSpacing}px` } : {}),
                ...(overrides?.textTransform ? { textTransform: overrides.textTransform } : {}),
                ...animStyle,
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    );
  }

  // Default phrase mode: show a window of wordsPerPhrase words, highlight active via V2 animation engine
  const isDynamicHierarchy = style.presetId === 'dynamic-hierarchy';
  const phraseSize = style.wordsPerPhrase || 5;

  // Use the last word that has started playing (not activeWordIndex which goes -1 in gaps).
  let lastAppearedIdx = -1;
  for (let w = words.length - 1; w >= 0; w--) {
    if (relativeTimeMs >= words[w].startMs) { lastAppearedIdx = w; break; }
  }
  const effectiveIdx = lastAppearedIdx >= 0 ? lastAppearedIdx : 0;

  // Helper: render a single word span
  const renderWord = (word: CaptionWord, index: number) => {
    const isActive = index === activeWordIndex;
    const hasAppeared = relativeTimeMs >= word.startMs;
    const overrides = isDynamicHierarchy
      ? getDynamicHierarchyOverrides(word.text, word.styleOverrides)
      : word.styleOverrides;

    const elapsedMs = relativeTimeMs - word.startMs;
    const wordDurationMs = word.endMs - word.startMs;
    const { style: animStyle } = resolveAnimation(animConfig, {
      elapsedMs: Math.max(0, elapsedMs),
      wordDurationMs,
      isActive,
      hasAppeared: hasAppeared && !isActive,
      isFuture: !hasAppeared,
    });

    const wordBg = overrides?.emphasisBg
      || (isActive
        ? style.activeBackgroundColor || 'transparent'
        : style.backgroundColor || 'transparent');
    return (
      <span
        key={index}
        style={{
          fontFamily: overrides?.fontFamily || style.fontFamily,
          fontSize: (overrides?.scale || 1) * (overrides?.fontSize || baseFontSize),
          fontWeight: overrides?.fontWeight || style.fontWeight,
          color: isActive
            ? (overrides?.activeColor || overrides?.color || style.activeColor)
            : (overrides?.color || style.color),
          backgroundColor: wordBg,
          ...getBoxStyles(wordBg),
          display: 'inline-block',
          whiteSpace: 'nowrap',
          ...getTypographyStyles(),
          ...(overrides?.letterSpacing != null ? { letterSpacing: `${overrides.letterSpacing}px` } : {}),
          ...(overrides?.textTransform ? { textTransform: overrides.textTransform } : {}),
          ...animStyle,
        }}
      >
        {word.text}
      </span>
    );
  };

  // --- Dynamic hierarchy: emotional line breaking ---
  if (isDynamicHierarchy && hasWordTimings) {
    const segments = computeEmotionalSegments(words);
    const activeSeg = findActiveSegment(segments, effectiveIdx);

    if (!activeSeg) return null;

    return (
      <div style={{
        ...positionStyles,
        width: '60%',
        maxWidth: '60%',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: (positionStyles as Record<string, unknown>).textAlign === 'left' ? 'flex-start'
          : (positionStyles as Record<string, unknown>).textAlign === 'right' ? 'flex-end'
          : 'center',
        gap: '2px',
        overflow: 'hidden',
      }} data-caption-overlay>
        {activeSeg.lines.map((lineIndices, lineIdx) => (
          <div
            key={lineIdx}
            style={{
              display: 'flex',
              flexWrap: 'nowrap',
              justifyContent: 'center',
              alignItems: 'baseline',
              gap: '0 6px',
              maxWidth: '100%',
            }}
          >
            {lineIndices.map((wordIdx) => renderWord(words[wordIdx], wordIdx))}
          </div>
        ))}
      </div>
    );
  }

  // --- Standard phrase mode: fixed-size word window ---
  const phraseGroupIndex = Math.floor(effectiveIdx / phraseSize);
  const phraseStart = phraseGroupIndex * phraseSize;
  const phraseEnd = Math.min(phraseStart + phraseSize, words.length);
  const visibleWords = hasWordTimings ? words.slice(phraseStart, phraseEnd) : [];

  return (
    <div style={positionStyles} data-caption-overlay>
      {hasWordTimings ? (
        visibleWords.map((word, i) => renderWord(word, phraseStart + i))
      ) : (
        <span
          style={{
            fontFamily: style.fontFamily,
            fontSize: baseFontSize,
            fontWeight: style.fontWeight,
            color: style.color,
            backgroundColor: style.backgroundColor || 'transparent',
            ...getBoxStyles(style.backgroundColor),
            ...getTypographyStyles(),
          }}
        >
          {data.text}
        </span>
      )}
    </div>
  );
}
