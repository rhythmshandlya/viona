import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxSupercutProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS } from '../../vox/constants';
import { voxExit } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { useScale } from '../../use-scale';

const VoxSupercut: React.FC<VoxSupercutProps> = ({ items, title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  // Flash each item for 3 frames
  const activeIndex = Math.floor(frame / 3) % items.length;

  const exitStart = durationInFrames - 10;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };

  // Alternate between dark and darker background for flicker effect
  const bgFlicker = (Math.floor(frame / 3) % 2 === 0)
    ? VOX_COLORS.warmBlack
    : VOX_COLORS.deepPurple;

  return (
    <AbsoluteFill style={{
      backgroundColor: bgFlicker,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: s(60),
    }}>
      {/* Optional overline title */}
      {title && (
        <div style={{
          fontFamily: VOX_FONTS.body,
          fontSize: s(VOX_SIZES.label),
          fontWeight: 500,
          color: VOX_COLORS.teal,
          textTransform: 'uppercase' as const,
          letterSpacing: 3,
          marginBottom: s(32),
          opacity: exit.opacity,
        }}>
          {title}
        </div>
      )}

      {/* Main flashing word */}
      <div style={{
        opacity: exit.opacity,
        transform: `translateY(${exit.translateY}px)`,
        textAlign: 'center' as const,
      }}>
        <div style={{
          fontFamily: VOX_FONTS.headline,
          fontSize: s(VOX_SIZES.hero),
          fontWeight: 700,
          color: VOX_COLORS.highlight,
          lineHeight: 1.1,
          textTransform: 'uppercase' as const,
          letterSpacing: -1,
        }}>
          {items[activeIndex]}
        </div>
      </div>

      {/* Frame counter indicator — tiny bar at bottom for urgency */}
      <div style={{
        position: 'absolute',
        bottom: s(80),
        left: s(60),
        right: s(60),
        height: s(3),
        backgroundColor: VOX_COLORS.charcoal,
        opacity: 0.4,
      }}>
        <div style={{
          width: `${(frame / durationInFrames) * 100}%`,
          height: '100%',
          backgroundColor: VOX_COLORS.highlight,
        }} />
      </div>

      <FilmGrain opacity={0.4} cycleFrames={2} />
    </AbsoluteFill>
  );
};

export default VoxSupercut;
