import { FONT_PAIRS } from '../../fonts';
import type { AlertBannerProps } from './schema';

export const SEVERITY_COLORS = {
  info: '#3B82F6',
  warning: '#F59E0B',
  urgent: '#EF4444',
} as const;

export const BACKGROUNDS = {
  dark: { bg: '#0B0F1A', text: '#FFFFFF', gridColor: 'rgba(255,255,255,0.06)' },
  light: { bg: '#F8F9FB', text: '#111827', gridColor: 'rgba(0,0,0,0.06)' },
} as const;

export function getConstants(props: AlertBannerProps) {
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
