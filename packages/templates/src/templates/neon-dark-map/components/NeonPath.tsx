import React from 'react';
import { interpolate, Easing } from 'remotion';
import { computeBezierControl } from '../../../lib/map';

interface NeonPathProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  frame: number;
  startFrame: number;
  endFrame: number;
  neonColor: string;
  lineWidth: number;
  glowIntensity: number;
  curveIntensity: number;
  width: number;
  height: number;
  maskId?: string;
}

const NeonPath: React.FC<NeonPathProps> = ({
  x1,
  y1,
  x2,
  y2,
  frame,
  startFrame,
  endFrame,
  neonColor,
  lineWidth,
  glowIntensity,
  curveIntensity,
  width,
  height,
  maskId = 'neon-default',
}) => {
  const progress = interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  const { cx, cy } = computeBezierControl(x1, y1, x2, y2, curveIntensity);

  const d = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
  const drawMaskId = `neon-draw-mask-${maskId}`;

  const outerWidth = lineWidth * 6;
  const midWidth = lineWidth * 3;

  return (
    <svg
      width={width}
      height={height}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
    >
      <defs>
        <mask id={drawMaskId}>
          <path
            d={d}
            fill="none"
            stroke="white"
            strokeWidth={outerWidth + 8}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={1 - progress}
          />
        </mask>
      </defs>

      {/* Layer 1: Outer glow — wide, faint, blurred */}
      <path
        d={d}
        fill="none"
        stroke={neonColor}
        strokeWidth={outerWidth}
        strokeLinecap="round"
        mask={`url(#${drawMaskId})`}
        opacity={0.15 * glowIntensity}
        style={{ filter: 'blur(8px)' }}
      />

      {/* Layer 2: Mid glow — medium width, moderate opacity, slight blur */}
      <path
        d={d}
        fill="none"
        stroke={neonColor}
        strokeWidth={midWidth}
        strokeLinecap="round"
        mask={`url(#${drawMaskId})`}
        opacity={0.4 * glowIntensity}
        style={{ filter: 'blur(3px)' }}
      />

      {/* Layer 3: Core line — narrow, fully opaque, crisp */}
      <path
        d={d}
        fill="none"
        stroke={neonColor}
        strokeWidth={lineWidth}
        strokeLinecap="round"
        mask={`url(#${drawMaskId})`}
        opacity={1}
      />
    </svg>
  );
};

export default NeonPath;
