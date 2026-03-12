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
import { StaticTemplateRenderer } from './StaticTemplateRenderer';
import {
  interpolateFaceBbox,
  getEffectiveZone,
  ZONE_Z_INDEX,
  ZONE_DIMENSIONS,
} from '../utils/overlay-zones';
import type { FaceBbox, OverlayZone, SegmentationData } from '../store/types';
import {
  computeLayoutForFrame,
  buildLayoutSegmentsFromItems,
  type Rect,
  type SplitSettings as LayoutSplitSettings,
} from './layout-utils';

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
// Optional cropX/cropY (0-100, 50=center) and userScale (>=1.0) allow pan/zoom.
function calculateCoverTransform(
  sourceWidth: number,
  sourceHeight: number,
  containerWidth: number,
  containerHeight: number,
  cropX: number = 50,
  cropY: number = 50,
  userScale: number = 1.0,
) {
  const baseScale = Math.max(containerWidth / sourceWidth, containerHeight / sourceHeight) * userScale;
  const scaledWidth = sourceWidth * baseScale;
  const scaledHeight = sourceHeight * baseScale;
  const overflowX = scaledWidth - containerWidth;
  const overflowY = scaledHeight - containerHeight;
  const translateX = -(overflowX * (cropX / 100));
  const translateY = -(overflowY * (cropY / 100));
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

/**
 * Validate mask path format to prevent path traversal attacks.
 * Valid format: videos/{projectId}/masks
 */
function isValidMaskPath(maskPath: string): boolean {
  // Must match pattern: videos/<alphanumeric_id>/masks
  const pattern = /^videos\/[a-zA-Z0-9_-]+\/masks$/;
  return pattern.test(maskPath);
}

// Compute mask URL for segmented video frame
function getMaskUrl(
  segmentation: SegmentationData | undefined,
  frame: number,
  fps: number
): string | null {
  if (!segmentation?.maskPath || segmentation.status !== 'ready') return null;

  // Validate mask path format to prevent path traversal
  if (!isValidMaskPath(segmentation.maskPath)) {
    console.warn('Invalid mask path format:', segmentation.maskPath);
    return null;
  }

  const maskFps = segmentation.maskFps || 10;
  const maskFrame = Math.floor(frame / (fps / maskFps));
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  return `${apiUrl}/storage/${segmentation.maskPath}/${String(maskFrame + 1).padStart(4, '0')}.webp`;
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
          cropX={videoSettings?.cropX ?? 50}
          cropY={videoSettings?.cropY ?? 50}
          userScale={videoSettings?.scale ?? 1.0}
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

/**
 * Fix expired presigned URLs for youtube-clip templates.
 * Converts old presigned URLs to the new proxy format.
 */
function fixYouTubeClipUrl(templateProps: Record<string, unknown>): Record<string, unknown> {
  const clipUrl = templateProps.clipUrl;
  if (typeof clipUrl !== 'string' || !clipUrl) {
    return templateProps;
  }

  // Check if this is a presigned URL (contains signature parameters)
  const isPresignedUrl = clipUrl.includes('X-Amz-') || clipUrl.includes('?AWSAccessKeyId');

  if (isPresignedUrl) {
    // Extract the storage key from the presigned URL
    // Pattern: .../outputs/clips/{clipId}.mp4?...
    const match = clipUrl.match(/\/outputs\/(clips\/[^?]+)/);
    if (match) {
      const clipKey = match[1];
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      return {
        ...templateProps,
        clipUrl: `${apiUrl}/api/media/outputs/${clipKey}`,
      };
    }
  }

  // Also handle relative URLs (from new API) - convert to absolute
  if (clipUrl.startsWith('/api/media/')) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    return {
      ...templateProps,
      clipUrl: `${apiUrl}${clipUrl}`,
    };
  }

  return templateProps;
}

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
    minStartMs: number;
    maxEndMs: number;
    width: number;
    height: number;
    fps: number;
    // Template-based visual support
    templateId?: string;
    templateProps?: Record<string, unknown>;
  }>();

  // Collect video clips per scene (sceneIndex → proxyUrl)
  // These are passed to DynamicVisualLoader as inputProps.videoClips
  const videoClipsMap: Record<string, string> = {};

  for (const item of visualItems) {
    const data = item.data as VisualItemData;
    const key = data.compositionId;
    const existing = groups.get(key);
    if (existing) {
      existing.minStartMs = Math.min(existing.minStartMs, item.startMs);
      existing.maxEndMs = Math.max(existing.maxEndMs, item.endMs);
    } else {
      groups.set(key, {
        bundleUrl: data.bundleUrl,
        compositionId: data.compositionId,
        minStartMs: item.startMs,
        maxEndMs: item.endMs,
        width: data.width,
        height: data.height,
        fps: data.fps,
        // Include template data for template-based visuals
        templateId: data.templateId,
        templateProps: data.templateProps,
      });
    }

    // Track video clips by scene ID for inputProps
    // sourceSceneId is set by generate-visuals (1-indexed scene ID)
    if (data.videoUrl && data.sourceSceneId !== undefined) {
      const isYouTubeUrl = (url: string) =>
        url.includes('youtube.com') || url.includes('youtu.be');
      if (!isYouTubeUrl(data.videoUrl)) {
        const fullUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${data.videoUrl}`;
        videoClipsMap[String(data.sourceSceneId)] = fullUrl;
      }
    }
  }

  return (
    <>
      {Array.from(groups.entries()).map(([key, group]) => {
        const fromFrame = Math.round((group.minStartMs / 1000) * fps);
        const durationInFrames = Math.round(((group.maxEndMs - group.minStartMs) / 1000) * fps);

        return (
          <Sequence
            key={key}
            from={fromFrame}
            durationInFrames={durationInFrames}
          >
            <AbsoluteFill>
              {group.templateId ? (
                <StaticTemplateRenderer
                  templateId={group.templateId}
                  templateProps={
                    group.templateId === 'youtube-clip'
                      ? fixYouTubeClipUrl(group.templateProps || {})
                      : group.templateProps || {}
                  }
                />
              ) : (
                <DynamicVisualLoader
                  bundleUrl={group.bundleUrl}
                  compositionId={group.compositionId}
                  inputProps={{ videoClips: videoClipsMap }}
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
// Zone-based overlay components
// ---------------------------------------------------------------------------

interface ZoneLayerProps {
  zone: OverlayZone;
  children: React.ReactNode;
  zIndex?: number;
}

/** Container for a specific overlay zone */
function ZoneLayer({ zone, children, zIndex }: ZoneLayerProps) {
  const dimensions = ZONE_DIMENSIONS[zone];
  const effectiveZIndex = zIndex ?? ZONE_Z_INDEX[zone];

  const style: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    width: '100%',
    zIndex: effectiveZIndex,
    ...dimensions,
    height: dimensions.height || '100%',
    overflow: 'hidden',
  };

  return <div style={style}>{children}</div>;
}

interface SegmentedSpeakerProps {
  videoItems: TimelineItem[];
  fps: number;
  hasSeparateAudio: boolean;
  transform: { scale: number; translateX: number; translateY: number };
  maskUrl: string | null;
}

/** Renders video with CSS mask for speaker segmentation */
function SegmentedSpeaker({
  videoItems,
  fps,
  hasSeparateAudio,
  transform,
  maskUrl,
}: SegmentedSpeakerProps) {
  const maskStyle: React.CSSProperties = maskUrl
    ? {
        WebkitMaskImage: `url(${maskUrl})`,
        maskImage: `url(${maskUrl})`,
        WebkitMaskSize: 'cover',
        maskSize: 'cover',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
      }
    : {};

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        zIndex: 2, // Speaker is above 'behind' zone, below other zones
        ...maskStyle,
      }}
    >
      <VideoSequences
        videoItems={videoItems}
        fps={fps}
        hasSeparateAudio={hasSeparateAudio}
        transform={transform}
        useSimpleRender={true}
      />
    </div>
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
  cropX: number;
  cropY: number;
  userScale: number;
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
  cropX,
  cropY,
  userScale,
}: DynamicLayoutProps) {
  const frame = useCurrentFrame();
  const currentTimeMs = (frame / fps) * 1000;

  // Determine the active visual item at the current time
  const activeItem = findActiveVisualItem(visualItems, currentTimeMs);
  const activeData = activeItem ? (activeItem.data as VisualItemData) : null;
  const rawDisplayMode = activeData?.displayMode;
  // Normalize legacy 'pip' → 'default'
  const displayMode = (!rawDisplayMode || (rawDisplayMode as string) === 'pip') ? 'default' : rawDisplayMode;

  const isSplitMode = mode === 'stacked';
  const isGap = !activeItem;

  // ---------------------------------------------------------------------------
  // Stacked mode: use rect-based layout (same math as export FullComposition)
  // ---------------------------------------------------------------------------

  // Build layout segments from visual items (memoized by reference)
  const totalDurationMs = React.useMemo(() => {
    if (visualItems.length === 0) return 60000;
    return Math.max(...visualItems.map(v => v.endMs)) + 1000;
  }, [visualItems]);

  const layoutSegments = React.useMemo(() => {
    if (!isSplitMode) return [];
    const sortedItems = [...visualItems]
      .filter(v => v.type === 'visual')
      .sort((a, b) => a.startMs - b.startMs)
      .map(v => ({
        startMs: v.startMs,
        endMs: v.endMs,
        data: {
          displayMode: (v.data as VisualItemData)?.displayMode || 'default',
        },
      }));
    return buildLayoutSegmentsFromItems(sortedItems, fps, totalDurationMs);
  }, [visualItems, fps, totalDurationMs, isSplitMode]);

  const layoutSplit: LayoutSplitSettings = {
    position: split.position as 'visuals-first' | 'video-first',
    ratio: split.ratio,
    gap: split.gap,
  };

  // Compute rects for stacked mode (continuous frame-by-frame interpolation)
  const { width: compWidth, height: compHeight } = useVideoConfig();
  const layout = isSplitMode
    ? computeLayoutForFrame(frame, layoutSegments, compWidth, compHeight, layoutSplit)
    : null;

  // Video layer style
  let videoLayerStyle: React.CSSProperties;
  let visualLayerStyle: React.CSSProperties;

  if (isSplitMode && layout) {
    // Stacked mode: rect-based absolute positioning with smooth transitions.
    // Matches the export FullComposition exactly.
    const { videoRect, visualsRect, visualsOpacity } = layout;

    videoLayerStyle = videoRect.h <= 1
      ? { display: 'none' }
      : {
          position: 'absolute',
          left: videoRect.x,
          top: videoRect.y,
          width: videoRect.w,
          height: videoRect.h,
          overflow: 'hidden',
        };

    // Visuals layer: scale content from full canvas to the rect size (uniform by width)
    const visualScale = visualsRect.w / compWidth;
    visualLayerStyle = {
      position: 'absolute',
      left: visualsRect.x,
      top: visualsRect.y,
      width: visualsRect.w,
      height: visualsRect.h,
      overflow: 'hidden',
      opacity: visualsOpacity,
    };
  } else if (isGap || displayMode === 'overlay') {
    // Fullscreen video (speaker-only gap or overlay background)
    videoLayerStyle = fullScreenStyle;
    visualLayerStyle = {
      ...fullScreenStyle,
    };
  } else if (displayMode === 'default') {
    // Video as PiP bubble on top of visual (PiP layout mode)
    videoLayerStyle = buildPiPStyle(pip);
    visualLayerStyle = {
      ...fullScreenStyle,
    };
  } else {
    // displayMode === 'fullscreen' — video hidden
    videoLayerStyle = { display: 'none' };
    visualLayerStyle = {
      ...fullScreenStyle,
    };
  }

  // Determine visibility flags from rect-based layout (stacked) or displayMode (pip)
  const showVideoLayer = isSplitMode
    ? (layout ? layout.videoRect.h > 1 : true)
    : (isGap || displayMode === 'default' || displayMode === 'overlay');
  const showVisualLayer = isSplitMode
    ? (layout ? layout.visualsRect.h > 1 : true)
    : !isGap;
  const hideVideoCompletely = isSplitMode
    ? (layout ? layout.videoRect.h <= 1 : false)
    : (!isGap && displayMode === 'fullscreen');

  const speakerBbox = activeData?.speakerBbox;
  let faceMask: string | undefined;
  if (speakerBbox && displayMode === 'overlay' && !isSplitMode) {
    const cx = (speakerBbox.x + speakerBbox.w / 2) * 100;
    const cy = (speakerBbox.y + speakerBbox.h / 2) * 100;
    const rx = (speakerBbox.w / 2 + 0.05) * 100;
    const ry = (speakerBbox.h / 2 + 0.05) * 100;
    faceMask = `radial-gradient(ellipse ${rx}% ${ry}% at ${cx}% ${cy}%, transparent 60%, black 100%)`;
  }
  const overlayVisualStyle: React.CSSProperties = {
    ...fullScreenStyle,
    opacity: 1.0,
    zIndex: 5,
    ...(faceMask ? {
      WebkitMaskImage: faceMask,
      maskImage: faceMask,
    } : {}),
  };

  // ---------------------------------------------------------------------------
  // Zone-based rendering setup
  // ---------------------------------------------------------------------------

  // Group visuals by their overlay zone
  const visualsByZone = React.useMemo(() => {
    const grouped: Record<OverlayZone, TimelineItem[]> = {
      'background': [],
      'behind': [],
      'frame': [],
      'lower-third': [],
      'top': [],
      'none': [],
    };

    for (const item of visualItems) {
      const data = item.data as VisualItemData;
      const zone = getEffectiveZone(data.overlayZone, data.displayMode);
      grouped[zone].push(item);
    }

    return grouped;
  }, [visualItems]);

  // Get segmentation data from first video item
  const videoSegmentation = videoItems.length > 0
    ? (videoItems[0].data as VideoItemData).segmentation
    : undefined;

  // Compute mask URL for current frame
  const maskUrl = getMaskUrl(videoSegmentation, frame, fps);

  // Get interpolated face bbox for zone-aware templates
  const faceBbox = videoSegmentation?.faceBboxTimeline
    ? interpolateFaceBbox(
        videoSegmentation.faceBboxTimeline,
        Math.floor(frame / fps * (videoSegmentation.maskFps || 10))
      )
    : null;

  // Determine if we should use zone-based rendering
  // Zone rendering activates when: segmentation is ready AND at least one visual uses a zone
  const hasZonedVisuals =
    visualsByZone.background.length > 0 ||
    visualsByZone.behind.length > 0 ||
    visualsByZone.frame.length > 0 ||
    visualsByZone['lower-third'].length > 0 ||
    visualsByZone.top.length > 0;

  const useZoneRendering = videoSegmentation?.status === 'ready' && hasZonedVisuals;

  // ---------------------------------------------------------------------------
  // Video transform calculation
  // ---------------------------------------------------------------------------

  // Determine whether the video should use simple (cover) or crop/pan rendering
  // All modes now use transform-based rendering so cropX/cropY/scale are respected.

  let videoUseSimpleRender = false;
  let videoTransform = transform;

  if (isSplitMode && layout && layout.videoRect.h > 1 && videoItems.length > 0) {
    // Stacked mode: cover transform for the current video rect (animated during transitions)
    const containerW = layout.videoRect.w;
    const containerH = layout.videoRect.h;
    const firstVideoData = videoItems[0].data as VideoItemData;
    if (firstVideoData.width > 0 && firstVideoData.height > 0) {
      videoTransform = calculateCoverTransform(
        firstVideoData.width, firstVideoData.height,
        containerW, containerH,
        cropX, cropY, userScale,
      );
    }
  } else if (!isGap && displayMode === 'default') {
    // PiP mode: cover transform for the PiP bubble container
    const pipSizePercent = pip.size === 'custom' ? pip.customSize : PIP_SIZE_MAP[pip.size];
    const pipW = Math.round(compWidth * pipSizePercent / 100);
    const pipH = pipW; // PiP is always 1:1 aspect ratio
    const firstVideoData = videoItems.length > 0 ? videoItems[0].data as VideoItemData : null;
    if (firstVideoData && firstVideoData.width > 0 && firstVideoData.height > 0) {
      videoTransform = calculateCoverTransform(
        firstVideoData.width, firstVideoData.height,
        pipW, pipH,
        cropX, cropY, userScale,
      );
    }
  }

  return (
    <>
      {useZoneRendering ? (
        /* Zone-based rendering */
        <>
          {/* Background zone */}
          {visualsByZone.background.length > 0 && (
            <ZoneLayer zone="background">
              <VisualSequences visualItems={visualsByZone.background} fps={fps} />
            </ZoneLayer>
          )}

          {/* Behind zone */}
          {visualsByZone.behind.length > 0 && (
            <ZoneLayer zone="behind">
              <VisualSequences visualItems={visualsByZone.behind} fps={fps} />
            </ZoneLayer>
          )}

          {/* Segmented speaker */}
          <SegmentedSpeaker
            videoItems={videoItems}
            fps={fps}
            hasSeparateAudio={hasSeparateAudio}
            transform={transform}
            maskUrl={maskUrl}
          />

          {/* Frame zone (edge effects around speaker) */}
          {visualsByZone.frame.length > 0 && (
            <ZoneLayer zone="frame">
              <VisualSequences visualItems={visualsByZone.frame} fps={fps} />
            </ZoneLayer>
          )}

          {/* Lower-third zone */}
          {visualsByZone['lower-third'].length > 0 && (
            <ZoneLayer zone="lower-third">
              <VisualSequences visualItems={visualsByZone['lower-third']} fps={fps} />
            </ZoneLayer>
          )}

          {/* Top zone */}
          {visualsByZone.top.length > 0 && (
            <ZoneLayer zone="top">
              <VisualSequences visualItems={visualsByZone.top} fps={fps} />
            </ZoneLayer>
          )}

          {/* Non-zone visuals still use displayMode logic */}
          {visualsByZone.none.length > 0 && (
            /* Render these using the existing displayMode logic */
            <>
              {displayMode !== 'overlay' && (
                <div style={visualLayerStyle}>
                  <VisualSequences visualItems={visualsByZone.none} fps={fps} />
                </div>
              )}
              {displayMode === 'overlay' && (
                <div style={overlayVisualStyle}>
                  <VisualSequences visualItems={visualsByZone.none} fps={fps} />
                </div>
              )}
            </>
          )}
        </>
      ) : isSplitMode && layout ? (
        /* Stacked mode: rect-based layout matching export FullComposition */
        <>
          {/* Video layer — positioned by animated rect */}
          {showVideoLayer && !hideVideoCompletely && (
            <div style={videoLayerStyle}>
              <VideoSequences
                videoItems={videoItems}
                fps={fps}
                hasSeparateAudio={hasSeparateAudio}
                transform={videoTransform}
                useSimpleRender={videoUseSimpleRender}
              />
            </div>
          )}

          {/* Visuals layer — positioned by animated rect with uniform scaling */}
          {showVisualLayer && (
            <div style={visualLayerStyle}>
              <div style={{
                transform: `scale(${layout.visualsRect.w / compWidth})`,
                transformOrigin: 'top left',
                width: compWidth,
                height: compHeight,
              }}>
                <VisualSequences visualItems={visualItems} fps={fps} />
              </div>
            </div>
          )}
        </>
      ) : (
        /* PiP mode: existing displayMode-based rendering */
        <>
          {/* Visual layer (behind video for pip) */}
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
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Dynamic Hierarchy — word classification for typography hierarchy preset
// ---------------------------------------------------------------------------

const POWER_WORDS = new Set([
  // Emotion
  'love', 'hate', 'fear', 'die', 'dead', 'death', 'kill', 'destroy', 'dream',
  'obsessed', 'insane', 'crazy', 'incredible', 'amazing', 'unbelievable',
  'shocking', 'terrifying', 'brilliant', 'genius', 'perfect', 'worst',
  'best', 'greatest', 'legendary', 'epic', 'massive', 'huge', 'evil',
  // Urgency
  'now', 'stop', 'wait', 'listen', 'watch', 'look', 'never', 'always',
  'forever', 'immediately', 'urgent', 'warning', 'danger', 'critical',
  'important', 'breaking', 'exclusive', 'secret', 'finally', 'today',
  // Money & numbers
  'million', 'billion', 'thousand', 'money', 'rich', 'free', 'paid',
  'expensive', 'cheap', 'profit', 'cash', 'dollar', 'dollars', 'price',
  'worth', 'cost', 'zero', 'double', 'triple', '100%', '1000',
  // Contrast & impact
  'but', 'however', 'actually', 'wrong', 'right', 'truth', 'lie', 'real',
  'fake', 'only', 'everything', 'nothing', 'impossible', 'possible',
  'everyone', 'nobody', 'first', 'last', 'biggest', 'smallest',
  // Power verbs
  'win', 'won', 'lose', 'lost', 'fight', 'broke', 'crushed', 'dominated',
  'exploded', 'changed', 'saved', 'failed', 'success', 'discovered',
]);

const FILLER_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'to', 'of', 'in', 'for', 'on', 'at', 'by', 'with', 'from', 'as',
  'and', 'or', 'if', 'it', 'its', 'that', 'this', 'than', 'then',
  'so', 'up', 'do', 'did', 'has', 'had', 'have', 'will', 'would',
  'could', 'should', 'can', 'may', 'might', 'shall', 'just', 'very',
  'also', 'about', 'into', 'not', 'no', 'yes', 'some', 'my', 'your',
  'we', 'they', 'he', 'she', 'i', 'me', 'us', 'them', 'our', 'their',
]);

function classifyWordTier(text: string): 'power' | 'medium' | 'filler' {
  const clean = text.replace(/[^a-zA-Z0-9%]/g, '').toLowerCase();
  // Numbers (dollar amounts, percentages, large numbers) are power words
  if (/^\$?\d/.test(clean) || /\d{4,}/.test(clean) || clean.endsWith('%')) return 'power';
  if (POWER_WORDS.has(clean)) return 'power';
  if (FILLER_WORDS.has(clean)) return 'filler';
  return 'medium';
}

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

// ---------------------------------------------------------------------------
// Emotional line breaking — break for impact, not grammar
// ---------------------------------------------------------------------------

interface EmotionalSegment {
  lines: number[][]; // each line is an array of word indices
  startIdx: number;
  endIdx: number;    // exclusive
}

/**
 * Break caption words into emotional segments (groups of 1-2 lines shown together).
 * Rules:
 *  - Max 5 words per line
 *  - Isolate power words (single-word line for dramatic emphasis)
 *  - Break on pauses > 400ms
 *  - Don't start a line with a filler word (pull it to the previous line if possible)
 *  - Alternate short (1-2 words) and medium (3-5 words) lines for visual rhythm
 */
function computeEmotionalSegments(words: CaptionWord[]): EmotionalSegment[] {
  if (words.length === 0) return [];

  const MAX_LINE = 5;
  const PAUSE_THRESHOLD_MS = 400;
  const lines: number[][] = [];
  let currentLine: number[] = [];

  for (let i = 0; i < words.length; i++) {
    const tier = classifyWordTier(words[i].text);

    // Check for pause before this word
    const hasPause = i > 0 && (words[i].startMs - words[i - 1].endMs) > PAUSE_THRESHOLD_MS;

    // Force break: pause detected
    if (hasPause && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [];
    }

    // Power word isolation: if this is a power word, break before it
    // and give it its own line (or start of a new line)
    if (tier === 'power' && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [];
    }

    // Don't start a line with a filler word — pull it to previous line if possible
    if (tier === 'filler' && currentLine.length === 0 && lines.length > 0) {
      const prevLine = lines[lines.length - 1];
      if (prevLine.length < MAX_LINE) {
        prevLine.push(i);
        continue;
      }
    }

    currentLine.push(i);

    // Power word gets its own line
    if (tier === 'power' && currentLine.length === 1) {
      // Check if the next word is also short — if so, keep the power word alone
      lines.push(currentLine);
      currentLine = [];
      continue;
    }

    // Max line length hit
    if (currentLine.length >= MAX_LINE) {
      lines.push(currentLine);
      currentLine = [];
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  // Group lines into display segments (max 2 lines per segment for rhythm)
  const segments: EmotionalSegment[] = [];
  for (let l = 0; l < lines.length; l += 2) {
    const segLines = [lines[l]];
    if (l + 1 < lines.length) segLines.push(lines[l + 1]);
    const allIndices = segLines.flat();
    segments.push({
      lines: segLines,
      startIdx: allIndices[0],
      endIdx: allIndices[allIndices.length - 1] + 1,
    });
  }

  return segments;
}

/** Find which emotional segment contains a word index */
function findActiveSegment(segments: EmotionalSegment[], wordIdx: number): EmotionalSegment | null {
  for (const seg of segments) {
    if (wordIdx >= seg.startIdx && wordIdx < seg.endIdx) return seg;
  }
  return segments.length > 0 ? segments[0] : null;
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
              flexWrap: 'wrap',
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
