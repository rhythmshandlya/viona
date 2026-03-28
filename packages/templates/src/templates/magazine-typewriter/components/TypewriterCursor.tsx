import React from 'react';
import { MAGAZINE_COLORS, FONT_SIZES } from '../../../magazine/constants';

interface TypewriterCursorProps {
  lines: string[];
  emphasis: number;
  visibleCharIndex: number;
  frame: number;
  isPaused: boolean;
}

/**
 * Thin vertical cursor bar (2px wide) that tracks the next-to-type character position.
 * Blinks (opacity toggles 1 <-> 0.3) every 15 frames during line pauses.
 */
export function TypewriterCursor({
  lines,
  emphasis,
  visibleCharIndex,
  frame,
  isPaused,
}: TypewriterCursorProps) {
  // Determine which line and character position the cursor is at
  let charCount = 0;
  let cursorLine = 0;
  let cursorCharInLine = 0;

  for (let i = 0; i < lines.length; i++) {
    if (visibleCharIndex < charCount + lines[i].length) {
      cursorLine = i;
      cursorCharInLine = visibleCharIndex - charCount;
      break;
    }
    charCount += lines[i].length;
    cursorLine = i;
    cursorCharInLine = lines[i].length;
  }

  const isEmphasis = cursorLine === emphasis;
  const fontSize = isEmphasis ? FONT_SIZES.h2 * 1.3 : FONT_SIZES.h3;

  // Approximate character width: use 0.55 of font size as average char width for serif fonts
  const avgCharWidth = fontSize * 0.55;
  const cursorX = 80 + cursorCharInLine * avgCharWidth;

  // Y position: 120px top padding + line index * (fontSize * lineHeight + gap)
  const lineHeight = 1.4;
  const gap = 40;
  let cursorY = 120;
  for (let i = 0; i < cursorLine; i++) {
    const lineFontSize = i === emphasis ? FONT_SIZES.h2 * 1.3 : FONT_SIZES.h3;
    cursorY += lineFontSize * lineHeight + gap;
  }

  // Blink during pauses: toggle opacity 1 <-> 0.3 every 15 frames
  const blinkCycle = Math.floor(frame / 15) % 2;
  const cursorOpacity = isPaused ? (blinkCycle === 0 ? 1 : 0.3) : 1;

  return (
    <div
      style={{
        position: 'absolute',
        left: cursorX,
        top: cursorY,
        width: 2,
        height: fontSize * lineHeight,
        backgroundColor: MAGAZINE_COLORS.inkBlack,
        opacity: cursorOpacity,
        pointerEvents: 'none',
      }}
    />
  );
}
