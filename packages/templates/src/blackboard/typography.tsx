import React from 'react';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS } from './constants';

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
        fontWeight: 600,
        color,
        lineHeight: 1.15,
        letterSpacing: '-0.025em',
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
        lineHeight: 1,
        ...style,
      }}
    >
      {text}
    </div>
  );
}
