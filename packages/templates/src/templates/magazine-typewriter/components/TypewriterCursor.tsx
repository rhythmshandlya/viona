import React from 'react';
import { MAGAZINE_COLORS, FONT_SIZES } from '../../../magazine/constants';

interface TypewriterCursorProps {
  lines: string[];
  emphasis: number;
  visibleCharIndex: number;
  frame: number;
  isPaused: boolean;
}

const LINE_HEIGHT = 1.45;
const GAP = 44;
const PAD_LEFT = 120;
const PAD_TOP = 80;

/**
 * Thin cursor bar that tracks typing position.
 * Uses same layout constants as TypewriterText for alignment.
 * Blinks during pauses.
 */
export function TypewriterCursor({
  lines, emphasis, visibleCharIndex, frame, isPaused,
}: TypewriterCursorProps) {
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
  const fontSize = isEmphasis ? FONT_SIZES.h2 : FONT_SIZES.h3;
  const avgCharWidth = fontSize * 0.52;
  const cursorX = PAD_LEFT + cursorCharInLine * avgCharWidth;

  let cursorY = PAD_TOP;
  for (let i = 0; i < cursorLine; i++) {
    const lineFontSize = i === emphasis ? FONT_SIZES.h2 : FONT_SIZES.h3;
    cursorY += lineFontSize * LINE_HEIGHT + GAP;
  }

  const blinkCycle = Math.floor(frame / 15) % 2;
  const cursorOpacity = isPaused ? (blinkCycle === 0 ? 1 : 0.2) : 1;

  return (
    <div style={{
      position: 'absolute',
      left: cursorX,
      top: cursorY,
      width: 2.5,
      height: fontSize * LINE_HEIGHT,
      backgroundColor: MAGAZINE_COLORS.inkBlack,
      opacity: cursorOpacity,
      pointerEvents: 'none',
    }} />
  );
}
