import React from 'react';
import { interpolate, Easing } from 'remotion';
import { MAGAZINE_COLORS, MAGAZINE_FONTS, FONT_SIZES } from '../../../magazine/constants';
import { InkBleedFilter } from '../../../magazine/effects';

interface ClassificationStampProps {
  classification: string;
  frame: number;
  /** Frame at which the stamp slam begins */
  slamStart: number;
  /** Duration of slam animation in frames */
  slamDuration?: number;
}

/**
 * Red classification stamp that slams down with overshoot easing.
 * Scale goes from 1.3 -> 1.0 with overshoot, parent container shakes +/-3px for 2 frames.
 */
export function ClassificationStamp({
  classification,
  frame,
  slamStart,
  slamDuration = 25,
}: ClassificationStampProps) {
  const slamEnd = slamStart + slamDuration;
  const filterId = 'dossier-stamp-ink';

  // Scale: 1.3 -> 1.0 with overshoot easing
  const scale = interpolate(frame, [slamStart, slamEnd], [1.3, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.back(2.5)),
  });

  // Opacity: snap in immediately when slam starts
  const opacity = interpolate(frame, [slamStart, slamStart + 2], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Shake: +/-3px on the 2 frames right after slam contact
  // Contact happens roughly when scale crosses ~1.0 (around frame slamStart + slamDuration * 0.6)
  const contactFrame = slamStart + Math.round(slamDuration * 0.5);
  let shakeX = 0;
  let shakeY = 0;
  if (frame === contactFrame) {
    shakeX = 3;
    shakeY = -2;
  } else if (frame === contactFrame + 1) {
    shakeX = -3;
    shakeY = 2;
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '55%',
        left: '50%',
        transform: `translate(-50%, -50%) translate(${shakeX}px, ${shakeY}px) rotate(-12deg) scale(${scale})`,
        opacity,
        pointerEvents: 'none',
      }}
    >
      <InkBleedFilter id={filterId} />
      <div
        style={{
          fontFamily: MAGAZINE_FONTS.accent,
          fontSize: FONT_SIZES.h1,
          fontWeight: 700,
          color: MAGAZINE_COLORS.stamp,
          border: `4px solid ${MAGAZINE_COLORS.stamp}`,
          borderRadius: 4,
          padding: '12px 28px',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          filter: `url(#${filterId})`,
          opacity: 0.85,
        }}
      >
        {classification}
      </div>
    </div>
  );
}
