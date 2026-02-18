/**
 * Composition Component
 * Remotion composition that renders video and captions
 */

'use client';

import React from 'react';
import { AbsoluteFill, Sequence, Video, Audio, useCurrentFrame } from 'remotion';
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
  PIP_SIZE_MAP,
  CaptionPosition,
  CaptionEffects,
  DEFAULT_CAPTION_POSITION,
  migrateTextShadow,
} from '../store/types';
import { effectsToCss } from '@/lib/effects-utils';
import { DynamicVisualLoader } from './DynamicVisualLoader';

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

  // Base position from anchor
  const baseStyles: React.CSSProperties = {
    position: 'absolute',
    left: `${50 + offsetX}%`,
    width: '90%',
    maxWidth: '90%',
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

  // For pip mode with visuals (non-audio), delegate to DynamicLayoutComposition
  // which switches compositing mode per-frame based on each item's displayMode.
  // Split modes and audio projects keep the original static layout path.
  const useDynamicLayout =
    !isAudioProject &&
    effectiveHasVisuals &&
    (mode === 'pip' || (mode !== 'split-horizontal' && mode !== 'split-vertical'));

  // Calculate styles for the STATIC layout path (audio, split, no visuals)
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
  } else if (mode === 'split-horizontal' || mode === 'split-vertical') {
    // Split mode: both side by side
    const isHorizontal = mode === 'split-horizontal';
    const styles = buildSplitStyles(split, isHorizontal);
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
      {/* Dynamic layout: per-frame compositing for pip mode */}
      {useDynamicLayout && (
        <DynamicLayoutComposition
          fps={fps}
          visualItems={visualItems}
          videoItems={videoItems}
          pip={pip}
          transform={transform}
          hasSeparateAudio={hasSeparateAudio}
          fullScreenStyle={fullScreenStyle}
        />
      )}

      {/* Static visual container (audio project / split modes) */}
      {showVisuals && (
        <div style={visualContainerStyle}>
          <VisualSequences visualItems={visualItems} fps={fps} />
        </div>
      )}

      {/* Static video container (split modes / no visuals) */}
      {showVideo && (
        <div style={videoContainerStyle}>
          <VideoSequences
            videoItems={videoItems}
            fps={fps}
            hasSeparateAudio={hasSeparateAudio}
            transform={transform}
            useSimpleRender={usePiPMode || mode === 'split-horizontal' || mode === 'split-vertical'}
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

/** Renders grouped visual item Sequences (shared by static and dynamic paths) */
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

/** Renders video item Sequences with crop/pan or simple cover mode */
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
  transform: { scale: number; translateX: number; translateY: number };
  hasSeparateAudio: boolean;
  fullScreenStyle: React.CSSProperties;
}

/**
 * Renders the visual + video layers with per-frame compositing.
 * On each frame it looks up the active visual item and picks the
 * compositing mode from `item.data.displayMode`:
 *   - gap (no item)   → speaker video fullscreen
 *   - 'pip'           → visual fullscreen + video as PiP bubble
 *   - 'fullscreen'    → visual fullscreen, video hidden
 *   - 'overlay'       → video fullscreen + visual on top at 0.7 opacity
 *
 * Enter/exit transitions (fade, zoom) are applied at item boundaries.
 */
function DynamicLayoutComposition({
  fps,
  visualItems,
  videoItems,
  pip,
  transform,
  hasSeparateAudio,
  fullScreenStyle,
}: DynamicLayoutProps) {
  const frame = useCurrentFrame();
  const currentTimeMs = (frame / fps) * 1000;

  // Determine the active visual item at the current time
  const activeItem = findActiveVisualItem(visualItems, currentTimeMs);
  const activeData = activeItem ? (activeItem.data as VisualItemData) : null;
  const displayMode = activeData?.displayMode ?? 'pip';

  // Calculate transition opacity/scale for the active item
  let transitionOpacity = 1;
  let transitionScale = 1;

  if (activeItem && activeData?.transition) {
    const itemDurationMs = activeItem.endMs - activeItem.startMs;
    const { enter, exit } = activeData.transition;

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
  const showVideoLayer = isGap || displayMode === 'pip' || displayMode === 'overlay';
  const showVisualLayer = !isGap;
  const hideVideoCompletely = !isGap && displayMode === 'fullscreen';

  // Video layer style
  let videoLayerStyle: React.CSSProperties;
  if (isGap || displayMode === 'overlay') {
    // Fullscreen video (speaker-only gap or overlay background)
    videoLayerStyle = fullScreenStyle;
  } else if (displayMode === 'pip') {
    // Video as PiP bubble on top of visual
    videoLayerStyle = buildPiPStyle(pip);
  } else {
    // displayMode === 'fullscreen' — video hidden
    videoLayerStyle = { display: 'none' };
  }

  // Visual layer style — always fullscreen when visible, but with transition effects
  const visualLayerStyle: React.CSSProperties = {
    ...fullScreenStyle,
    opacity: transitionOpacity,
    transform: transitionScale !== 1 ? `scale(${transitionScale})` : undefined,
    transformOrigin: 'center center',
  };

  // For overlay mode, visuals sit on top of video at reduced opacity
  const overlayVisualStyle: React.CSSProperties = {
    ...fullScreenStyle,
    opacity: 0.7 * transitionOpacity,
    transform: transitionScale !== 1 ? `scale(${transitionScale})` : undefined,
    transformOrigin: 'center center',
    zIndex: 5,
  };

  // Determine whether the video should use simple (cover) or crop/pan rendering
  // In dynamic mode, PiP uses simple render; fullscreen/overlay/gap use crop/pan
  const videoUseSimpleRender = !isGap && displayMode === 'pip';

  return (
    <>
      {/* Visual layer (behind video for pip, on top for overlay) */}
      {displayMode !== 'overlay' && showVisualLayer && (
        <div style={visualLayerStyle}>
          <VisualSequences visualItems={visualItems} fps={fps} />
        </div>
      )}

      {/* Video layer */}
      {showVideoLayer && !hideVideoCompletely && (
        <div style={videoLayerStyle}>
          <VideoSequences
            videoItems={videoItems}
            fps={fps}
            hasSeparateAudio={hasSeparateAudio}
            transform={transform}
            useSimpleRender={videoUseSimpleRender}
          />
        </div>
      )}

      {/* Overlay mode: visual on top of video at reduced opacity */}
      {displayMode === 'overlay' && showVisualLayer && (
        <div style={overlayVisualStyle}>
          <VisualSequences visualItems={visualItems} fps={fps} />
        </div>
      )}
    </>
  );
}

interface CaptionRendererProps {
  item: TimelineItem;
  fps: number;
}

function CaptionRenderer({ item, fps }: CaptionRendererProps) {
  // useCurrentFrame() inside a Sequence gives us the frame relative to that sequence
  const relativeFrame = useCurrentFrame();
  const data = item.data as CaptionItemData;
  const style = data.style;

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
    const overrides = activeWord.styleOverrides;

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
      <div style={positionStyles}>
        <span
          style={{
            fontFamily: overrides?.fontFamily || style.fontFamily,
            fontSize: (overrides?.scale || 1) * (overrides?.fontSize || style.fontSize),
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
    return (
      <div style={positionStyles}>
        {words.map((word, index) => {
          const isActive = index === activeWordIndex;
          const hasAppeared = relativeTimeMs >= word.startMs;
          const overrides = word.styleOverrides;

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
                fontSize: (overrides?.scale || 1) * (overrides?.fontSize || style.fontSize),
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

  // Default phrase mode: show all words, highlight active via V2 animation engine
  return (
    <div style={positionStyles}>
      {hasWordTimings ? (
        words.map((word, index) => {
          const isActive = index === activeWordIndex;
          const hasAppeared = relativeTimeMs >= word.startMs;
          const overrides = word.styleOverrides;

          // Resolve animation via V2 engine
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
                fontSize: (overrides?.scale || 1) * (overrides?.fontSize || style.fontSize),
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
        })
      ) : (
        <span
          style={{
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
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
