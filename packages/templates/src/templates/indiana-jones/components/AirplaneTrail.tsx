import React from 'react';

interface AirplaneTrailProps {
  x: number;
  y: number;
  angle: number;
  size?: number;
  color?: string;
}

/**
 * Small airplane SVG icon that follows the dashed path tip.
 * Rotates to match the tangent angle of the bezier curve.
 */
const AirplaneTrail: React.FC<AirplaneTrailProps> = ({
  x,
  y,
  angle,
  size = 28,
  color = '#C0392B',
}) => {
  const angleDeg = (angle * 180) / Math.PI;

  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        transform: `rotate(${angleDeg}deg)`,
        pointerEvents: 'none',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
      >
        {/* Airplane silhouette facing right */}
        <path
          d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
          fill={color}
        />
      </svg>
    </div>
  );
};

export default AirplaneTrail;
