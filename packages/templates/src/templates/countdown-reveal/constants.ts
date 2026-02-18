import { FONT_PAIRS } from '../../fonts';
import type { CountdownRevealProps } from './schema';

export const BACKGROUNDS = {
  dark: {
    bg: '#0B0F1A',
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.45)',
    cardBg: 'rgba(255, 255, 255, 0.05)',
    cardBorder: 'rgba(255, 255, 255, 0.10)',
  },
  light: {
    bg: '#F8F9FB',
    text: '#111827',
    textMuted: 'rgba(0, 0, 0, 0.45)',
    cardBg: 'rgba(0, 0, 0, 0.03)',
    cardBorder: 'rgba(0, 0, 0, 0.08)',
  },
  gradient: {
    bg: 'linear-gradient(135deg, #0B0F1A 0%, #1E1B4B 50%, #0B0F1A 100%)',
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.45)',
    cardBg: 'rgba(255, 255, 255, 0.06)',
    cardBorder: 'rgba(255, 255, 255, 0.12)',
  },
} as const;

export function getConstants(props: CountdownRevealProps) {
  const FONTS = FONT_PAIRS[props.fontPair];
  return { FONTS };
}
