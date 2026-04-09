import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxFunnelProps } from './schema';
import { VOX_COLORS, VOX_SIZES } from '../../vox/constants';
import { voxEntrance, voxExit, progressiveBuild } from '../../vox/animations';
import { FilmGrain, RoughEdgeMask } from '../../vox/effects';
import { VoxHeadline } from '../../vox/typography';
import { useScale } from '../../use-scale';

function parseNumeric(val: string): number {
  const n = parseFloat(val.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
}

const VoxFunnel: React.FC<VoxFunnelProps> = ({ stages, title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const entrance = voxEntrance(frame, 5, undefined, 'up', s(20));
  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const combinedOpacity = entrance.opacity * exit.opacity;

  const { itemOpacities } = progressiveBuild(frame, 20, stages.length);

  const numericValues = stages.map((st) => parseNumeric(st.value));
  const maxVal = Math.max(...numericValues, 1);

  const MAX_BAR_WIDTH = s(800);
  const MIN_BAR_WIDTH = s(180);
  const BAR_HEIGHT = s(100);
  const ROW_SPACING = s(32);
  const LIST_TOP = s(280);

  const isNarrowest = (i: number) => {
    const minVal = Math.min(...numericValues);
    return numericValues[i] === minVal;
  };

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.offWhite }}>
      {/* Title */}
      <div style={{
        position: 'absolute',
        top: s(80),
        left: s(60),
        right: s(60),
        opacity: combinedOpacity,
        transform: `translateY(${entrance.translateY + exit.translateY}px)`,
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

      {/* Funnel bars */}
      {stages.map((stage, i) => {
        const numVal = numericValues[i];
        const fraction = maxVal > 0 ? numVal / maxVal : 1;
        const barWidth = MIN_BAR_WIDTH + (MAX_BAR_WIDTH - MIN_BAR_WIDTH) * fraction;
        const highlighted = isNarrowest(i);
        const rowTop = LIST_TOP + i * (BAR_HEIGHT + ROW_SPACING);

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: rowTop,
              left: s(60),
              right: s(60),
              display: 'flex',
              alignItems: 'center',
              gap: s(20),
              opacity: itemOpacities[i] * combinedOpacity,
            }}
          >
            {/* Bar */}
            <RoughEdgeMask seed={i * 13 + 5}>
              <div style={{
                width: barWidth,
                height: BAR_HEIGHT,
                backgroundColor: highlighted ? VOX_COLORS.highlight : VOX_COLORS.teal,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: s(20),
                boxSizing: 'border-box',
                flexShrink: 0,
              }}>
                <span style={{
                  fontFamily: 'Inter',
                  fontSize: s(VOX_SIZES.label),
                  fontWeight: 600,
                  color: highlighted ? VOX_COLORS.charcoal : VOX_COLORS.white,
                  textTransform: 'uppercase' as const,
                  letterSpacing: 1,
                  whiteSpace: 'nowrap' as const,
                }}>
                  {stage.label}
                </span>
              </div>
            </RoughEdgeMask>

            {/* Value */}
            <span style={{
              fontFamily: 'Inter',
              fontSize: s(VOX_SIZES.body),
              fontWeight: highlighted ? 700 : 500,
              color: highlighted ? VOX_COLORS.charcoal : VOX_COLORS.darkGray,
              flexShrink: 0,
            }}>
              {stage.value}
            </span>
          </div>
        );
      })}

      <FilmGrain opacity={0.25} />
    </AbsoluteFill>
  );
};

export default VoxFunnel;
