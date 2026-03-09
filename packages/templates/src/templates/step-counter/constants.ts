import { FONT_PAIRS } from '../../fonts';
import type { StepCounterProps } from './schema';

export const BACKGROUNDS = {
  dark: {
    bg: '#0B0F1A',
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    gridColor: 'rgba(255, 255, 255, 0.04)',
    ringTrack: 'rgba(255, 255, 255, 0.08)',
    dotInactive: 'rgba(255, 255, 255, 0.15)',
    dotCompleted: 'rgba(255, 255, 255, 0.9)',
  },
  light: {
    bg: '#F8F9FB',
    text: '#111827',
    textMuted: 'rgba(0, 0, 0, 0.45)',
    gridColor: 'rgba(0, 0, 0, 0.04)',
    ringTrack: 'rgba(0, 0, 0, 0.08)',
    dotInactive: 'rgba(0, 0, 0, 0.12)',
    dotCompleted: 'rgba(0, 0, 0, 0.8)',
  },
} as const;

export function getConstants(props: StepCounterProps) {
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
