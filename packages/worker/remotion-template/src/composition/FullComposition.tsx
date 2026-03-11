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
      <SpeakerVideo
        rect={videoRect}
        src={sourceVideoFile}
        crop={videoCropSettings}
      />
      <VisualsLayer rect={visualsRect} opacity={visualsOpacity}>
        {children}
      </VisualsLayer>
    </AbsoluteFill>
  );
};
