import { FONTS, FONT_SIZES } from '../fonts';

export const MAGAZINE_COLORS = {
  primary: '#2D1B0E',
  secondary: '#8B6914',
  accent: '#C4A265',
  background: '#F5F0E8',
  text: '#1A1A1A',
  stamp: '#8B0000',
  redaction: '#1A1A1A',
  paperWhite: '#F5F0E8',
  paperAged: '#E8DCC8',
  inkBlack: '#1A1A1A',
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
