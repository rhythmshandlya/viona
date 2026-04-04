import React from 'react';
import { BLACKBOARD_COLORS } from './constants';

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
  const glowRgba = glowColor === 'primary' ? '245,158,11' : '77,216,232';

  return (
    <div
      style={{
        backgroundColor: BLACKBOARD_COLORS.surface,
        borderRadius: 12,
        boxShadow: `0 0 ${12 * glowIntensity}px rgba(${glowRgba},0.1), 0 4px 20px rgba(0,0,0,0.4)`,
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
  return (
    <div
      style={{
        borderRadius,
        boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
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

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: BLACKBOARD_COLORS.surface,
        boxShadow: `0 0 8px ${color}40, 0 0 2px ${color}80, 0 2px 8px rgba(0,0,0,0.4)`,
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
