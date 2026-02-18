import { FONT_PAIRS } from '../../fonts';
import type { GlitchTransitionProps } from './schema';

export const BACKGROUNDS = {
  dark: {
    bg: '#050510',
    text: '#FFFFFF',
    textMuted: 'rgba(255,255,255,0.6)',
    gridColor: 'rgba(255,255,255,0.06)',
    scanLineColor: 'rgba(255,255,255,0.04)',
    flashColor: '#FFFFFF',
  },
  light: {
    bg: '#F0F0F5',
    text: '#0A0A0A',
    textMuted: 'rgba(0,0,0,0.5)',
    gridColor: 'rgba(0,0,0,0.06)',
    scanLineColor: 'rgba(0,0,0,0.04)',
    flashColor: '#FFFFFF',
  },
} as const;

export function getConstants(props: GlitchTransitionProps) {
  const COLORS = {
    primary: props.colors.primary,
    secondary: props.colors.secondary,
    accent: props.colors.accent,
    background: props.colors.background,
    text: props.colors.text,
  };

  const FONTS = FONT_PAIRS[props.fontPair];

  const SPRING_CONFIG = {
    damping: 22,
    stiffness: 90,
    mass: 0.9,
  };

  return { COLORS, FONTS, SPRING_CONFIG };
}

export type TemplateConstants = ReturnType<typeof getConstants>;
