import { FONT_PAIRS } from '../../fonts';
import type { FollowerMilestoneProps } from './schema';

export const BACKGROUNDS = {
  dark: {
    bg: '#0A0A1A',
    text: '#FFFFFF',
    textMuted: 'rgba(255,255,255,0.6)',
    gridColor: 'rgba(255,255,255,0.06)',
    glowBase: 'rgba(236,72,153,0.25)',
  },
  light: {
    bg: '#F8F9FA',
    text: '#1A1A2E',
    textMuted: 'rgba(26,26,46,0.5)',
    gridColor: 'rgba(0,0,0,0.06)',
    glowBase: 'rgba(236,72,153,0.2)',
  },
} as const;

export function getConstants(props: FollowerMilestoneProps) {
  const COLORS = {
    primary: props.colors.primary,
    secondary: props.colors.secondary,
    accent: props.colors.accent,
    background: props.colors.background,
    text: props.colors.text,
  };

  const FONTS = FONT_PAIRS[props.fontPair];

  return { COLORS, FONTS };
}

export type TemplateConstants = ReturnType<typeof getConstants>;
