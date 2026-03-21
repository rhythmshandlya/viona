import React from 'react';
import { random } from 'remotion';
import { MAGAZINE_COLORS, MAGAZINE_FONTS, FONT_SIZES } from '../../../magazine/constants';

interface TypewriterTextProps {
  lines: string[];
  emphasis: number;
  /** The global character index up to which text is visible. */
  visibleCharIndex: number;
}

/**
 * Character-by-character typewriter text reveal.
 *
 * Typing schedule algorithm:
 * 1. Total char count = sum of all line lengths
 * 2. Typing window = 85 frames (frame 15-100)
 * 3. Pause between lines = 8 frames
 * 4. Available typing frames = 85 - (pause * (lines.length - 1))
 * 5. Frames per char = available / total chars, emphasis line gets 1.3x multiplier
 * 6. For each frame, compute which char index is visible.
 */
export function TypewriterText({ lines, emphasis, visibleCharIndex }: TypewriterTextProps) {
  let globalIndex = 0;

  return (
    <div
      style={{
        padding: '120px 80px',
        display: 'flex',
        flexDirection: 'column',
        gap: 40,
      }}
    >
      {lines.map((line, lineIndex) => {
        const lineStartIndex = globalIndex;
        globalIndex += line.length;
        const isEmphasis = lineIndex === emphasis;

        const fontSize = isEmphasis ? FONT_SIZES.h2 * 1.3 : FONT_SIZES.h3;
        const fontFamily = isEmphasis ? MAGAZINE_FONTS.headline : MAGAZINE_FONTS.accent;
        const fontWeight = isEmphasis ? 700 : 400;

        return (
          <div
            key={lineIndex}
            style={{
              fontFamily,
              fontSize,
              fontWeight,
              color: MAGAZINE_COLORS.inkBlack,
              lineHeight: 1.4,
              letterSpacing: isEmphasis ? '-0.01em' : '0.01em',
              position: 'relative',
            }}
          >
            {line.split('').map((char, charIdx) => {
              const charGlobalIndex = lineStartIndex + charIdx;
              const isVisible = charGlobalIndex < visibleCharIndex;
              // Deterministic vertical jitter +/- 1px based on char index
              const jitterY = (random(`char-jitter-${charGlobalIndex}`) * 2 - 1);

              return (
                <span
                  key={charIdx}
                  style={{
                    opacity: isVisible ? 1 : 0,
                    display: 'inline-block',
                    transform: `translateY(${jitterY}px)`,
                    // Preserve spaces
                    whiteSpace: 'pre',
                  }}
                >
                  {char}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Computes the visible character index for a given frame using the typing schedule.
 */
export function computeVisibleCharIndex(
  frame: number,
  lines: string[],
  emphasis: number,
): number {
  const typingStart = 15;
  const typingEnd = 100;
  const typingWindow = typingEnd - typingStart;
  const pauseFrames = 8;
  const pauseCount = lines.length - 1;
  const availableTypingFrames = typingWindow - pauseFrames * pauseCount;

  const totalChars = lines.reduce((sum, line) => sum + line.length, 0);
  if (totalChars === 0) return 0;

  // Calculate weighted char counts (emphasis line gets 1.3x time multiplier)
  const weightedChars = lines.reduce((sum, line, i) => {
    const weight = i === emphasis ? 1.3 : 1.0;
    return sum + line.length * weight;
  }, 0);

  const baseFramesPerChar = availableTypingFrames / weightedChars;

  if (frame < typingStart) return 0;
  if (frame >= typingEnd) return totalChars;

  let elapsed = frame - typingStart;
  let charIndex = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const weight = lineIdx === emphasis ? 1.3 : 1.0;
    const framesForLine = line.length * baseFramesPerChar * weight;

    if (elapsed <= framesForLine) {
      // We're typing within this line
      const charsTyped = Math.floor(elapsed / (baseFramesPerChar * weight));
      return charIndex + Math.min(charsTyped, line.length);
    }

    elapsed -= framesForLine;
    charIndex += line.length;

    // Apply pause between lines (not after last line)
    if (lineIdx < lines.length - 1) {
      if (elapsed <= pauseFrames) {
        return charIndex; // In a pause — no new chars
      }
      elapsed -= pauseFrames;
    }
  }

  return totalChars;
}

/**
 * Returns which line is currently being typed (or -1 if not typing yet).
 */
export function getCurrentTypingLine(
  visibleCharIndex: number,
  lines: string[],
): number {
  let charCount = 0;
  for (let i = 0; i < lines.length; i++) {
    charCount += lines[i].length;
    if (visibleCharIndex <= charCount) return i;
  }
  return lines.length - 1;
}

/**
 * Returns whether the typewriter is in a pause between lines.
 */
export function isInPause(
  frame: number,
  lines: string[],
  emphasis: number,
): boolean {
  const typingStart = 15;
  const typingEnd = 100;
  const pauseFrames = 8;

  if (frame < typingStart || frame >= typingEnd) return false;

  const totalChars = lines.reduce((sum, line) => sum + line.length, 0);
  if (totalChars === 0) return false;

  const typingWindow = typingEnd - typingStart;
  const pauseCount = lines.length - 1;
  const availableTypingFrames = typingWindow - pauseFrames * pauseCount;

  const weightedChars = lines.reduce((sum, line, i) => {
    const weight = i === emphasis ? 1.3 : 1.0;
    return sum + line.length * weight;
  }, 0);

  const baseFramesPerChar = availableTypingFrames / weightedChars;

  let elapsed = frame - typingStart;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const weight = lineIdx === emphasis ? 1.3 : 1.0;
    const framesForLine = line.length * baseFramesPerChar * weight;

    if (elapsed <= framesForLine) return false;
    elapsed -= framesForLine;

    if (lineIdx < lines.length - 1) {
      if (elapsed <= pauseFrames) return true;
      elapsed -= pauseFrames;
    }
  }

  return false;
}
