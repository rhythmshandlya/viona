import React from 'react';

interface CompassRoseProps {
  frame: number;
  size?: number;
  color?: string;
}

const CompassRose: React.FC<CompassRoseProps> = ({
  frame,
  size = 60,
  color = '#555555',
}) => {
  const rotation = frame * 0.1;
  const half = size / 2;

  return (
    <div
      style={{
        position: 'absolute',
        top: 20,
        right: 20,
        width: size,
        height: size,
        opacity: 0.6,
        pointerEvents: 'none',
        transform: `rotate(${rotation}deg)`,
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Outer circle */}
        <circle
          cx={half}
          cy={half}
          r={half - 2}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
        />
        {/* N-S line */}
        <line
          x1={half}
          y1={4}
          x2={half}
          y2={size - 4}
          stroke={color}
          strokeWidth={1}
        />
        {/* E-W line */}
        <line
          x1={4}
          y1={half}
          x2={size - 4}
          y2={half}
          stroke={color}
          strokeWidth={1}
        />
        {/* N label */}
        <text
          x={half}
          y={14}
          textAnchor="middle"
          fill={color}
          fontSize={10}
          fontWeight="bold"
        >
          N
        </text>
      </svg>
    </div>
  );
};

export default CompassRose;
