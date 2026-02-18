import React from 'react';
import { interpolate } from 'remotion';

interface TrendBadgeProps {
  direction: 'up' | 'down';
  value: string;
  frame: number;
  enterFrame: number;
  font: string;
}

const TrendBadge: React.FC<TrendBadgeProps> = ({
  direction,
  value,
  frame,
  enterFrame,
  font,
}) => {
  const opacity = interpolate(frame, [enterFrame, enterFrame + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const slideY = interpolate(frame, [enterFrame, enterFrame + 10], [8, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (frame < enterFrame) return null;

  const isUp = direction === 'up';
  const color = isUp ? '#10B981' : '#EF4444';
  const arrow = isUp ? '\u2191' : '\u2193';

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 20px',
        borderRadius: 100,
        background: `${color}18`,
        border: `1px solid ${color}30`,
        opacity,
        transform: `translateY(${slideY}px)`,
      }}
    >
      <span style={{ fontSize: 22, color }}>{arrow}</span>
      <span
        style={{
          fontFamily: font,
          fontSize: 22,
          fontWeight: 600,
          color,
        }}
      >
        {value}
      </span>
    </div>
  );
};

export default TrendBadge;
