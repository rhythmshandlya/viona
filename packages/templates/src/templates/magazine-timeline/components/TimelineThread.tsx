import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { MAGAZINE_COLORS } from '../../../magazine/constants';
import { magazineEasing } from '../../../magazine/animations';

export function TimelineThread({
  startY, endY, nodeYPositions, nodeLandFrames,
}: {
  startY: number; endY: number; nodeYPositions: number[]; nodeLandFrames: number[];
}) {
  const frame = useCurrentFrame();
  const totalHeight = endY - startY;

  const drawProgress = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  const currentHeight = totalHeight * drawProgress;

  return (
    <>
      <div style={{
        position: 'absolute', left: 540 - 1.5, top: startY,
        width: 3, height: currentHeight,
        backgroundColor: MAGAZINE_COLORS.accent, borderRadius: 1.5,
      }} />
      {nodeYPositions.map((nodeY, i) => {
        const landFrame = nodeLandFrames[i];
        const nodeScale = interpolate(frame, [landFrame, landFrame + 8], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
        });
        if (frame < landFrame) return null;
        return (
          <div key={i} style={{
            position: 'absolute', left: 540 - 5, top: nodeY - 5,
            width: 10, height: 10, borderRadius: '50%',
            backgroundColor: MAGAZINE_COLORS.accent,
            transform: `scale(${nodeScale})`,
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          }} />
        );
      })}
    </>
  );
}
