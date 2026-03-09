import { FONT_PAIRS } from '../../fonts';
import type { TierBoardProps } from './schema';

export const TIER_COLORS: Record<string, string> = {
  S: '#FF7F7F',
  A: '#FFBF7F',
  B: '#FFFF7F',
  C: '#7FFF7F',
  D: '#7F7FFF',
};

export const BACKGROUNDS = {
  dark: { bg: '#0B0F1A', text: '#FFFFFF', textMuted: 'rgba(255,255,255,0.45)', rowBg: 'rgba(255,255,255,0.04)', itemBg: 'rgba(255,255,255,0.08)' },
  light: { bg: '#F8F9FB', text: '#111827', textMuted: 'rgba(0,0,0,0.45)', rowBg: 'rgba(0,0,0,0.03)', itemBg: 'rgba(0,0,0,0.06)' },
} as const;

export function getConstants(props: TierBoardProps) {
  return { FONTS: FONT_PAIRS[props.fontPair] };
}
