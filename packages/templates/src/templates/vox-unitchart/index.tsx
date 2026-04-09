import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { VoxUnitchartProps } from './schema';
import { VOX_COLORS, VOX_SIZES, sf, voxEaseOut } from '../../vox/constants';
import { voxEntrance, voxExit } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { VoxBody, VoxLabel } from '../../vox/typography';
import { useScale } from '../../use-scale';

const VoxUnitchart: React.FC<VoxUnitchartProps> = ({ total, highlighted, unit, label }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const entrance = voxEntrance(frame, 5, undefined, 'up', s(20));
  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const combinedOpacity = entrance.opacity * exit.opacity;

  // Build the dot grid — use a 10x10 grid if total is 100, else scale
  const cols = 10;
  const rows = Math.ceil(total / cols);
  const DOT_SIZE = s(56);
  const DOT_GAP = s(16);

  // Each dot appears 1 frame apart, starting at frame 20
  const dotOpacities = Array.from({ length: total }, (_, i) => {
    const dotStart = 20 + i * 1;
    return interpolate(frame, [dotStart, dotStart + 4], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: voxEaseOut,
    });
  });

  // Label fades in after all dots appear
  const labelOpacity = interpolate(sf(frame), [20 + total + 5, 20 + total + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }) * combinedOpacity;

  const gridWidth = cols * (DOT_SIZE + DOT_GAP) - DOT_GAP;

  return (
    <AbsoluteFill style={{
      backgroundColor: VOX_COLORS.offWhite,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: s(60),
      opacity: entrance.opacity * exit.opacity,
      transform: `translateY(${entrance.translateY + exit.translateY}px)`,
    }}>
      {/* Unit label above */}
      <div style={{ marginBottom: s(24), opacity: combinedOpacity }}>
        <VoxLabel text={unit} color={VOX_COLORS.charcoal} />
      </div>

      {/* Dot grid */}
      <div style={{
        width: gridWidth,
        display: 'flex',
        flexWrap: 'wrap' as const,
        gap: DOT_GAP,
        justifyContent: 'flex-start',
      }}>
        {Array.from({ length: total }, (_, i) => {
          const isHighlighted = i < highlighted;
          return (
            <div
              key={i}
              style={{
                width: DOT_SIZE,
                height: DOT_SIZE,
                borderRadius: '50%',
                backgroundColor: isHighlighted ? VOX_COLORS.highlight : VOX_COLORS.lightGray,
                opacity: dotOpacities[i] * exit.opacity,
                flexShrink: 0,
              }}
            />
          );
        })}
      </div>

      {/* Label below */}
      <div style={{
        marginTop: s(40),
        opacity: labelOpacity,
        textAlign: 'center' as const,
      }}>
        <VoxBody
          text={label}
          size={s(VOX_SIZES.body)}
          color={VOX_COLORS.charcoal}
        />
      </div>

      <FilmGrain opacity={0.2} />
    </AbsoluteFill>
  );
};

export default VoxUnitchart;
