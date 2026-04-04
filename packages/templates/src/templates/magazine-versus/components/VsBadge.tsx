import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { MAGAZINE_FONTS, MAGAZINE_COLORS } from '../../../magazine/constants';
import { magazineEasing } from '../../../magazine/animations';

export function VsBadge({ appearFrame }: { appearFrame: number }) {
  const frame = useCurrentFrame();

  const scale = interpolate(frame, [appearFrame, appearFrame + 15], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  const opacity = interpolate(frame, [appearFrame, appearFrame + 8], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <div style={{
      width: 120, height: 120, borderRadius: '50%',
      backgroundColor: MAGAZINE_COLORS.accent,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transform: `scale(${scale})`, opacity,
      boxShadow: '0 4px 24px rgba(225,29,72,0.4)',
    }}>
      <div style={{
        fontFamily: MAGAZINE_FONTS.headline, fontSize: 42,
        fontWeight: 900, color: '#ffffff', lineHeight: 1,
        letterSpacing: '-0.02em',
      }}>
        VS
      </div>
    </div>
  );
}
