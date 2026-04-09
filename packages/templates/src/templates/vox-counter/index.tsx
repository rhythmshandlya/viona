import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxCounterProps } from './schema';
import { VOX_COLORS, VOX_SIZES } from '../../vox/constants';
import { voxEntrance, voxExit, voxIdle, counterRoll, highlighterSweep } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { VoxBody, VoxLabel } from '../../vox/typography';
import { HighlighterStroke } from '../../vox/decorations';
import { useScale } from '../../use-scale';

const VoxCounter: React.FC<VoxCounterProps> = ({ target, unit, comparison, label }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const entrance = voxEntrance(frame, 5, undefined, 'up', s(40));
  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const idle = voxIdle(frame, 33);

  const combinedOpacity = entrance.opacity * exit.opacity;
  const combinedY = entrance.translateY + exit.translateY + idle.translateY;

  // Counter rolls from 0 to target over 50 frames
  const { displayValue } = counterRoll(frame, 8, 50, target);

  // Highlighter sweeps under the number
  const { widthPercent, rotation } = highlighterSweep(frame, 25);

  // Label and comparison fade in after number settles
  const labelOpacity = Math.min(1, Math.max(0, (frame - 65) / 15)) * combinedOpacity;
  const comparisonOpacity = Math.min(1, Math.max(0, (frame - 80) / 12)) * combinedOpacity;

  // Hero font size — very large
  const heroSize = s(120);

  return (
    <AbsoluteFill style={{
      backgroundColor: VOX_COLORS.deepPurple,
      justifyContent: 'center',
      alignItems: 'center',
      padding: s(60),
    }}>
      <ConstructionPaper color={VOX_COLORS.deepPurple} opacity={0.25} seed={21} />

      <div style={{
        opacity: combinedOpacity,
        transform: `translateY(${combinedY}px)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: s(16),
        textAlign: 'center',
        maxWidth: s(900),
      }}>
        {/* Giant counter + unit */}
        <div style={{ position: 'relative' }}>
          {/* Yellow highlighter under the number */}
          <div style={{
            position: 'absolute',
            bottom: s(-8),
            left: '50%',
            transform: 'translateX(-50%)',
          }}>
            <HighlighterStroke
              width={s(500) * (widthPercent / 100)}
              thickness={s(14)}
              rotation={rotation}
              color={VOX_COLORS.highlight}
            />
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: s(12),
          }}>
            <span style={{
              fontFamily: 'Inter',
              fontSize: heroSize,
              fontWeight: 700,
              color: VOX_COLORS.white,
              lineHeight: 0.9,
              letterSpacing: -2,
            }}>
              {displayValue}
            </span>
            {unit && (
              <span style={{
                fontFamily: 'Inter',
                fontSize: s(VOX_SIZES.h1),
                fontWeight: 600,
                color: VOX_COLORS.highlight,
                paddingBottom: s(8),
              }}>
                {unit}
              </span>
            )}
          </div>
        </div>

        {/* Label */}
        {label && (
          <div style={{ opacity: labelOpacity, marginTop: s(16) }}>
            <VoxBody
              text={label}
              color={VOX_COLORS.lightGray}
              size={s(VOX_SIZES.h3)}
            />
          </div>
        )}

        {/* Comparison / context */}
        {comparison && (
          <div style={{ opacity: comparisonOpacity, marginTop: s(8) }}>
            <VoxBody
              text={comparison}
              color={VOX_COLORS.medGray}
              size={s(VOX_SIZES.body)}
            />
          </div>
        )}
      </div>

      <FilmGrain opacity={0.3} />
    </AbsoluteFill>
  );
};

export default VoxCounter;
