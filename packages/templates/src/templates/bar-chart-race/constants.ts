import { FONT_PAIRS } from '../../fonts';
import type { BarChartRaceProps } from './schema';

export const BACKGROUNDS = {
  dark: {
    bg: '#0B0F1A',
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    barTrack: 'rgba(255, 255, 255, 0.06)',
    gridLine: 'rgba(255, 255, 255, 0.08)',
  },
  light: {
    bg: '#F8F9FB',
    text: '#111827',
    textMuted: 'rgba(0, 0, 0, 0.45)',
    barTrack: 'rgba(0, 0, 0, 0.04)',
    gridLine: 'rgba(0, 0, 0, 0.08)',
  },
} as const;

export function getConstants(props: BarChartRaceProps) {
  const FONTS = FONT_PAIRS[props.fontPair];
  return { FONTS };
}
