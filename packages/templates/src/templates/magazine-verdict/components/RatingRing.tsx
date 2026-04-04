import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../../magazine/constants';
import { magazineEasing } from '../../../magazine/animations';

export function RatingRing({
  rating, ratingLabel, drawStart,
}: {
  rating: string; ratingLabel: string; drawStart: number;
}) {
  const frame = useCurrentFrame();
  const numericRating = parseFloat(rating) || 0;
  const fraction = Math.min(numericRating / 10, 1);

  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference * (1 - fraction);

  const drawProgress = interpolate(frame, [drawStart, drawStart + 25], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  const currentOffset = circumference - (circumference - targetOffset) * drawProgress;

  const displayNum = interpolate(frame, [drawStart, drawStart + 20], [0, numericRating], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const displayRating = displayNum.toFixed(1);

  const ratingOpacity = interpolate(frame, [drawStart, drawStart + 8], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      opacity: ratingOpacity,
    }}>
      <div style={{ position: 'relative', width: 200, height: 200 }}>
        <svg width={200} height={200} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={100} cy={100} r={radius}
            fill="none" stroke={MAGAZINE_COLORS.secondary} strokeWidth={6} opacity={0.15} />
          <circle cx={100} cy={100} r={radius}
            fill="none" stroke={MAGAZINE_COLORS.accent} strokeWidth={6}
            strokeDasharray={circumference} strokeDashoffset={currentOffset}
            strokeLinecap="round" />
        </svg>
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.display,
            fontWeight: 900, color: MAGAZINE_COLORS.text, lineHeight: 1,
          }}>
            {displayRating}
          </div>
          <div style={{
            fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.caption,
            color: MAGAZINE_COLORS.secondary, letterSpacing: '0.08em',
            textTransform: 'uppercase', marginTop: 4,
          }}>
            {ratingLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
