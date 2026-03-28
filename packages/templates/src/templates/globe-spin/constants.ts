import { FONT_PAIRS } from '../../fonts';
import type { GlobeSpinProps } from './schema';

export const GLOBE_TEXTURES = {
  'blue-marble': 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg',
  'dark': 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-dark.jpg',
  'night': 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg',
} as const;

export const STAR_FIELD_URL =
  'https://cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png';

export const BUMP_MAP_URL =
  'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png';

export function getConstants(props: GlobeSpinProps) {
  const c = props?.colors ?? {};
  const COLORS = {
    primary: c.primary ?? '#FF6B35',
    secondary: c.secondary ?? '#1a1a2e',
    accent: c.accent ?? '#00D4FF',
    background: c.background ?? '#0a0a1a',
    text: c.text ?? '#FFFFFF',
  };

  const FONTS = FONT_PAIRS[props?.fontPair ?? 'modernTech'];

  return { COLORS, FONTS };
}

export type TemplateConstants = ReturnType<typeof getConstants>;
