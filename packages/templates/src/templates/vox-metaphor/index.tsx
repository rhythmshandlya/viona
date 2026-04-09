import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxMetaphorProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS } from '../../vox/constants';
import { voxEntrance, voxExit, highlighterSweep } from '../../vox/animations';
import { FilmGrain, HighlighterMark } from '../../vox/effects';
import { VoxHeadline, VoxLabel } from '../../vox/typography';
import { useScale } from '../../use-scale';

const VoxMetaphor: React.FC<VoxMetaphorProps> = ({ concept, metaphor, revealValue, revealLabel }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };

  const conceptEntrance = voxEntrance(frame, 5, undefined, 'up', s(16));
  const metaphorEntrance = voxEntrance(frame, 12, undefined, 'up', s(32));
  const revealEntrance = voxEntrance(frame, 55, undefined, 'up', s(24));
  const revealLabelEntrance = voxEntrance(frame, 65, undefined, 'up', s(16));
  const { widthPercent, rotation } = highlighterSweep(frame, 58);

  return (
    <AbsoluteFill style={{
      backgroundColor: VOX_COLORS.deepPurple,
      justifyContent: 'center',
      alignItems: 'center',
      padding: s(80),
    }}>
      {/* Concept label at top */}
      <div style={{
        position: 'absolute',
        top: s(120),
        left: s(60),
        right: s(60),
        opacity: conceptEntrance.opacity * exit.opacity,
        transform: `translateY(${conceptEntrance.translateY + exit.translateY}px)`,
        textAlign: 'center' as const,
      }}>
        <span style={{
          fontFamily: VOX_FONTS.body,
          fontSize: s(VOX_SIZES.label),
          fontWeight: 600,
          color: 'rgba(255,255,255,0.5)',
          textTransform: 'uppercase' as const,
          letterSpacing: 2,
        }}>
          {concept}
        </span>
      </div>

      {/* Metaphor — large centered headline */}
      <div style={{
        opacity: metaphorEntrance.opacity * exit.opacity,
        transform: `translateY(${metaphorEntrance.translateY + exit.translateY}px)`,
        textAlign: 'center' as const,
        maxWidth: s(900),
      }}>
        <div style={{
          fontFamily: VOX_FONTS.headline,
          fontSize: s(VOX_SIZES.h1),
          fontWeight: 700,
          color: VOX_COLORS.white,
          lineHeight: 1.25,
          fontStyle: 'italic',
        }}>
          {metaphor}
        </div>
      </div>

      {/* Reveal value */}
      <div style={{
        position: 'absolute',
        bottom: s(280),
        left: s(60),
        right: s(60),
        opacity: revealEntrance.opacity * exit.opacity,
        transform: `translateY(${revealEntrance.translateY + exit.translateY}px)`,
        textAlign: 'center' as const,
      }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <HighlighterMark
            widthPercent={widthPercent}
            height={s(48)}
            rotation={rotation}
            color={VOX_COLORS.highlight}
            opacity={0.9}
          />
          <div style={{
            fontFamily: VOX_FONTS.body,
            fontSize: s(VOX_SIZES.h3),
            fontWeight: 700,
            color: VOX_COLORS.white,
            position: 'relative',
            zIndex: 1,
          }}>
            {revealValue}
          </div>
        </div>
      </div>

      {/* Reveal label */}
      {revealLabel && (
        <div style={{
          position: 'absolute',
          bottom: s(220),
          left: s(60),
          right: s(60),
          opacity: revealLabelEntrance.opacity * exit.opacity,
          transform: `translateY(${revealLabelEntrance.translateY + exit.translateY}px)`,
          textAlign: 'center' as const,
        }}>
          <span style={{
            fontFamily: VOX_FONTS.body,
            fontSize: s(VOX_SIZES.tiny),
            color: 'rgba(255,255,255,0.4)',
            textTransform: 'uppercase' as const,
            letterSpacing: 2,
            fontWeight: 500,
          }}>
            {revealLabel}
          </span>
        </div>
      )}

      <FilmGrain opacity={0.35} />
    </AbsoluteFill>
  );
};

export default VoxMetaphor;
