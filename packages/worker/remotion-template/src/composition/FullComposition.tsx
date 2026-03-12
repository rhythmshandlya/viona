import React from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, useCurrentFrame, useVideoConfig, staticFile } from 'remotion';
import { computeLayoutForFrame, computePiPLayoutForFrame } from './utils';
import { SpeakerVideo } from './SpeakerVideo';
import { PiPVideo } from './PiPVideo';
import { VisualsLayer } from './VisualsLayer';
import { SceneTransitionLayer } from './SceneTransitionLayer';
import { SubtitleLayer } from './SubtitleLayer';
import type { FullCompositionProps, Rect } from './types';

interface Props extends FullCompositionProps {
  children?: React.ReactNode;
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
  sceneItems,
  renderScene,
  children,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const hasVideo = !!sourceVideoFile;
  const fullRect = { x: 0, y: 0, w: width, h: height };

  const hasSceneTransitions = sceneItems && sceneItems.length > 0 && renderScene;

  // Helper: render visuals either via SceneTransitionLayer or children
  const renderVisuals = (rect: Rect, opacity: number) => {
    if (hasSceneTransitions) {
      return (
        <SceneTransitionLayer
          sceneItems={sceneItems}
          renderScene={renderScene}
          rect={rect}
          opacity={opacity}
        />
      );
    }
    return (
      <VisualsLayer rect={rect} opacity={opacity}>
        {children}
      </VisualsLayer>
    );
  };

  // --- Audio-only: visuals fullscreen + subtitles + <Audio> ---
  if (!hasVideo) {
    return (
      <AbsoluteFill style={{ backgroundColor: backgroundColor || '#000' }}>
        {renderVisuals(fullRect, 1)}
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
        {showVisuals && renderVisuals(fullRect, 1)}

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
      {renderVisuals(visualsRect, visualsOpacity)}
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
