import { FONT_PAIRS } from '../../fonts';
import type { PollBattleProps } from './schema';

export const BACKGROUNDS = {
  dark: { bg: '#0B0F1A', text: '#FFFFFF', textMuted: 'rgba(255,255,255,0.45)', trackBg: 'rgba(255,255,255,0.06)' },
  light: { bg: '#F8F9FB', text: '#111827', textMuted: 'rgba(0,0,0,0.45)', trackBg: 'rgba(0,0,0,0.04)' },
} as const;

export function getConstants(props: PollBattleProps) {
  return { FONTS: FONT_PAIRS[props.fontPair] };
}
