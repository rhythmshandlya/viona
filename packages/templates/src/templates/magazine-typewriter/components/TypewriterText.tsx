import React from 'react';
import { random } from 'remotion';
import { MAGAZINE_COLORS, MAGAZINE_FONTS, FONT_SIZES } from '../../../magazine/constants';

interface TypewriterTextProps {
  lines: string[];
  emphasis: number;
  visibleCharIndex: number;
}

const LINE_HEIGHT = 1.45;
const GAP = 44;
const PAD_LEFT = 120;
const PAD_TOP = 80;

/**
 * Character-by-character typewriter text reveal with ink jitter.
 * Emphasis line uses headline font at larger size with accent color.
 */
export function TypewriterText({ lines, emphasis, visibleCharIndex }: TypewriterTextProps) {
  let globalIndex = 0;

  return (
    <div style={{ padding: `${PAD_TOP}px ${60}px ${40}px ${PAD_LEFT}px` }}>
      {lines.map((line, lineIndex) => {
        const lineStartIndex = globalIndex;
        globalIndex += line.length;
        const isEmphasis = lineIndex === emphasis;
        const fontSize = isEmphasis ? FONT_SIZES.h2 : FONT_SIZES.h3;
        const fontFamily = isEmphasis ? MAGAZINE_FONTS.headline : MAGAZINE_FONTS.accent;
        const fontWeight = isEmphasis ? 700 : 400;
        const color = isEmphasis ? MAGAZINE_COLORS.accent : MAGAZINE_COLORS.inkBlack;

        return (
          <div
            key={lineIndex}
            style={{
              fontFamily, fontSize, fontWeight, color,
              lineHeight: LINE_HEIGHT,
              letterSpacing: isEmphasis ? '-0.015em' : '0.005em',
              marginBottom: lineIndex < lines.length - 1 ? GAP : 0,
              position: 'relative',
              minHeight: fontSize * LINE_HEIGHT,
            }}
          >
            {line.split('').map((char, charIdx) => {
              const charGlobalIndex = lineStartIndex + charIdx;
              const isVisible = charGlobalIndex < visibleCharIndex;
              const jitterY = (random(`tw-${charGlobalIndex}`) * 1.6 - 0.8);

              return (
                <span
                  key={charIdx}
                  style={{
                    opacity: isVisible ? 1 : 0,
                    display: 'inline-block',
                    transform: `translateY(${jitterY}px)`,
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
      const charsTyped = Math.floor(elapsed / (baseFramesPerChar * weight));
      return charIndex + Math.min(charsTyped, line.length);
    }

    elapsed -= framesForLine;
    charIndex += line.length;

    if (lineIdx < lines.length - 1) {
      if (elapsed <= pauseFrames) return charIndex;
      elapsed -= pauseFrames;
    }
  }

  return totalChars;
}

/**
 * Returns which line is currently being typed.
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
