import { FONT_PAIRS } from '../../fonts';
import type { CreditsRollProps } from './schema';

export const BACKGROUNDS = {
  dark: { bg: '#0A0A0A', text: '#FFFFFF', textMuted: 'rgba(255,255,255,0.5)' },
  light: { bg: '#F5F5F5', text: '#111111', textMuted: 'rgba(0,0,0,0.5)' },
} as const;

export function getConstants(props: CreditsRollProps) {
  const COLORS = {
    primary: props.colors.primary,
    secondary: props.colors.secondary,
    accent: props.colors.accent,
    background: props.colors.background,
    text: props.colors.text,
  };

  const FONTS = FONT_PAIRS[props.fontPair];

  return { COLORS, FONTS };
}

export type TemplateConstants = ReturnType<typeof getConstants>;
