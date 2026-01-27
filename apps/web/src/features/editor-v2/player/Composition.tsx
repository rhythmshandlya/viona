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
} from '@reelify/renderer/animations';
import type { AnimationConfig } from '@reelify/renderer/animations';
import {
  useItems,
  useItemIds,
  useFps,
  useVideoSettings,
  useSourceDimensions,
} from '../store/use-editor-store';
import {
  TimelineItem,
  VideoItemData,
  AudioItemData,
  CaptionItemData,
} from '../store/types';

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

export function Composition() {
  const fps = useFps();
  const items = useItems();
  const itemIds = useItemIds();
  const videoSettings = useVideoSettings();
  const sourceDimensions = useSourceDimensions();

  // Get items by type
  const videoItems = itemIds
    .map((id) => items[id])
    .filter((item): item is TimelineItem => item?.type === 'video');

  const captionItems = itemIds
    .map((id) => items[id])
    .filter((item): item is TimelineItem => item?.type === 'caption');

  const audioItems = itemIds
    .map((id) => items[id])
    .filter((item): item is TimelineItem => item?.type === 'audio');

  // When a separate audio item exists with a valid src, mute the video
  // to avoid playing the audio twice (original in video + enhanced in audio).
  const hasSeparateAudio = audioItems.some(
    (item) => (item.data as AudioItemData).src,
  );

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

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Video layer with crop/pan transform */}
      {videoItems.map((item) => {
        const data = item.data as VideoItemData;
        if (!data.src) return null;
        const fromFrame = Math.round((item.startMs / 1000) * fps);
        // Subtract 3 frames (~100 ms @ 30 fps) to avoid seeking past the
        // media file's actual end.  Probe/container-level durations can
        // overstate the real decodable length by several frames.
        const durationInFrames = Math.max(
          1,
          Math.floor(((item.endMs - item.startMs) / 1000) * fps) - 2,
        );

        // If the item has trim data, tell Remotion where inside the source
        // media to start and stop so we never exceed the actual content.
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
                />
              </div>
            </AbsoluteFill>
          </Sequence>
        );
      })}

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
            <Audio src={data.src} volume={data.volume} />
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

  // Position based on style
  const offsetY = style.offsetY || 0;
  const positionStyles: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '90%',
    textAlign: style.textAlign || 'center',
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '8px',
    ...(style.position === 'top' && { top: `${10 + offsetY}%` }),
    ...(style.position === 'center' && { top: `${50 + offsetY}%`, transform: 'translate(-50%, -50%)' }),
    ...(style.position === 'bottom' && { bottom: `${15 - offsetY}%` }),
  };

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

    return (
      <div style={positionStyles}>
        <span
          style={{
            fontFamily: style.fontFamily,
            fontSize: (overrides?.scale || 1) * style.fontSize,
            fontWeight: overrides?.fontWeight || style.fontWeight,
            color: overrides?.color || style.activeColor,
            backgroundColor: overrides?.emphasisBg || style.activeBackgroundColor || 'transparent',
            textShadow: style.textShadow || '2px 2px 4px rgba(0,0,0,0.8)',
            padding: '4px 12px',
            borderRadius: '8px',
            display: 'inline-block',
            whiteSpace: 'nowrap',
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

          return (
            <span
              key={index}
              style={{
                fontFamily: style.fontFamily,
                fontSize: (overrides?.scale || 1) * style.fontSize,
                fontWeight: overrides?.fontWeight || style.fontWeight,
                padding: '4px 12px',
                borderRadius: '8px',
                display: 'inline-block',
                whiteSpace: 'nowrap',
                background: hasAppeared
                  ? `linear-gradient(90deg, ${overrides?.color || style.activeColor} ${fillPercent}%, ${style.color} ${fillPercent}%)`
                  : style.color,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: style.textShadow || '2px 2px 4px rgba(0,0,0,0.8)',
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

          return (
            <span
              key={index}
              style={{
                fontFamily: style.fontFamily,
                fontSize: (overrides?.scale || 1) * style.fontSize,
                fontWeight: overrides?.fontWeight || style.fontWeight,
                color: isActive
                  ? (overrides?.color || style.activeColor)
                  : (overrides?.color || style.color),
                backgroundColor: overrides?.emphasisBg
                  || (isActive
                    ? style.activeBackgroundColor || 'transparent'
                    : style.backgroundColor || 'transparent'),
                textShadow: style.textShadow || '2px 2px 4px rgba(0,0,0,0.8)',
                padding: '4px 12px',
                borderRadius: '8px',
                display: 'inline-block',
                whiteSpace: 'nowrap',
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
            textShadow: style.textShadow || '2px 2px 4px rgba(0,0,0,0.8)',
            padding: '4px 12px',
          }}
        >
          {data.text}
        </span>
      )}
    </div>
  );
}
