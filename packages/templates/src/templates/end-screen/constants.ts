import { FONT_PAIRS } from '../../fonts';
import type { EndScreenProps } from './schema';

export const BACKGROUNDS = {
  dark: { bg: '#0F0F0F', text: '#FFFFFF', textMuted: 'rgba(255,255,255,0.5)' },
  light: { bg: '#F5F5F5', text: '#111111', textMuted: 'rgba(0,0,0,0.5)' },
} as const;

export function getConstants(props: EndScreenProps) {
  return { FONTS: FONT_PAIRS[props.fontPair] };
}
