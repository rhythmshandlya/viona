import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

interface TypeWriterProps {
  /** Text to type out */
  text: string;
  /** Frame when typing starts */
  startFrame?: number;
  /** Frames per character (default: 2) */
  framesPerChar?: number;
  /** Show cursor (default: true) */
  showCursor?: boolean;
  /** Cursor character (default: '|') */
  cursorChar?: string;
  /** Cursor blink speed in fps cycles (default: 15) */
  cursorBlinkSpeed?: number;
  /** Font size multiplier (default: 1) */
  fontSize?: number;
  /** Text color */
  color?: string;
  /** Font family */
  fontFamily?: string;
  /** Monospace styling (default: true for code-like effect) */
  monospace?: boolean;
}

/**
 * TypeWriter - Animated text typing effect
 *
 * Types out text character by character with optional cursor.
 * Great for code examples, terminal output, or dramatic reveals.
 *
 * @example
 * <TypeWriter
 *   text="Hello, World!"
 *   startFrame={30}
 *   framesPerChar={3}
 *   showCursor
 * />
 */
export const TypeWriter: React.FC<TypeWriterProps> = ({
  text,
  startFrame = 0,
  framesPerChar = 2,
  showCursor = true,
  cursorChar = '|',
  cursorBlinkSpeed = 15,
  fontSize = 1,
  color = '#ffffff',
  fontFamily,
  monospace = true,
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();

  const localFrame = Math.max(0, frame - startFrame);
  const totalChars = text.length;

  // Calculate visible characters
  const visibleChars = Math.min(
    totalChars,
    Math.floor(localFrame / framesPerChar)
  );

  const displayText = text.slice(0, visibleChars);

  // Cursor blink
  const cursorVisible = showCursor && Math.floor(frame / cursorBlinkSpeed) % 2 === 0;

  // Cursor only shows during typing or after
  const showCursorNow = showCursor && frame >= startFrame && (
    visibleChars < totalChars || cursorVisible
  );

  const textSize = height * 0.035 * fontSize;
  const effectiveFontFamily = fontFamily || (monospace
    ? "'SF Mono', 'Fira Code', 'Consolas', monospace"
    : "system-ui, -apple-system, sans-serif");

  return (
    <span
      style={{
        fontFamily: effectiveFontFamily,
        fontSize: textSize,
        color,
        whiteSpace: 'pre-wrap',
      }}
    >
      {displayText}
      {showCursorNow && (
        <span
          style={{
            opacity: cursorVisible || visibleChars < totalChars ? 1 : 0,
            color,
          }}
        >
          {cursorChar}
        </span>
      )}
    </span>
  );
};

export default TypeWriter;
