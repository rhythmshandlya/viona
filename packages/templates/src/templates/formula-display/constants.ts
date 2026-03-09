import { FONT_PAIRS } from '../../fonts';
import type { FormulaDisplayProps } from './schema';

export const BACKGROUNDS = {
  dark: {
    bg: '#0B0F1A',
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    gridColor: 'rgba(255, 255, 255, 0.04)',
    containerBg: 'rgba(255, 255, 255, 0.04)',
    containerBorder: 'rgba(255, 255, 255, 0.08)',
    bulletColor: 'rgba(255, 255, 255, 0.3)',
  },
  light: {
    bg: '#F8F9FB',
    text: '#111827',
    textMuted: 'rgba(0, 0, 0, 0.45)',
    gridColor: 'rgba(0, 0, 0, 0.04)',
    containerBg: 'rgba(0, 0, 0, 0.03)',
    containerBorder: 'rgba(0, 0, 0, 0.08)',
    bulletColor: 'rgba(0, 0, 0, 0.25)',
  },
} as const;

export function getConstants(props: FormulaDisplayProps) {
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
