import { FONT_PAIRS } from '../../fonts';
import type { TestimonialCardProps } from './schema';

export const BACKGROUNDS: Record<
  string,
  { bg: string; text: string; textMuted: string; gridColor: string }
> = {
  dark: {
    bg: '#0B0F1A',
    text: '#FFFFFF',
    textMuted: '#94A3B8',
    gridColor: 'rgba(255,255,255,0.03)',
  },
  light: {
    bg: '#F8FAFC',
    text: '#0F172A',
    textMuted: '#64748B',
    gridColor: 'rgba(15,23,42,0.03)',
  },
};

export function getConstants(props: TestimonialCardProps) {
  const pair = FONT_PAIRS[props.fontPair];
  return { FONTS: { headline: pair.heading, body: pair.body } };
}
