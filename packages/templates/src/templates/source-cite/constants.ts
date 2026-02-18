import { FONT_PAIRS } from '../../fonts';
import type { SourceCiteProps } from './schema';

export const BACKGROUNDS = {
  dark: {
    bg: '#0B0F1A',
    cardBg: 'rgba(255, 255, 255, 0.05)',
    cardBorder: 'rgba(255, 255, 255, 0.08)',
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.45)',
    gridColor: 'rgba(255, 255, 255, 0.04)',
    badgeBg: 'rgba(255, 255, 255, 0.08)',
    badgeText: 'rgba(255, 255, 255, 0.6)',
  },
  light: {
    bg: '#F8F9FB',
    cardBg: 'rgba(0, 0, 0, 0.02)',
    cardBorder: 'rgba(0, 0, 0, 0.06)',
    text: '#111827',
    textMuted: 'rgba(0, 0, 0, 0.45)',
    gridColor: 'rgba(0, 0, 0, 0.04)',
    badgeBg: 'rgba(0, 0, 0, 0.06)',
    badgeText: 'rgba(0, 0, 0, 0.5)',
  },
} as const;

export function getConstants(props: SourceCiteProps) {
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
