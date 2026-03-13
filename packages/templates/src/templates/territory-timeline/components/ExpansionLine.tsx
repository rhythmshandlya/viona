import React from 'react';
import { interpolate } from 'remotion';

interface ExpansionLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  frame: number;
  startFrame: number;
  color: string;
  viewportWidth: number;
  viewportHeight: number;
}

const DRAW_DURATION = 30;

const ExpansionLine: React.FC<ExpansionLineProps> = ({
  x1,
  y1,
  x2,
  y2,
  frame,
  startFrame,
  color,
  viewportWidth,
  viewportHeight,
}) => {
  if (frame < startFrame) return null;

  // Progress from 0 to 1 over DRAW_DURATION frames
  const progress = interpolate(frame, [startFrame, startFrame + DRAW_DURATION], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Overall opacity
  const opacity = interpolate(frame, [startFrame, startFrame + 5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Use pathLength + strokeDashoffset technique to animate the dashed line drawing
  // pathLength = 1 normalizes the path length
  const dashOffset = 1 - progress;

  return (
    <svg
      width={viewportWidth}
      height={viewportHeight}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        opacity,
      }}
    >
      {/* Shadow/glow under the line */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.2}
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset={dashOffset}
      />
      {/* Main dashed line */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="0.04 0.02"
        pathLength={1}
        strokeDashoffset={dashOffset}
      />
    </svg>
  );
};

export default ExpansionLine;
