import React from 'react';
import { interpolate } from 'remotion';

interface ConnectionLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  frame: number;
  startFrame: number;
  color: string;
  width?: number;
  viewportWidth: number;
  viewportHeight: number;
}

const ConnectionLine: React.FC<ConnectionLineProps> = ({
  x1,
  y1,
  x2,
  y2,
  frame,
  startFrame,
  color,
  width: lineWidth = 2,
  viewportWidth,
  viewportHeight,
}) => {
  if (frame < startFrame) return null;

  const localFrame = frame - startFrame;
  const DRAW_DURATION = 20;

  // Progress 0→1 as the line draws
  const progress = interpolate(localFrame, [0, DRAW_DURATION], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Calculate total line length for stroke-dasharray/dashoffset trick
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lineLength = Math.sqrt(dx * dx + dy * dy);

  // dashoffset animates from full length → 0 to "draw" the line progressively
  const dashOffset = lineLength * (1 - progress);

  return (
    <svg
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        overflow: 'visible',
        pointerEvents: 'none',
      }}
      width={viewportWidth}
      height={viewportHeight}
    >
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={lineWidth}
        strokeDasharray={`6 4`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        opacity={0.65}
      />
    </svg>
  );
};

export default ConnectionLine;
