import type { CSSProperties } from 'react';

/** Shared color tokens for the playground UI */
export const t = {
  // Backgrounds
  bgPage: '#f8f8fa',
  bgPanel: '#ffffff',
  bgRaised: '#f0f0f4',
  bgInput: '#ffffff',

  // Borders
  border: '#e2e2e8',
  borderHover: '#c8c8d0',
  borderFocus: '#f97316',

  // Text
  text1: '#1a1a1f',
  text2: '#5c5c68',
  text3: '#8c8c98',
  textMuted: '#b0b0ba',

  // Accent (orange)
  accent: '#f97316',
  accentHover: '#ea580c',
  accentSoft: 'rgba(249, 115, 22, 0.1)',
  accentText: '#c2410c',

  // Semantic
  error: '#dc2626',
  errorSoft: '#fef2f2',
  success: '#16a34a',
} as const;

export type BgMode = 'checkerboard' | 'dark' | 'light' | 'none';

export const bgModeStyles: Record<BgMode, CSSProperties> = {
  checkerboard: {
    backgroundImage: [
      'linear-gradient(45deg, #ccc 25%, transparent 25%)',
      'linear-gradient(-45deg, #ccc 25%, transparent 25%)',
      'linear-gradient(45deg, transparent 75%, #ccc 75%)',
      'linear-gradient(-45deg, transparent 75%, #ccc 75%)',
    ].join(', '),
    backgroundSize: '20px 20px',
    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
    backgroundColor: '#e8e8e8',
  },
  dark: { backgroundColor: '#1a1a2e' },
  light: { backgroundColor: '#f8fafc' },
  none: { backgroundColor: 'transparent' },
};
