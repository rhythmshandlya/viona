import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { MAGAZINE_COLORS } from '../../../magazine/constants';
import { magazineEasing } from '../../../magazine/animations';

export function DashedLine({ startY, endY, x }: { startY: number; endY: number; x: number }) {
  const frame = useCurrentFrame();
  const totalHeight = endY - startY;
  const drawProgress = interpolate(frame, [12, 45], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  const currentHeight = totalHeight * drawProgress;
  const dashCount = Math.ceil(currentHeight / 14);

  return (
    <div style={{
      position: 'absolute', left: x - 1, top: startY,
      width: 2, height: currentHeight, overflow: 'hidden',
    }}>
      {Array.from({ length: dashCount }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', left: 0, top: i * 14,
          width: 2, height: 7,
          backgroundColor: MAGAZINE_COLORS.accent,
          borderRadius: 1, opacity: 0.3,
        }} />
      ))}
    </div>
  );
}
