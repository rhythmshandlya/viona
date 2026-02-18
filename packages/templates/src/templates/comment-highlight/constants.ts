import { FONT_PAIRS } from '../../fonts';
import type { CommentHighlightProps } from './schema';

export const BACKGROUNDS: Record<
  string,
  { bg: string; text: string; textMuted: string; gridColor: string; cardBg: string; cardBorder: string }
> = {
  dark: {
    bg: '#0B0F1A',
    text: '#FFFFFF',
    textMuted: '#94A3B8',
    gridColor: 'rgba(255,255,255,0.03)',
    cardBg: '#1E293B',
    cardBorder: 'rgba(255,255,255,0.08)',
  },
  light: {
    bg: '#F8FAFC',
    text: '#0F172A',
    textMuted: '#64748B',
    gridColor: 'rgba(15,23,42,0.03)',
    cardBg: '#FFFFFF',
    cardBorder: 'rgba(15,23,42,0.1)',
  },
};

export function getConstants(props: CommentHighlightProps) {
  const pair = FONT_PAIRS[props.fontPair];

  const COLORS = {
    primary: props.colors.primary,
    secondary: props.colors.secondary,
    accent: props.colors.accent,
    background: props.colors.background,
    text: props.colors.text,
  };

  const FONTS = {
    headline: pair.headline,
    body: pair.body,
  };

  const SPRING_CONFIG = {
    damping: 18,
    stiffness: 120,
    mass: 0.8,
  };

  return { COLORS, FONTS, SPRING_CONFIG };
}

export type TemplateConstants = ReturnType<typeof getConstants>;
