import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxLabelProps } from './schema';
import { VOX_COLORS, VOX_SIZES } from '../../vox/constants';
import { voxEntrance, voxExit } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { VoxLabel, VoxSourceBadge } from '../../vox/typography';
import { RoughDivider } from '../../vox/decorations';
import { useScale } from '../../use-scale';

const VoxLabelTemplate: React.FC<VoxLabelProps> = ({ location, date, source }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const entrance = voxEntrance(frame, 6, undefined, 'up', s(24));
  const exitStart = durationInFrames - 10;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };

  const combinedOpacity = entrance.opacity * exit.opacity;
  const combinedY = entrance.translateY + exit.translateY;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: VOX_COLORS.offWhite,
        justifyContent: 'flex-end',
        alignItems: 'flex-start',
        padding: s(80),
        paddingBottom: s(120),
      }}
    >
      <ConstructionPaper color={VOX_COLORS.offWhite} opacity={0.2} seed={17} />

      <div
        style={{
          opacity: combinedOpacity,
          transform: `translateY(${combinedY}px)`,
          display: 'flex',
          flexDirection: 'column',
          gap: s(12),
        }}
      >
        {location && (
          <VoxLabel text={location} color={VOX_COLORS.charcoal} />
        )}
        {location && date && (
          <RoughDivider length={s(120)} direction="horizontal" color={VOX_COLORS.lightGray} thickness={2} />
        )}
        {date && (
          <VoxLabel text={date} color={VOX_COLORS.medGray} />
        )}
      </div>

      {source && <VoxSourceBadge source={source} position="bottom-right" />}
      <FilmGrain opacity={0.25} />
    </AbsoluteFill>
  );
};

export default VoxLabelTemplate;
