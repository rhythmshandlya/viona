import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { MagazineTypewriterProps } from './schema';
import { editorialReveal, magazineEasing } from '../../magazine/animations';
import { MAGAZINE_COLORS, MAGAZINE_FONTS, FONT_SIZES } from '../../magazine/constants';
import { TypewriterPaper } from './components/TypewriterPaper';
import { TypewriterText, computeVisibleCharIndex, getCurrentTypingLine, isInPause } from './components/TypewriterText';
import { TypewriterCursor } from './components/TypewriterCursor';
import { ScaledContainer } from '../../magazine/ScaledContainer';

const CANVAS_W = 1080;

const MagazineTypewriter: React.FC<MagazineTypewriterProps> = (props) => {
  const frame = useCurrentFrame();
  const { lines, emphasis } = props;

  // ── Phase 1: Card reveal (0-15) ───────────────────────────────────
  const cardReveal = editorialReveal(frame, 0, 15);

  // ── Phase 2: Typing (15-100) ──────────────────────────────────────
  const visibleCharIndex = computeVisibleCharIndex(frame, lines, emphasis);
  const currentLine = getCurrentTypingLine(visibleCharIndex, lines);
  const paused = isInPause(frame, lines, emphasis);

  // ── Phase 3: Emphasis accent line draws in (100-118) ──────────────
  const accentLineWidth = interpolate(frame, [100, 118], [0, 200], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  // Cursor visible from frame 10
  const cursorOpacity = interpolate(frame, [10, 14], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Quotation mark reveal
  const quoteReveal = editorialReveal(frame, 3, 12);

  return (
    <ScaledContainer baseWidth={1080} baseHeight={1920}>
      {/* Large decorative quotation mark */}
      <div style={{
        position: 'absolute', left: 100, top: 240,
        fontFamily: MAGAZINE_FONTS.headline, fontSize: 200,
        color: MAGAZINE_COLORS.accent, opacity: quoteReveal.opacity * 0.15,
        lineHeight: 1,
        transform: `translateY(${quoteReveal.translateY}px)`,
      }}>
        {'\u201C'}
      </div>

      {/* Paper card */}
      <div style={{
        opacity: cardReveal.opacity,
        transform: `translateY(${cardReveal.translateY}px)`,
      }}>
        <TypewriterPaper translateY={0}>
          <TypewriterText
            lines={lines}
            emphasis={emphasis}
            visibleCharIndex={visibleCharIndex}
          />

          {/* Accent line under emphasis after typing */}
          <div style={{
            position: 'absolute', left: 120, bottom: 60,
            width: accentLineWidth, height: 3, borderRadius: 1.5,
            backgroundColor: MAGAZINE_COLORS.accent,
          }} />

          <div style={{ opacity: cursorOpacity }}>
            <TypewriterCursor
              lines={lines}
              emphasis={emphasis}
              visibleCharIndex={visibleCharIndex}
              frame={frame}
              isPaused={paused}
            />
          </div>
        </TypewriterPaper>
      </div>
    </ScaledContainer>
  );
};

export default MagazineTypewriter;
