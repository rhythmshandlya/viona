import { FONT_PAIRS } from '../../fonts';
import type { TimelineCascadeProps } from './schema';

export const BACKGROUNDS = {
  dark: { bg: '#0B0F1A', text: '#FFFFFF', textMuted: 'rgba(255,255,255,0.45)', lineBg: 'rgba(255,255,255,0.08)' },
  light: { bg: '#F8F9FB', text: '#111827', textMuted: 'rgba(0,0,0,0.45)', lineBg: 'rgba(0,0,0,0.08)' },
} as const;

export function getConstants(props: TimelineCascadeProps) {
  return { FONTS: FONT_PAIRS[props.fontPair] };
}
