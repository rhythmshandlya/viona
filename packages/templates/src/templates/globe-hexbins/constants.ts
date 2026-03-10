import { FONT_PAIRS } from '../../fonts';
import type { GlobeHexbinsProps } from './schema';

export const GLOBE_TEXTURES = {
  'blue-marble': '//cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg',
  'dark': '//cdn.jsdelivr.net/npm/three-globe/example/img/earth-dark.jpg',
  'night': '//cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg',
} as const;

export const STAR_FIELD_URL =
  '//cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png';

export const BUMP_MAP_URL =
  '//cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png';

/** Parse hex color string to [r, g, b] */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/** Linearly interpolate between two hex colors by t (0-1) */
export function lerpColor(colorLow: string, colorHigh: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(colorLow);
  const [r2, g2, b2] = hexToRgb(colorHigh);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export function getConstants(props: GlobeHexbinsProps) {
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
