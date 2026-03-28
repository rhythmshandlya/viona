import React from 'react';
import { random } from 'remotion';

/**
 * Semi-transparent adhesive tape mark decoration.
 * Pure CSS — cream/yellow at 60% opacity with slight rotation.
 */
export function TapeMark({
  corner,
  seed,
}: {
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  seed: number;
}) {
  const rotation = (random(`tape-rot-${seed}`) - 0.5) * 30;
  const width = 60 + random(`tape-w-${seed}`) * 40;
  const height = 18 + random(`tape-h-${seed}`) * 8;

  const positionStyle: React.CSSProperties = {};
  switch (corner) {
    case 'top-left':
      positionStyle.top = -height / 3;
      positionStyle.left = -width / 4;
      break;
    case 'top-right':
      positionStyle.top = -height / 3;
      positionStyle.right = -width / 4;
      break;
    case 'bottom-left':
      positionStyle.bottom = -height / 3;
      positionStyle.left = -width / 4;
      break;
    case 'bottom-right':
      positionStyle.bottom = -height / 3;
      positionStyle.right = -width / 4;
      break;
  }

  return (
    <div
      style={{
        position: 'absolute',
        width,
        height,
        backgroundColor: 'rgba(240, 220, 160, 0.6)',
        transform: `rotate(${rotation}deg)`,
        borderRadius: 2,
        pointerEvents: 'none',
        zIndex: 10,
        ...positionStyle,
      }}
    />
  );
}
