import { FONT_PAIRS } from '../../fonts';
import type { PathDrawRevealProps } from './schema';

export const BACKGROUNDS = {
  dark: {
    bg: '#0B0F1A',
    cardBg: 'rgba(255, 255, 255, 0.06)',
    cardBorder: 'rgba(255, 255, 255, 0.10)',
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.5)',
  },
  light: {
    bg: '#F8F9FB',
    cardBg: 'rgba(0, 0, 0, 0.03)',
    cardBorder: 'rgba(0, 0, 0, 0.08)',
    text: '#111827',
    textMuted: 'rgba(0, 0, 0, 0.45)',
  },
} as const;

export function getConstants(props: PathDrawRevealProps) {
  const COLORS = {
    primary: props.colors.primary,
    secondary: props.colors.secondary,
    accent: props.colors.accent,
    background: props.colors.background,
    text: props.colors.text,
  };

  const FONTS = FONT_PAIRS[props.fontPair];

  return { COLORS, FONTS, BACKGROUNDS: BACKGROUNDS[props.background] };
}
