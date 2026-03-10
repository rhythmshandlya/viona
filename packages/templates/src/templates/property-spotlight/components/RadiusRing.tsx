import React from 'react';
import { spring, interpolate } from 'remotion';

interface RadiusRingProps {
  cx: number;
  cy: number;
  radiusPixels: number;
  label: string;
  frame: number;
  enterFrame: number;
  fps: number;
  color: string;
}

const RadiusRing: React.FC<RadiusRingProps> = ({
  cx,
  cy,
  radiusPixels,
  label,
  frame,
  enterFrame,
  fps,
  color,
}) => {
  const progress = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const scale = interpolate(progress, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const opacity = interpolate(progress, [0, 0.3], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (scale < 0.01) return null;

  const svgSize = (radiusPixels + 40) * 2;
  const svgCenter = svgSize / 2;
  const scaledRadius = radiusPixels * scale;

  // Label position on top of the ring
  const labelX = svgCenter;
  const labelY = svgCenter - scaledRadius - 6;

  return (
    <div
      style={{
        position: 'absolute',
        left: cx - svgSize / 2,
        top: cy - svgSize / 2,
        width: svgSize,
        height: svgSize,
        pointerEvents: 'none',
        opacity,
      }}
    >
      <svg width={svgSize} height={svgSize} style={{ position: 'absolute', inset: 0 }}>
        {/* Fill circle */}
        <circle
          cx={svgCenter}
          cy={svgCenter}
          r={scaledRadius}
          fill={color}
          fillOpacity={0.08}
          stroke={color}
          strokeWidth={2}
          strokeOpacity={0.4}
        />
        {/* Distance label */}
        {scale > 0.5 && (
          <>
            <rect
              x={labelX - 22}
              y={labelY - 14}
              width={44}
              height={18}
              rx={9}
              fill={color}
              fillOpacity={0.85}
            />
            <text
              x={labelX}
              y={labelY - 2}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize={11}
              fontWeight={600}
              fontFamily="Inter, sans-serif"
            >
              {label}
            </text>
          </>
        )}
      </svg>
    </div>
  );
};

export default RadiusRing;
