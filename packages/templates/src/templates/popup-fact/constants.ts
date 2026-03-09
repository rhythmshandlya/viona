import { FONT_PAIRS } from '../../fonts';
import type { PopupFactProps } from './schema';

export const BACKGROUNDS: Record<
  string,
  { bg: string; text: string; textMuted: string; gridColor: string; cardBg: string; cardBorder: string }
> = {
  dark: {
    bg: '#0B0F1A',
    text: '#FFFFFF',
    textMuted: '#94A3B8',
    gridColor: 'rgba(255,255,255,0.03)',
    cardBg: 'rgba(30, 41, 59, 0.85)',
    cardBorder: 'rgba(255,255,255,0.08)',
  },
  light: {
    bg: '#F8FAFC',
    text: '#0F172A',
    textMuted: '#64748B',
    gridColor: 'rgba(15,23,42,0.03)',
    cardBg: 'rgba(255, 255, 255, 0.9)',
    cardBorder: 'rgba(0,0,0,0.08)',
  },
};

export function getConstants(props: PopupFactProps) {
  return { FONTS: FONT_PAIRS[props.fontPair] };
}
