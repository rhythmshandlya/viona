import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { MAGAZINE_COLORS } from '../../../magazine/constants';
import { magazineEasing } from '../../../magazine/animations';

export function CenterDivider({ startY, endY }: { startY: number; endY: number }) {
  const frame = useCurrentFrame();
  const totalHeight = endY - startY;
  const drawProgress = interpolate(frame, [5, 20], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  const currentHeight = totalHeight * drawProgress;

  return (
    <div style={{
      position: 'absolute', left: 540 - 1.5, top: startY,
      width: 3, height: currentHeight,
      backgroundColor: MAGAZINE_COLORS.accent,
      borderRadius: 1.5, opacity: 0.6,
    }} />
  );
}
