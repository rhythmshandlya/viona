import React from 'react';
import { interpolate } from 'remotion';
import { MAGAZINE_COLORS, MAGAZINE_FONTS, FONT_SIZES } from '../../../magazine/constants';
import { InkBleedFilter } from '../../../magazine/effects';
import { magazineEasing } from '../../../magazine/animations';

interface RedactionBarProps {
  /** The text to reveal under the redaction */
  text: string;
  /** Current frame */
  frame: number;
  /** Frame at which this redaction starts revealing */
  revealStart: number;
  /** Duration of reveal animation in frames */
  revealDuration?: number;
  /** Unique index for deterministic filter IDs */
  index: number;
}

/**
 * Black rectangle over text that animates via clipPath to reveal text left-to-right.
 * Revealed text has InkBleedFilter applied.
 */
export function RedactionBar({
  text,
  frame,
  revealStart,
  revealDuration = 20,
  index,
}: RedactionBarProps) {
  const filterId = `dossier-redact-ink-${index}`;

  // Progress of the reveal: 0 = fully redacted, 1 = fully revealed
  const progress = interpolate(frame, [revealStart, revealStart + revealDuration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: magazineEasing,
  });

  // Redaction bar shrinks from right-to-left (covers less as progress grows)
  const barClip = `inset(0 0 0 ${progress * 100}%)`;

  // Revealed text appears left-to-right
  const textClip = `inset(0 ${(1 - progress) * 100}% 0 0)`;

  return (
    <div style={{ position: 'relative', minHeight: 36, marginBottom: 8 }}>
      {/* Invisible SVG filter definition */}
      <InkBleedFilter id={filterId} />

      {/* Revealed text (underneath) */}
      <div
        style={{
          fontFamily: MAGAZINE_FONTS.body,
          fontSize: FONT_SIZES.large,
          fontWeight: 400,
          color: MAGAZINE_COLORS.inkBlack,
          lineHeight: 1.5,
          clipPath: textClip,
          filter: `url(#${filterId})`,
          padding: '4px 8px',
        }}
      >
        {text}
      </div>

      {/* Black redaction bar (on top) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: MAGAZINE_COLORS.redaction,
          clipPath: barClip,
          borderRadius: 2,
        }}
      />
    </div>
  );
}
