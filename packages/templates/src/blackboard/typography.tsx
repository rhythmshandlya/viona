import React from 'react';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS, BLACKBOARD_GLOW } from './constants';

export function GlowHeading({
  text,
  size,
  glowIntensity = 1,
  color = BLACKBOARD_COLORS.text,
  style,
}: {
  text: string;
  size: number;
  glowIntensity?: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        fontFamily: BLACKBOARD_FONTS.heading,
        fontSize: size,
        fontWeight: 700,
        color,
        lineHeight: 1.1,
        letterSpacing: '-0.02em',
        textShadow: glowIntensity > 0 ? BLACKBOARD_GLOW.textPrimary : 'none',
        ...style,
      }}
    >
      {text}
    </div>
  );
}

export function GlowLabel({
  text,
  size,
  color = BLACKBOARD_COLORS.textMuted,
  style,
}: {
  text: string;
  size: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        fontFamily: BLACKBOARD_FONTS.body,
        fontSize: size,
        fontWeight: 500,
        color,
        letterSpacing: '0.05em',
        textTransform: 'uppercase' as const,
        ...style,
      }}
    >
      {text}
    </div>
  );
}

export function DataValue({
  text,
  size,
  glowIntensity = 1,
  color = BLACKBOARD_COLORS.primary,
  style,
}: {
  text: string;
  size: number;
  glowIntensity?: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        fontFamily: BLACKBOARD_FONTS.mono,
        fontSize: size,
        fontWeight: 700,
        color,
        textShadow: glowIntensity > 0 ? BLACKBOARD_GLOW.textPrimary : 'none',
        ...style,
      }}
    >
      {text}
    </div>
  );
}
