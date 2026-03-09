import { FONT_PAIRS } from '../../fonts';
import type { DefinitionTooltipProps } from './schema';

export const BACKGROUNDS = {
  dark: {
    bg: '#0B0F1A',
    cardBg: '#141824',
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.45)',
    border: 'rgba(255, 255, 255, 0.06)',
    dotColor: 'rgba(255, 255, 255, 0.06)',
  },
  light: {
    bg: '#F8F9FB',
    cardBg: '#FFFFFF',
    text: '#111827',
    textMuted: 'rgba(0, 0, 0, 0.4)',
    border: 'rgba(0, 0, 0, 0.08)',
    dotColor: 'rgba(0, 0, 0, 0.06)',
  },
} as const;

export function getConstants(props: DefinitionTooltipProps) {
  const FONTS = FONT_PAIRS[props.fontPair];

  const SPRING_CONFIG = {
    damping: 18,
    stiffness: 120,
    mass: 0.8,
  };

  return { FONTS, SPRING_CONFIG };
}

export type TemplateConstants = ReturnType<typeof getConstants>;
