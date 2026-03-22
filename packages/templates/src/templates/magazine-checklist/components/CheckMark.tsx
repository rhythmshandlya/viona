import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { MAGAZINE_COLORS } from '../../../magazine/constants';
import { magazineEasing } from '../../../magazine/animations';

export function CheckMark({
  appearFrame,
  checked,
}: {
  appearFrame: number;
  checked: boolean;
}) {
  const frame = useCurrentFrame();
  if (!checked || frame < appearFrame) return null;

  const scale = interpolate(frame, [appearFrame, appearFrame + 10], [1.4, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: magazineEasing,
  });
  const opacity = interpolate(frame, [appearFrame, appearFrame + 6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        backgroundColor: MAGAZINE_COLORS.stamp,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${scale})`,
        opacity,
        flexShrink: 0,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M4 9L7.5 12.5L14 5.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
