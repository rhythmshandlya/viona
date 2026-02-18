import { FONT_PAIRS } from '../../fonts';
import type { QrCodeRevealProps } from './schema';

export const BACKGROUNDS = {
  dark: {
    bg: '#0B0F1A',
    frameBorder: 'rgba(255, 255, 255, 0.15)',
    frameBg: 'rgba(255, 255, 255, 0.03)',
    cellOn: '#FFFFFF',
    cellOff: 'transparent',
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    gridColor: 'rgba(255, 255, 255, 0.04)',
  },
  light: {
    bg: '#F8F9FB',
    frameBorder: 'rgba(0, 0, 0, 0.12)',
    frameBg: '#FFFFFF',
    cellOn: '#111827',
    cellOff: 'transparent',
    text: '#111827',
    textMuted: 'rgba(0, 0, 0, 0.45)',
    gridColor: 'rgba(0, 0, 0, 0.04)',
  },
} as const;

/** QR grid configuration */
export const QR_GRID_SIZE = 25;
export const QR_CELL_SIZE = 20;
export const QR_GAP = 1;

export function getConstants(props: QrCodeRevealProps) {
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
