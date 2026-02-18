import { FONT_PAIRS } from '../../fonts';
import type { AudienceQuestionProps } from './schema';

export const BACKGROUNDS = {
  dark: {
    bg: '#0B0F1A',
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.55)',
    questionMark: 'rgba(255, 255, 255, 0.06)',
    gridColor: 'rgba(255, 255, 255, 0.04)',
    frameBorder: 'rgba(255, 255, 255, 0.08)',
  },
  light: {
    bg: '#F8F9FB',
    text: '#111827',
    textMuted: 'rgba(0, 0, 0, 0.45)',
    questionMark: 'rgba(0, 0, 0, 0.04)',
    gridColor: 'rgba(0, 0, 0, 0.04)',
    frameBorder: 'rgba(0, 0, 0, 0.06)',
  },
} as const;

export function getConstants(props: AudienceQuestionProps) {
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
