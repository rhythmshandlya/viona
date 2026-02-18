import { FONT_PAIRS } from '../../fonts';
import type { ProcessFlowProps } from './schema';

export const BACKGROUNDS = {
  dark: { bg: '#0B0F1A', text: '#FFFFFF', textMuted: 'rgba(255,255,255,0.45)', nodeBg: 'rgba(255,255,255,0.06)', nodeBorder: 'rgba(255,255,255,0.10)' },
  light: { bg: '#F8F9FB', text: '#111827', textMuted: 'rgba(0,0,0,0.45)', nodeBg: 'rgba(0,0,0,0.03)', nodeBorder: 'rgba(0,0,0,0.08)' },
} as const;

export function getConstants(props: ProcessFlowProps) {
  return { FONTS: FONT_PAIRS[props.fontPair] };
}
