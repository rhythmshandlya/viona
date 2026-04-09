import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxCalloutProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS } from '../../vox/constants';
import { voxEntrance, voxExit } from '../../vox/animations';
import { FilmGrain, RoughEdgeMask } from '../../vox/effects';
import { VoxBody } from '../../vox/typography';
import { ConstructionPaper } from '../../vox/textures';
import { useScale } from '../../use-scale';

const ICON_CHARS: Record<VoxCalloutProps['icon'], string> = {
  info: 'ℹ',
  warning: '⚠',
  star: '★',
  pin: '📌',
};

const VoxCallout: React.FC<VoxCalloutProps> = ({ text, icon }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const entrance = voxEntrance(frame, 5, undefined, 'up', s(30));
  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };

  const combinedOpacity = entrance.opacity * exit.opacity;
  const combinedY = entrance.translateY + exit.translateY;

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.offWhite, justifyContent: 'center', alignItems: 'center', padding: s(60) }}>
      <ConstructionPaper color={VOX_COLORS.offWhite} opacity={0.4} seed={17} />

      <div style={{
        opacity: combinedOpacity,
        transform: `translateY(${combinedY}px) rotate(1.5deg)`,
        width: '100%',
        maxWidth: s(900),
      }}>
        <RoughEdgeMask seed={42} scale={3}>
          <div style={{
            backgroundColor: VOX_COLORS.white,
            borderLeft: `${s(8)}px solid ${VOX_COLORS.highlight}`,
            padding: s(48),
            display: 'flex',
            alignItems: 'flex-start',
            gap: s(32),
          }}>
            {/* Icon */}
            <div style={{
              fontSize: s(VOX_SIZES.h1),
              lineHeight: 1,
              flexShrink: 0,
              marginTop: s(4),
            }}>
              {ICON_CHARS[icon]}
            </div>

            {/* Text */}
            <VoxBody
              text={text}
              size={s(VOX_SIZES.body)}
              color={VOX_COLORS.charcoal}
            />
          </div>
        </RoughEdgeMask>
      </div>

      <FilmGrain opacity={0.35} />
    </AbsoluteFill>
  );
};

export default VoxCallout;
