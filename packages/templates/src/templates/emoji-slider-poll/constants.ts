import { FONT_PAIRS } from '../../fonts';
import type { EmojiSliderPollProps } from './schema';

export const BACKGROUNDS = {
  dark: {
    bg: '#0B0F1A',
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    trackBg: 'rgba(255, 255, 255, 0.10)',
    trackBorder: 'rgba(255, 255, 255, 0.15)',
    gridColor: 'rgba(255, 255, 255, 0.04)',
  },
  light: {
    bg: '#F8F9FB',
    text: '#111827',
    textMuted: 'rgba(0, 0, 0, 0.45)',
    trackBg: 'rgba(0, 0, 0, 0.06)',
    trackBorder: 'rgba(0, 0, 0, 0.10)',
    gridColor: 'rgba(0, 0, 0, 0.04)',
  },
} as const;

export function getConstants(props: EmojiSliderPollProps) {
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
