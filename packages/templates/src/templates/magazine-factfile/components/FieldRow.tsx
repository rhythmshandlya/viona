import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../../magazine/constants';
import { magazineEasing } from '../../../magazine/animations';

export function FieldRow({
  fieldKey, value, index, revealFrame, width,
}: {
  fieldKey: string; value: string; index: number; revealFrame: number; width: number;
}) {
  const frame = useCurrentFrame();

  const keyOpacity = interpolate(frame, [revealFrame, revealFrame + 8], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  const valueStart = revealFrame + 4;
  const valueOpacity = interpolate(frame, [valueStart, valueStart + 8], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  const valueTranslateX = interpolate(frame, [valueStart, valueStart + 10], [20, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        width, padding: '12px 0',
      }}>
        <div style={{
          fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.small,
          fontWeight: 700, color: MAGAZINE_COLORS.secondary,
          letterSpacing: '0.1em', textTransform: 'uppercase', opacity: keyOpacity,
        }}>{fieldKey}</div>
        <div style={{
          fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.large,
          fontWeight: 700, color: MAGAZINE_COLORS.text,
          opacity: valueOpacity, transform: `translateX(${valueTranslateX}px)`,
          textAlign: 'right', maxWidth: '60%',
        }}>{value}</div>
      </div>
      <div style={{
        width: '100%', height: 1,
        backgroundColor: MAGAZINE_COLORS.secondary, opacity: 0.15,
      }} />
    </div>
  );
}
