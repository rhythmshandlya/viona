/**
 * Caption font pair presets for Kinetic Luxe captions.
 *
 * Each preset defines:
 * - Hero font (serif/display for emphasized words)
 * - Satellite font (sans-serif for supporting words)
 * - Default colors
 * - Approximate character width factors for layout math
 */

export interface CaptionFontPair {
  id: string;
  label: string;
  heroFontFamily: string;
  fontFamily: string;     // satellite font
  heroColor: string;
  color: string;          // satellite color
  serifCwf: number;       // hero char width factor (approx width / fontSize)
  sansCwf: number;        // satellite char width factor
}

export const CAPTION_FONT_PAIRS: Record<string, CaptionFontPair> = {
  classic: {
    id: 'classic',
    label: 'Classic',
    heroFontFamily: "'Playfair Display', serif",
    fontFamily: "'Inter', sans-serif",
    heroColor: '#e63946',
    color: '#ffffff',
    serifCwf: 0.43,
    sansCwf: 0.48,
  },
  cinematic: {
    id: 'cinematic',
    label: 'Cinematic',
    heroFontFamily: "'Cormorant Garamond', serif",
    fontFamily: "'Space Grotesk', sans-serif",
    heroColor: '#e63946',
    color: '#ffffff',
    serifCwf: 0.40,
    sansCwf: 0.46,
  },
  poster: {
    id: 'poster',
    label: 'Poster',
    heroFontFamily: "'DM Serif Display', serif",
    fontFamily: "'Bebas Neue', sans-serif",
    heroColor: '#e63946',
    color: '#ffffff',
    serifCwf: 0.42,
    sansCwf: 0.35,
  },
};

export const DEFAULT_FONT_PAIR_ID = 'classic';

export function getFontPair(id?: string): CaptionFontPair {
  return CAPTION_FONT_PAIRS[id || DEFAULT_FONT_PAIR_ID] || CAPTION_FONT_PAIRS[DEFAULT_FONT_PAIR_ID];
}
