import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxQuoteProps } from './schema';
import { VOX_COLORS, VOX_SIZES } from '../../vox/constants';
import { voxEntrance, voxExit, voxIdle } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { useScale } from '../../use-scale';

const VoxQuote: React.FC<VoxQuoteProps> = ({ quote, speaker, title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const quoteEntrance = voxEntrance(frame, 8, undefined, 'up', s(30));
  const attrEntrance = voxEntrance(frame, 22, undefined, 'up', s(20));
  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const idle = voxIdle(frame, 33);

  const quoteOpacity = quoteEntrance.opacity * exit.opacity;
  const quoteY = quoteEntrance.translateY + exit.translateY + idle.translateY;
  const attrOpacity = attrEntrance.opacity * exit.opacity;
  const attrY = attrEntrance.translateY + exit.translateY + idle.translateY;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: VOX_COLORS.offWhite,
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: s(80),
      }}
    >
      <ConstructionPaper color={VOX_COLORS.offWhite} opacity={0.35} seed={11} />

      {/* Yellow accent bar on left */}
      <div
        style={{
          position: 'absolute',
          left: s(40),
          top: '50%',
          transform: 'translateY(-50%)',
          width: s(6),
          height: s(320),
          backgroundColor: VOX_COLORS.highlight,
          borderRadius: s(3),
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: s(32),
          maxWidth: s(860),
          paddingLeft: s(40),
        }}
      >
        {/* Quote */}
        <div
          style={{
            opacity: quoteOpacity,
            transform: `translateY(${quoteY}px)`,
          }}
        >
          <div
            style={{
              fontFamily: 'Playfair Display',
              fontSize: s(VOX_SIZES.h2),
              fontWeight: 700,
              color: VOX_COLORS.charcoal,
              lineHeight: 1.4,
              fontStyle: 'italic',
            }}
          >
            <span style={{ color: VOX_COLORS.highlight, fontSize: s(VOX_SIZES.hero), lineHeight: 0, verticalAlign: 'sub', marginRight: s(4) }}>&ldquo;</span>
            {quote}
            <span style={{ color: VOX_COLORS.highlight, fontSize: s(VOX_SIZES.hero), lineHeight: 0, verticalAlign: 'sub', marginLeft: s(4) }}>&rdquo;</span>
          </div>
        </div>

        {/* Attribution */}
        <div
          style={{
            opacity: attrOpacity,
            transform: `translateY(${attrY}px)`,
            display: 'flex',
            flexDirection: 'column',
            gap: s(4),
          }}
        >
          <div
            style={{
              fontFamily: 'Inter',
              fontSize: s(VOX_SIZES.label),
              fontWeight: 600,
              color: VOX_COLORS.charcoal,
              letterSpacing: 0.5,
            }}
          >
            {speaker}
          </div>
          {title && (
            <div
              style={{
                fontFamily: 'Inter',
                fontSize: s(VOX_SIZES.tiny),
                color: VOX_COLORS.darkGray,
                textTransform: 'uppercase',
                letterSpacing: 1.5,
              }}
            >
              {title}
            </div>
          )}
        </div>
      </div>

      <FilmGrain opacity={0.3} />
    </AbsoluteFill>
  );
};

export default VoxQuote;
