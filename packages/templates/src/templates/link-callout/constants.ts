import { FONT_PAIRS } from '../../fonts';
import type { LinkCalloutProps } from './schema';

export function getConstants(props: LinkCalloutProps) {
  const isDark = props.background === 'dark';

  const COLORS = {
    primary: props.colors.primary,
    secondary: props.colors.secondary,
    accent: props.colors.accent,
    background: isDark ? props.colors.background : '#F5F5F5',
    text: isDark ? props.colors.text : '#1A1A1A',
    dotColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    bubbleBg: isDark ? 'rgba(15,15,35,0.92)' : 'rgba(255,255,255,0.95)',
    bubbleBorder: props.accentColor,
  };

  const FONTS = FONT_PAIRS[props.fontPair];

  const SPRING_CONFIG = {
    damping: 14,
    stiffness: 120,
    mass: 0.8,
  };

  return { COLORS, FONTS, SPRING_CONFIG };
}

export type TemplateConstants = ReturnType<typeof getConstants>;
