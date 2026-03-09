import { FONT_PAIRS } from '../../fonts';
import type { FactFlashProps } from './schema';

export const BACKGROUNDS = {
  dark: { bg: '#0B0F1A', text: '#FFFFFF', textMuted: 'rgba(255,255,255,0.5)' },
  light: { bg: '#F8F9FB', text: '#111827', textMuted: 'rgba(0,0,0,0.45)' },
  gradient: { bg: 'linear-gradient(135deg, #0B0F1A 0%, #1E1B4B 50%, #0B0F1A 100%)', text: '#FFFFFF', textMuted: 'rgba(255,255,255,0.5)' },
} as const;

export function getConstants(props: FactFlashProps) {
  return { FONTS: FONT_PAIRS[props.fontPair] };
}
