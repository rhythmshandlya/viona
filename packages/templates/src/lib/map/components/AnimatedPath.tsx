import React from 'react';
import { interpolate, Easing } from 'remotion';

interface AnimatedPathProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  frame: number;
  startFrame: number;
  endFrame: number;
  lineColor: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted' | 'glow';
  curveIntensity: number;
  width: number;
  height: number;
  /** Unique ID suffix for SVG masks when rendering multiple paths. Defaults to 'default'. */
  maskId?: string;
}

const AnimatedPath: React.FC<AnimatedPathProps> = ({
  x1,
  y1,
  x2,
  y2,
  frame,
  startFrame,
  endFrame,
  lineColor,
  lineWidth,
  lineStyle,
  curveIntensity,
  width,
  height,
  maskId = 'default',
}) => {
  const progress = interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // Compute perpendicular control point for the quadratic Bezier
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Perpendicular offset
  const offset = curveIntensity * dist * 0.4;
  // Normal vector (perpendicular to the line, pointing "up/left")
  const nx = dist > 0 ? -dy / dist : 0;
  const ny = dist > 0 ? dx / dist : 0;
  const cx = midX + nx * offset;
  const cy = midY + ny * offset;

  const d = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
  const drawMaskId = `draw-mask-${maskId}`;

  /** Compute strokeDasharray for different line styles */
  function getStrokeDasharray(): string | undefined {
    switch (lineStyle) {
      case 'dashed':
        return `${lineWidth * 3} ${lineWidth * 2}`;
      case 'dotted':
        return `2 8`;
      case 'glow':
      case 'solid':
      default:
        return undefined;
    }
  }

  return (
    <svg
      width={width}
      height={height}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
    >
      {/* Mask that progressively reveals the path */}
      <defs>
        <mask id={drawMaskId}>
          <path
            d={d}
            fill="none"
            stroke="white"
            strokeWidth={lineWidth + 4}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={1 - progress}
          />
        </mask>
      </defs>

      {/* Glow: extra wide semi-transparent stroke underneath */}
      {lineStyle === 'glow' && (
        <path
          d={d}
          fill="none"
          stroke={lineColor}
          strokeWidth={lineWidth * 3}
          strokeLinecap="round"
          mask={`url(#${drawMaskId})`}
          opacity={0.25}
        />
      )}

      <path
        d={d}
        fill="none"
        stroke={lineColor}
        strokeWidth={lineWidth}
        strokeLinecap="round"
        mask={`url(#${drawMaskId})`}
        strokeDasharray={getStrokeDasharray()}
      />
    </svg>
  );
};

export default AnimatedPath;
