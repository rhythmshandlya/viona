import { FONT_PAIRS } from '../../fonts';
import type { AnimatedDiagramProps } from './schema';

export const BACKGROUNDS = {
  dark: {
    bg: '#0B0F1A',
    nodeBg: 'rgba(255, 255, 255, 0.06)',
    nodeBorder: 'rgba(255, 255, 255, 0.10)',
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    lineColor: 'rgba(255, 255, 255, 0.15)',
  },
  light: {
    bg: '#F8F9FB',
    nodeBg: 'rgba(0, 0, 0, 0.03)',
    nodeBorder: 'rgba(0, 0, 0, 0.08)',
    text: '#111827',
    textMuted: 'rgba(0, 0, 0, 0.45)',
    lineColor: 'rgba(0, 0, 0, 0.12)',
  },
} as const;

export function getConstants(props: AnimatedDiagramProps) {
  const COLORS = {
    primary: props.colors.primary,
    secondary: props.colors.secondary,
    accent: props.colors.accent,
    background: props.colors.background,
    text: props.colors.text,
  };

  const FONTS = FONT_PAIRS[props.fontPair];

  return { COLORS, FONTS, BACKGROUNDS: BACKGROUNDS[props.background] };
}
