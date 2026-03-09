import { FONT_PAIRS } from '../../fonts';
import type { SplitStatProps } from './schema';

export function getConstants(props: SplitStatProps) {
  const isDark = props.background === 'dark';

  const COLORS = {
    primary: props.colors.primary,
    secondary: props.colors.secondary,
    accent: props.colors.accent,
    background: isDark ? props.colors.background : '#F8FAFC',
    text: isDark ? props.colors.text : '#0F172A',
    subtleText: isDark ? '#64748B' : '#94A3B8',
    dividerLine: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
    dotColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
  };

  const FONTS = FONT_PAIRS[props.fontPair];

  return { COLORS, FONTS };
}

export type TemplateConstants = ReturnType<typeof getConstants>;
