import { FONT_PAIRS } from '../../fonts';
import type { GuestIntroCardProps } from './schema';

export function getConstants(props: GuestIntroCardProps) {
  const isDark = props.background === 'dark';

  const COLORS = {
    primary: props.colors.primary,
    secondary: props.colors.secondary,
    accent: props.accentColor,
    background: isDark ? props.colors.background : '#FAFAFA',
    text: isDark ? props.colors.text : '#18181B',
    cardBg: isDark ? '#18181B' : '#FFFFFF',
    cardBorder: isDark ? '#27272A' : '#E4E4E7',
    subtleText: isDark ? '#A1A1AA' : '#71717A',
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
