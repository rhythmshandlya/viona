import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxDefinitionProps } from './schema';
import { VOX_COLORS, VOX_SIZES } from '../../vox/constants';
import { voxEntrance, voxExit, voxIdle, typewriterReveal } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { VoxBody } from '../../vox/typography';
import { HighlighterStroke } from '../../vox/decorations';
import { useScale } from '../../use-scale';

const VoxDefinition: React.FC<VoxDefinitionProps> = ({ term, definition, pronunciation }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const termEntrance = voxEntrance(frame, 8, undefined, 'up', s(30));
  const defEntrance = voxEntrance(frame, 20, undefined, 'up', s(20));
  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const idle = voxIdle(frame, 17);

  const termOpacity = termEntrance.opacity * exit.opacity;
  const termY = termEntrance.translateY + exit.translateY + idle.translateY;
  const defOpacity = defEntrance.opacity * exit.opacity;
  const defY = defEntrance.translateY + exit.translateY + idle.translateY;

  // Typewriter reveal for the term
  const { visibleChars } = typewriterReveal(frame, 8, term.length);
  const visibleTerm = term.slice(0, visibleChars);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: VOX_COLORS.deepPurple,
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: s(80),
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: s(24),
          maxWidth: s(900),
        }}
      >
        {/* Term */}
        <div
          style={{
            opacity: termOpacity,
            transform: `translateY(${termY}px)`,
            display: 'flex',
            flexDirection: 'column',
            gap: s(8),
          }}
        >
          {pronunciation && (
            <div
              style={{
                fontFamily: 'Inter',
                fontSize: s(VOX_SIZES.label),
                color: VOX_COLORS.medGray,
                letterSpacing: 1,
              }}
            >
              {pronunciation}
            </div>
          )}
          <div
            style={{
              fontFamily: 'Playfair Display',
              fontSize: s(VOX_SIZES.hero),
              fontWeight: 700,
              color: VOX_COLORS.white,
              lineHeight: 1.1,
            }}
          >
            {visibleTerm}
            <span style={{ opacity: visibleChars < term.length ? 1 : 0, color: VOX_COLORS.highlight }}>|</span>
          </div>
          <HighlighterStroke width={s(Math.min(term.length * 18, 600))} thickness={s(6)} />
        </div>

        {/* Definition */}
        <div
          style={{
            opacity: defOpacity,
            transform: `translateY(${defY}px)`,
          }}
        >
          <VoxBody
            text={definition}
            size={s(VOX_SIZES.body)}
            color={VOX_COLORS.lightGray}
            maxWidth={s(860)}
          />
        </div>
      </div>
      <FilmGrain opacity={0.3} />
    </AbsoluteFill>
  );
};

export default VoxDefinition;
