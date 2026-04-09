import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { VoxBarchartProps } from './schema';
import { VOX_COLORS, VOX_SIZES, sf } from '../../vox/constants';
import { voxEntrance, voxExit, progressiveBuild } from '../../vox/animations';
import { FilmGrain, RoughEdgeMask } from '../../vox/effects';
import { VoxHeadline, VoxBody, VoxLabel } from '../../vox/typography';
import { useScale } from '../../use-scale';

const VoxBarchart: React.FC<VoxBarchartProps> = ({ bars, title, unit }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const entrance = voxEntrance(frame, 5, undefined, 'up', s(20));
  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const combinedOpacity = entrance.opacity * exit.opacity;

  const maxValue = Math.max(...bars.map((b) => b.value));

  // Staggered bar builds — start at frame 20, default stagger (5 frames)
  const { itemOpacities } = progressiveBuild(frame, 20, bars.length);

  // Each bar width animates from 0 to target proportion (stagger matches progressiveBuild's default of 5)
  const barWidths = bars.map((bar, i) => {
    const barStart = 20 + i * 5;
    const progress = interpolate(sf(frame), [barStart, barStart + 20], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    return (bar.value / maxValue) * progress;
  });

  const MAX_BAR_WIDTH = s(600);
  const BAR_HEIGHT = s(48);
  const BAR_GAP = s(28);

  return (
    <AbsoluteFill style={{
      backgroundColor: VOX_COLORS.offWhite,
      padding: s(60),
      paddingTop: s(100),
    }}>
      {/* Title */}
      <div style={{
        opacity: combinedOpacity,
        transform: `translateY(${entrance.translateY + exit.translateY}px)`,
        marginBottom: s(48),
      }}>
        {title && (
          <VoxHeadline
            text={title}
            size={s(VOX_SIZES.h3)}
            color={VOX_COLORS.charcoal}
            accentBar="left"
          />
        )}
      </div>

      {/* Bars */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: BAR_GAP,
        flex: 1,
        justifyContent: 'center',
      }}>
        {bars.map((bar, i) => {
          const barColor = bar.highlight ? VOX_COLORS.highlight : VOX_COLORS.teal;
          const labelColor = bar.highlight ? VOX_COLORS.charcoal : VOX_COLORS.charcoal;

          return (
            <div
              key={i}
              style={{
                opacity: itemOpacities[i] * combinedOpacity,
                transform: `translateY(${entrance.translateY + exit.translateY}px)`,
              }}
            >
              {/* Label row */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: s(6),
              }}>
                <span style={{
                  fontFamily: 'Inter',
                  fontSize: s(VOX_SIZES.label),
                  fontWeight: bar.highlight ? 600 : 400,
                  color: labelColor,
                }}>
                  {bar.label}
                </span>
                <span style={{
                  fontFamily: 'Inter',
                  fontSize: s(VOX_SIZES.label),
                  fontWeight: 600,
                  color: bar.highlight ? VOX_COLORS.charcoal : VOX_COLORS.darkGray,
                }}>
                  {bar.value}{unit}
                </span>
              </div>

              {/* Bar */}
              <RoughEdgeMask seed={i * 17 + 3} scale={2}>
                <div style={{
                  width: MAX_BAR_WIDTH,
                  height: BAR_HEIGHT,
                  backgroundColor: VOX_COLORS.lightGray,
                  borderRadius: 2,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: barWidths[i] * MAX_BAR_WIDTH,
                    height: '100%',
                    backgroundColor: barColor,
                    borderRadius: 2,
                  }} />
                </div>
              </RoughEdgeMask>
            </div>
          );
        })}
      </div>

      <FilmGrain opacity={0.25} />
    </AbsoluteFill>
  );
};

export default VoxBarchart;
