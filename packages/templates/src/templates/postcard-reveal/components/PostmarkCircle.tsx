import React from 'react';

interface PostmarkCircleProps {
  x: number;
  y: number;
  opacity: number;
  scale: number;
  color: string;
}

/**
 * Circular postmark overlay with double concentric circles,
 * "MAIL" text and a date string inside. Rotated 15deg for authenticity.
 * Semi-transparent ink effect.
 */
const PostmarkCircle: React.FC<PostmarkCircleProps> = ({
  x,
  y,
  opacity,
  scale,
  color,
}) => {
  const size = 90;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 38;
  const innerR = 32;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        opacity: opacity * 0.7,
        transform: `scale(${scale}) rotate(15deg)`,
        transformOrigin: 'center',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Outer circle */}
        <circle
          cx={cx}
          cy={cy}
          r={outerR}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
        />
        {/* Inner circle */}
        <circle
          cx={cx}
          cy={cy}
          r={innerR}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
        />

        {/* Horizontal lines through center */}
        <line
          x1={cx - innerR + 2}
          y1={cy - 5}
          x2={cx + innerR - 2}
          y2={cy - 5}
          stroke={color}
          strokeWidth={1}
        />
        <line
          x1={cx - innerR + 2}
          y1={cy + 5}
          x2={cx + innerR - 2}
          y2={cy + 5}
          stroke={color}
          strokeWidth={1}
        />

        {/* MAIL text */}
        <text
          x={cx}
          y={cy - 14}
          textAnchor="middle"
          fontSize={9}
          fill={color}
          fontFamily="sans-serif"
          fontWeight={700}
          letterSpacing={3}
        >
          MAIL
        </text>

        {/* Date text */}
        <text
          x={cx}
          y={cy + 3}
          textAnchor="middle"
          fontSize={8}
          fill={color}
          fontFamily="sans-serif"
          fontWeight={600}
        >
          2026.03.02
        </text>

        {/* City text */}
        <text
          x={cx}
          y={cy + 18}
          textAnchor="middle"
          fontSize={7}
          fill={color}
          fontFamily="sans-serif"
          fontWeight={400}
          letterSpacing={1}
        >
          TRANSIT
        </text>
      </svg>
    </div>
  );
};

export default PostmarkCircle;
