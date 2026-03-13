import React from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, useCurrentFrame, useVideoConfig, staticFile } from 'remotion';
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
        {/* Persistent audio carrier — always rendered so audio never drops
            during display mode transitions. Hidden visually (1x1, opacity 0). */}
        <OffthreadVideo
          src={staticFile(sourceVideoFile)}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
        />

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

        {/* PiP bubble (non-overlay) — muted, audio comes from carrier above */}
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
