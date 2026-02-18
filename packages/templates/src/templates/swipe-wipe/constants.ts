import { FONT_PAIRS } from '../../fonts';
import type { SwipeWipeProps } from './schema';

export const BACKGROUNDS = {
  dark: {
    bg: '#0A0A0A',
    text: '#FFFFFF',
    dotColor: 'rgba(255, 255, 255, 0.06)',
  },
  light: {
    bg: '#F5F5F5',
    text: '#0A0A0A',
    dotColor: 'rgba(0, 0, 0, 0.06)',
  },
} as const;

export function getConstants(props: SwipeWipeProps) {
  const palette = BACKGROUNDS[props.background];

  const COLORS = {
    primary: props.colors.primary,
    secondary: props.colors.secondary,
    accent: props.colors.accent,
    background: props.colors.background,
    text: props.colors.text,
    ...palette,
  };

  const FONTS = FONT_PAIRS[props.fontPair];

  const SPRING_CONFIG = {
    damping: 20,
    stiffness: 85,
    mass: 1,
  };

  return { COLORS, FONTS, SPRING_CONFIG };
}

export type TemplateConstants = ReturnType<typeof getConstants>;
