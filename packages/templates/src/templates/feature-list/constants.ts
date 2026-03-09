import { FONT_PAIRS } from '../../fonts';
import type { FeatureListProps } from './schema';

export const BACKGROUNDS: Record<
  string,
  { bg: string; text: string; textMuted: string; gridColor: string }
> = {
  dark: {
    bg: '#0B0F1A',
    text: '#FFFFFF',
    textMuted: '#94A3B8',
    gridColor: '#FFFFFF08',
  },
  light: {
    bg: '#F8FAFC',
    text: '#0F172A',
    textMuted: '#64748B',
    gridColor: '#0F172A08',
  },
};

export function getConstants(props: FeatureListProps) {
  const pair = FONT_PAIRS[props.fontPair];
  return { FONTS: { headline: pair.heading, body: pair.body } };
}
