import { FONT_PAIRS } from '../../fonts';
import type { ChannelIntroProps } from './schema';

export const BACKGROUNDS = {
  dark: {
    bg: '#0B0F1A',
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    gridColor: 'rgba(255, 255, 255, 0.04)',
  },
  light: {
    bg: '#F8F9FB',
    text: '#111827',
    textMuted: 'rgba(0, 0, 0, 0.45)',
    gridColor: 'rgba(0, 0, 0, 0.04)',
  },
} as const;

export function getConstants(props: ChannelIntroProps) {
  const COLORS = {
    primary: props.colors.primary,
    secondary: props.colors.secondary,
    accent: props.colors.accent,
    background: props.colors.background,
    text: props.colors.text,
  };

  const FONTS = FONT_PAIRS[props.fontPair];

  const SPRING_CONFIG = {
    damping: 18,
    stiffness: 120,
    mass: 0.8,
  };

  return { COLORS, FONTS, SPRING_CONFIG };
}

export type TemplateConstants = ReturnType<typeof getConstants>;
