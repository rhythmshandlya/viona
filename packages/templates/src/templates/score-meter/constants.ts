import { FONT_PAIRS } from '../../fonts';
import type { ScoreMeterProps } from './schema';

export const BACKGROUNDS = {
  dark: {
    bg: '#0B0F1A',
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    gridColor: 'rgba(255, 255, 255, 0.04)',
    arcTrack: 'rgba(255, 255, 255, 0.08)',
    glowOpacity: 0.35,
  },
  light: {
    bg: '#F8F9FB',
    text: '#111827',
    textMuted: 'rgba(0, 0, 0, 0.45)',
    gridColor: 'rgba(0, 0, 0, 0.04)',
    arcTrack: 'rgba(0, 0, 0, 0.08)',
    glowOpacity: 0.2,
  },
} as const;

export function getConstants(props: ScoreMeterProps) {
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
