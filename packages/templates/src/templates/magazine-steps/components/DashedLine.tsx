import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { MAGAZINE_COLORS } from '../../../magazine/constants';
import { magazineEasing } from '../../../magazine/animations';

export function DashedLine({ startY, endY }: { startY: number; endY: number }) {
  const frame = useCurrentFrame();
  const totalHeight = endY - startY;
  const drawProgress = interpolate(frame, [10, 40], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  const currentHeight = totalHeight * drawProgress;
  const dashCount = Math.ceil(currentHeight / 16);

  return (
    <div style={{
      position: 'absolute', left: 128, top: startY,
      width: 3, height: currentHeight, overflow: 'hidden',
    }}>
      {Array.from({ length: dashCount }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', left: 0, top: i * 16,
          width: 3, height: 8,
          backgroundColor: MAGAZINE_COLORS.accent,
          borderRadius: 1.5, opacity: 0.4,
        }} />
      ))}
    </div>
  );
}
