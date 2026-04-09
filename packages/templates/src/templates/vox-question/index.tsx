import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxQuestionProps } from './schema';
import { VOX_COLORS, VOX_SIZES } from '../../vox/constants';
import { voxEntrance, voxExit, voxIdle } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { VoxQuestion } from '../../vox/typography';
import { useScale } from '../../use-scale';

const VoxQuestionTemplate: React.FC<VoxQuestionProps> = ({ question }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const entrance = voxEntrance(frame, 6, undefined, 'up', s(20));
  const exitStart = durationInFrames - 10;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const idle = voxIdle(frame, 22, 'scale');

  const combinedOpacity = entrance.opacity * exit.opacity;
  const combinedY = entrance.translateY + exit.translateY;
  const combinedScale = 1 + (entrance.opacity < 1 ? (1 - entrance.opacity) * 0.05 : 0) + idle.scale - 1;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: VOX_COLORS.deepPurple,
        justifyContent: 'center',
        alignItems: 'center',
        padding: s(80),
      }}
    >
      <ConstructionPaper color={VOX_COLORS.deepPurple} opacity={0.25} seed={9} />

      <div
        style={{
          opacity: combinedOpacity,
          transform: `translateY(${combinedY}px) scale(${combinedScale})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: s(860),
        }}
      >
        <VoxQuestion text={question} size={s(VOX_SIZES.h1)} />
      </div>

      <FilmGrain opacity={0.4} />
    </AbsoluteFill>
  );
};

export default VoxQuestionTemplate;
