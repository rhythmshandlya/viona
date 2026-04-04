import { FONTS, FONT_SIZES } from '../fonts';

export const MAGAZINE_COLORS = {
  primary: '#0f172a',
  secondary: '#64748b',
  accent: '#e11d48',
  background: '#ffffff',
  text: '#0f172a',
  stamp: '#e11d48',
  redaction: '#0f172a',
  paperWhite: '#ffffff',
  paperAged: '#f8fafc',
  inkBlack: '#0f172a',
} as const;

export const MAGAZINE_FONTS = {
  headline: FONTS.playfairDisplay,
  body: FONTS.lora,
  accent: FONTS.merriweather,
} as const;

export const MAGAZINE_TIMING = {
  revealDuration: 20,
  staggerDelay: 12,
  holdMinimum: 30,
} as const;

export { FONT_SIZES };
