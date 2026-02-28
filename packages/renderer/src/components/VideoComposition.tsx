import React from 'react';
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  useVideoConfig,
} from 'remotion';
import { AnimatedSubtitle, SubtitleWord, SubtitleStyle } from './AnimatedSubtitle';

export interface SubtitleItem {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  words: SubtitleWord[];
  style?: SubtitleStyle;
}

/** Video crop/pan/scale settings to match the editor preview */
export interface VideoCropSettings {
  sourceWidth: number;
  sourceHeight: number;
  cropX: number;    // 0-100, 50=center
  cropY: number;    // 0-100, 50=center
  scale: number;    // 1.0=fill, >1 zoom
}

export interface VideoCompositionProps {
  videoUrl: string;
  subtitles: SubtitleItem[];
  defaultSubtitleStyle?: SubtitleStyle;
  videoCrop?: VideoCropSettings;
}

/**
 * Calculate video transform for crop/pan — mirrors the editor preview's
 * calculateVideoTransform function exactly.
 */
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

export const VideoComposition: React.FC<VideoCompositionProps> = ({
  videoUrl,
  subtitles,
  defaultSubtitleStyle,
  videoCrop,
}) => {
  const { fps, width: canvasWidth, height: canvasHeight } = useVideoConfig();

  // Calculate video transform for crop/pan if settings are provided
  const videoStyle: React.CSSProperties = videoCrop
    ? (() => {
        const { scale, translateX, translateY } = calculateVideoTransform(
          videoCrop.sourceWidth,
          videoCrop.sourceHeight,
          canvasWidth,
          canvasHeight,
          videoCrop.cropX,
          videoCrop.cropY,
          videoCrop.scale
        );
        return {
          width: videoCrop.sourceWidth,
          height: videoCrop.sourceHeight,
          transformOrigin: '0 0',
          transform: `scale(${scale}) translate(${translateX / scale}px, ${translateY / scale}px)`,
        };
      })()
    : {
        width: '100%',
        height: '100%',
        objectFit: 'cover' as const,
      };

  return (
    <AbsoluteFill style={{ backgroundColor: 'black', overflow: 'hidden' }}>
      {/* Video layer */}
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <OffthreadVideo
          src={videoUrl}
          style={videoStyle}
        />
      </AbsoluteFill>

      {/* Subtitles layer */}
      <AbsoluteFill>
        {subtitles.map((subtitle) => {
          const startFrame = Math.floor((subtitle.startMs / 1000) * fps);
          const durationFrames = Math.floor(
            ((subtitle.endMs - subtitle.startMs) / 1000) * fps
          );

          return (
            <Sequence
              key={subtitle.id}
              from={startFrame}
              durationInFrames={durationFrames}
            >
              <AnimatedSubtitle
                words={subtitle.words}
                startMs={subtitle.startMs}
                endMs={subtitle.endMs}
                style={{ ...defaultSubtitleStyle, ...subtitle.style }}
              />
            </Sequence>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default VideoComposition;
