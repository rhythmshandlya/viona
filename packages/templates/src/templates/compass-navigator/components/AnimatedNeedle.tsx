import React from 'react';

interface AnimatedNeedleProps {
  size: number;
  rotation: number;
  accentColor: string;
}

/**
 * A compass needle SVG: red/accent north half, white south half.
 * Rotated via CSS transform to point at the computed bearing.
 */
const AnimatedNeedle: React.FC<AnimatedNeedleProps> = ({
  size,
  rotation,
  accentColor,
}) => {
  const center = size / 2;
  const needleLength = size * 0.35;
  const needleWidth = size * 0.04;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: size,
        height: size,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: '50% 50%',
        pointerEvents: 'none',
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Shadow for depth */}
        <polygon
          points={`
            ${center},${center - needleLength}
            ${center + needleWidth},${center}
            ${center},${center + needleLength}
            ${center - needleWidth},${center}
          `}
          fill="rgba(0,0,0,0.1)"
          transform={`translate(2, 2)`}
        />
        {/* North half (accent/red) */}
        <polygon
          points={`
            ${center},${center - needleLength}
            ${center + needleWidth},${center}
            ${center - needleWidth},${center}
          `}
          fill={accentColor}
          stroke="#333"
          strokeWidth={0.5}
        />
        {/* South half (white) */}
        <polygon
          points={`
            ${center},${center + needleLength}
            ${center + needleWidth},${center}
            ${center - needleWidth},${center}
          `}
          fill="#EDEDED"
          stroke="#333"
          strokeWidth={0.5}
        />
        {/* Center pivot */}
        <circle
          cx={center}
          cy={center}
          r={needleWidth * 1.5}
          fill="#555"
          stroke="#333"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
};

export default AnimatedNeedle;
