import { FONT_PAIRS } from '../../fonts';
import type { BeforeAfterRevealProps } from './schema';

export const BACKGROUNDS = {
  dark: { bg: '#0B0F1A', text: '#FFFFFF', textMuted: 'rgba(255,255,255,0.5)', cardBg: 'rgba(255,255,255,0.05)', divider: 'rgba(255,255,255,0.15)' },
  light: { bg: '#F8F9FB', text: '#111827', textMuted: 'rgba(0,0,0,0.45)', cardBg: 'rgba(0,0,0,0.03)', divider: 'rgba(0,0,0,0.12)' },
} as const;

export function getConstants(props: BeforeAfterRevealProps) {
  return { FONTS: FONT_PAIRS[props.fontPair] };
}
