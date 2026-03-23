import React from 'react';
import { BLACKBOARD_COLORS, BLACKBOARD_GLOW } from './constants';

export function GlowPanel({
  glowIntensity = 1,
  glowColor = 'primary',
  children,
  style,
}: {
  glowIntensity?: number;
  glowColor?: 'primary' | 'secondary';
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const glowValue = glowColor === 'primary' ? BLACKBOARD_GLOW.primary : BLACKBOARD_GLOW.secondary;

  return (
    <div
      style={{
        backgroundColor: BLACKBOARD_COLORS.surface,
        border: `1px solid ${BLACKBOARD_COLORS.surfaceBorder}`,
        borderRadius: 12,
        boxShadow: glowIntensity > 0 ? glowValue : 'none',
        opacity: glowIntensity > 0 ? 1 : 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function GlowBorder({
  glowIntensity = 1,
  glowColor = 'primary',
  borderRadius = 12,
  children,
  style,
}: {
  glowIntensity?: number;
  glowColor?: 'primary' | 'secondary';
  borderRadius?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const rgb = glowColor === 'primary' ? '245,158,11' : '6,182,212';
  const alpha = (0.3 * glowIntensity).toFixed(2);
  const spread = 8 + glowIntensity * 12;

  return (
    <div
      style={{
        border: `1px solid rgba(${rgb},${alpha})`,
        borderRadius,
        boxShadow: glowIntensity > 0
          ? `0 0 ${spread}px rgba(${rgb},${(0.15 * glowIntensity).toFixed(2)})`
          : 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function GlowCircle({
  size,
  glowIntensity = 1,
  glowColor = 'primary',
  children,
  style,
}: {
  size: number;
  glowIntensity?: number;
  glowColor?: 'primary' | 'secondary';
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const color = glowColor === 'primary' ? BLACKBOARD_COLORS.primary : BLACKBOARD_COLORS.secondary;
  const glowValue = glowColor === 'primary' ? BLACKBOARD_GLOW.primary : BLACKBOARD_GLOW.secondary;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: BLACKBOARD_COLORS.surface,
        border: `2px solid ${color}`,
        boxShadow: glowIntensity > 0 ? glowValue : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
