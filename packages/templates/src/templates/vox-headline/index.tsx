import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxHeadlineProps } from './schema';
import { VOX_COLORS, VOX_SIZES } from '../../vox/constants';
import { voxEntrance, voxExit, voxIdle } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { VoxHeadline as HeadlineText } from '../../vox/typography';
import { useScale } from '../../use-scale';

const VoxHeadline: React.FC<VoxHeadlineProps> = ({ headline, subtext, accentBar, background }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const isDark = background === 'dark';
  const bgColor = isDark ? VOX_COLORS.deepPurple : VOX_COLORS.offWhite;
  const textColor = isDark ? VOX_COLORS.white : VOX_COLORS.charcoal;

  const entrance = voxEntrance(frame, 8, undefined, 'up', s(30));
  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const idle = voxIdle(frame, 42);

  const combinedOpacity = entrance.opacity * exit.opacity;
  const combinedY = entrance.translateY + exit.translateY + idle.translateY;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center', padding: s(60) }}>
      <ConstructionPaper color={bgColor} opacity={0.4} seed={5} />
      <div style={{
        opacity: combinedOpacity,
        transform: `translateY(${combinedY}px)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: s(16),
        maxWidth: s(900),
      }}>
        <HeadlineText
          text={headline}
          size={s(VOX_SIZES.h1)}
          color={textColor}
          accentBar={accentBar}
        />
        {subtext && (
          <div style={{
            fontFamily: 'Inter',
            fontSize: s(VOX_SIZES.body),
            color: isDark ? VOX_COLORS.lightGray : VOX_COLORS.darkGray,
            marginTop: s(12),
            opacity: entrance.opacity,
          }}>
            {subtext}
          </div>
        )}
      </div>
      <FilmGrain opacity={0.35} />
    </AbsoluteFill>
  );
};

export default VoxHeadline;
