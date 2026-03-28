import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { MagazineTypewriterProps } from './schema';
import { paperSlide } from '../../magazine/animations';
import { MAGAZINE_COLORS } from '../../magazine/constants';
import { TypewriterPaper } from './components/TypewriterPaper';
import { TypewriterText, computeVisibleCharIndex, getCurrentTypingLine, isInPause } from './components/TypewriterText';
import { TypewriterCursor } from './components/TypewriterCursor';

const MagazineTypewriter: React.FC<MagazineTypewriterProps> = (props) => {
  const frame = useCurrentFrame();
  const { lines, emphasis } = props;

  // ── Phase 1: Paper slide in + cursor appears (0-15) ─────────────────────
  const slide = paperSlide(frame, 0, 15, 'up');

  // ── Phase 2: Typing (15-100) ────────────────────────────────────────────
  const visibleCharIndex = computeVisibleCharIndex(frame, lines, emphasis);
  const currentLine = getCurrentTypingLine(visibleCharIndex, lines);
  const paused = isInPause(frame, lines, emphasis);

  // Paper scrolls up as lines complete — shift up per completed line
  const lineScrollOffset = (() => {
    if (frame < 15) return 0;
    // Scroll by ~100px per completed line to keep text centered
    const completedLines = currentLine;
    return interpolate(completedLines, [0, lines.length - 1], [0, -120 * (lines.length - 1)], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  })();

  // ── Phase 3: Hold + emphasis underline draws in (100-130) ───────────────
  const underlineProgress = interpolate(frame, [100, 120], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Phase 4: Paper scrolls up and out, opacity fades (130-150) ──────────
  const exitTranslateY = interpolate(frame, [130, 150], [0, -2000], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exitOpacity = interpolate(frame, [130, 150], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Combined paper translateY
  const paperTranslateY = slide.translateY + lineScrollOffset + exitTranslateY;

  // Combined opacity: entry fade during phase 1, exit fade during phase 4
  const combinedOpacity = frame < 130 ? slide.opacity : exitOpacity;

  // Cursor visibility: show from frame 5 onwards, hide during exit
  const cursorOpacity = interpolate(frame, [5, 10, 130, 140], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Compute emphasis underline position
  const emphasisUnderline = (() => {
    if (underlineProgress <= 0 || emphasis < 0 || emphasis >= lines.length) return null;

    // Calculate Y position of emphasis line
    const emphasisFontSize = 39 * 1.3; // FONT_SIZES.h2 * 1.3
    const normalFontSize = 31; // FONT_SIZES.h3
    const lineHeight = 1.4;
    const gap = 40;

    let y = 120; // top padding
    for (let i = 0; i < emphasis; i++) {
      y += normalFontSize * lineHeight + gap;
    }
    y += emphasisFontSize * lineHeight + 4; // below the text

    // Approximate line width
    const lineWidth = lines[emphasis].length * emphasisFontSize * 0.55;
    const drawWidth = lineWidth * underlineProgress;

    return (
      <div
        style={{
          position: 'absolute',
          left: 80,
          top: y,
          width: drawWidth,
          height: 3,
          backgroundColor: MAGAZINE_COLORS.accent,
        }}
      />
    );
  })();

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          opacity: combinedOpacity,
        }}
      >
        <TypewriterPaper
          translateY={paperTranslateY}
          lineCount={lines.length}
        >
          <TypewriterText
            lines={lines}
            emphasis={emphasis}
            visibleCharIndex={visibleCharIndex}
          />
          {emphasisUnderline}
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
    </AbsoluteFill>
  );
};

export default MagazineTypewriter;
