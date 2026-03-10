import { FONT_PAIRS } from '../../fonts';
import type { WarmIntroProps } from './schema';

export const BACKGROUNDS = {
  light: {
    bg: '#F7F7F5',
    text: '#2D2D2D',
    textMuted: 'rgba(45, 45, 45, 0.6)',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
  },
  cream: {
    bg: '#FBF9F4',
    text: '#3D3530',
    textMuted: 'rgba(61, 53, 48, 0.55)',
    shadowColor: 'rgba(61, 53, 48, 0.06)',
  },
  soft: {
    bg: '#F5F3EE',
    text: '#383838',
    textMuted: 'rgba(56, 56, 56, 0.5)',
    shadowColor: 'rgba(0, 0, 0, 0.07)',
  },
} as const;

export function getConstants(props: WarmIntroProps) {
  const COLORS = {
    primary: props.colors.primary,
    secondary: props.colors.secondary,
    accent: props.colors.accent,
    background: props.colors.background,
    text: props.colors.text,
  };

  const FONTS = FONT_PAIRS[props.fontPair];

  // Gentle, friendly spring - not bouncy, just smooth
  const SPRING_CONFIG = {
    damping: 26,
    stiffness: 90,
    mass: 1,
  };

  return { COLORS, FONTS, SPRING_CONFIG };
}

export type TemplateConstants = ReturnType<typeof getConstants>;
