import { FONT_PAIRS } from '../../fonts';
import type { ProsConsProps } from './schema';

export const BACKGROUNDS: Record<
  string,
  { bg: string; text: string; textMuted: string; gridColor: string }
> = {
  dark: {
    bg: '#0B0F1A',
    text: '#FFFFFF',
    textMuted: '#94A3B8',
    gridColor: '#FFFFFF08',
  },
  light: {
    bg: '#F8FAFC',
    text: '#0F172A',
    textMuted: '#64748B',
    gridColor: '#0F172A08',
  },
};

export function getConstants(props: ProsConsProps) {
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

export type TemplateConstants = ReturnType<typeof getConstants>;
