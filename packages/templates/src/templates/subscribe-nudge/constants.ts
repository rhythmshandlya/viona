import { FONT_PAIRS } from '../../fonts';
import type { SubscribeNudgeProps } from './schema';

export const BACKGROUNDS = {
  dark: {
    bg: '#0B0F1A',
    cardBg: 'rgba(255, 255, 255, 0.08)',
    cardBorder: 'rgba(255, 255, 255, 0.12)',
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    gridColor: 'rgba(255, 255, 255, 0.04)',
  },
  light: {
    bg: '#F8F9FB',
    cardBg: 'rgba(0, 0, 0, 0.04)',
    cardBorder: 'rgba(0, 0, 0, 0.10)',
    text: '#111827',
    textMuted: 'rgba(0, 0, 0, 0.45)',
    gridColor: 'rgba(0, 0, 0, 0.04)',
  },
} as const;

export function getConstants(props: SubscribeNudgeProps) {
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
