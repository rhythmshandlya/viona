import { FONT_PAIRS } from '../../fonts';
import type { GlobeConnectionsProps } from './schema';

export const GLOBE_TEXTURES = {
  'blue-marble': '//cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg',
  'dark': '//cdn.jsdelivr.net/npm/three-globe/example/img/earth-dark.jpg',
  'night': '//cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg',
} as const;

export const STAR_FIELD_URL =
  '//cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png';

export const BUMP_MAP_URL =
  '//cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png';

export function getConstants(props: GlobeConnectionsProps) {
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
