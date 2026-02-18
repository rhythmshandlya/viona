import { FONT_PAIRS } from '../../fonts';
import type { LogoStingerProps } from './schema';

export const BACKGROUNDS = {
  dark: { bg: '#0B0F1A', text: '#FFFFFF', textMuted: 'rgba(255,255,255,0.4)' },
  light: { bg: '#F8F9FB', text: '#111827', textMuted: 'rgba(0,0,0,0.4)' },
} as const;

export function getConstants(props: LogoStingerProps) {
  return { FONTS: FONT_PAIRS[props.fontPair] };
}
