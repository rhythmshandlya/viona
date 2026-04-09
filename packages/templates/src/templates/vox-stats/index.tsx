import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxStatsProps } from './schema';
import { VOX_COLORS, VOX_SIZES } from '../../vox/constants';
import { voxEntrance, voxExit, voxIdle, counterRoll, highlighterSweep } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { VoxLabel, VoxBody } from '../../vox/typography';
import { HighlighterStroke } from '../../vox/decorations';
import { useScale } from '../../use-scale';

const VoxStats: React.FC<VoxStatsProps> = ({ value, numericValue, unit, context, title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const entrance = voxEntrance(frame, 8, undefined, 'up', s(30));
  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const idle = voxIdle(frame, 12);

  const combinedOpacity = entrance.opacity * exit.opacity;
  const combinedY = entrance.translateY + exit.translateY + idle.translateY;

  // Counter rolls from 0 to numericValue
  const { displayValue } = counterRoll(frame, 10, 60, numericValue);

  // Format display value with commas
  const formattedCounter = displayValue.toLocaleString();

  // Highlighter sweeps under the number after entrance
  const { widthPercent, rotation } = highlighterSweep(frame, 30);

  // Context line fades in later
  const contextOpacity = Math.min(1, Math.max(0, (frame - 80) / 12)) * combinedOpacity;

  return (
    <AbsoluteFill style={{
      backgroundColor: VOX_COLORS.deepPurple,
      justifyContent: 'center',
      alignItems: 'center',
      padding: s(60),
    }}>
      <ConstructionPaper color={VOX_COLORS.deepPurple} opacity={0.3} seed={9} />

      <div style={{
        opacity: combinedOpacity,
        transform: `translateY(${combinedY}px)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: s(20),
        maxWidth: s(900),
        textAlign: 'center',
      }}>
        {title && (
          <VoxLabel text={title} color={VOX_COLORS.lightGray} />
        )}

        {/* Hero counter number */}
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {/* Highlighter underline behind the number */}
          <div style={{
            position: 'absolute',
            bottom: s(-4),
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
          }}>
            <HighlighterStroke width={s(400) * (widthPercent / 100)} thickness={s(12)} rotation={rotation} />
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: s(8),
          }}>
            <span style={{
              fontFamily: 'Inter',
              fontSize: s(VOX_SIZES.hero),
              fontWeight: 700,
              color: VOX_COLORS.white,
              lineHeight: 1,
            }}>
              {formattedCounter}
            </span>
            {unit && (
              <span style={{
                fontFamily: 'Inter',
                fontSize: s(VOX_SIZES.h2),
                fontWeight: 500,
                color: VOX_COLORS.lightGray,
              }}>
                {unit}
              </span>
            )}
          </div>
        </div>

        {/* Static display value (shown when counter animation finishes) */}
        {frame > 75 && (
          <div style={{
            fontFamily: 'Inter',
            fontSize: s(VOX_SIZES.h1),
            fontWeight: 700,
            color: VOX_COLORS.white,
            lineHeight: 1,
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
          }}>
            {value}
          </div>
        )}

        {/* Context line */}
        {context && (
          <div style={{ opacity: contextOpacity, marginTop: s(8) }}>
            <VoxBody
              text={context}
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

export default VoxStats;
