import { FONT_PAIRS } from '../../fonts';
import type { ProductCardProps } from './schema';

export function getConstants(props: ProductCardProps) {
  const isDark = props.background === 'dark';

  const COLORS = {
    primary: props.colors.primary,
    secondary: props.colors.secondary,
    accent: props.accentColor,
    background: isDark ? props.colors.background : '#F5F5F7',
    text: isDark ? props.colors.text : '#1D1D1F',
    cardBg: isDark ? 'rgba(20, 20, 30, 0.85)' : 'rgba(255, 255, 255, 0.9)',
    cardBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
    subtextColor: isDark ? '#A0A0B0' : '#6E6E73',
    starFilled: '#FBBF24',
    starEmpty: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
    strikethrough: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.35)',
    dotColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
  };

  const FONTS = FONT_PAIRS[props.fontPair];

  const SPRING_CONFIG = {
    damping: 18,
    stiffness: 80,
    mass: 1,
  };

  return { COLORS, FONTS, SPRING_CONFIG };
}

export type TemplateConstants = ReturnType<typeof getConstants>;
