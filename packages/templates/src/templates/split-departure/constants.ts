import { FONT_PAIRS } from '../../fonts';
import type { SplitDepartureProps } from './schema';

export function getConstants(props: SplitDepartureProps) {
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

/** Fixed zoom level for single-city panel views. */
export const PANEL_ZOOM = 12;

/** Gap between the two panels in pixels. */
export const PANEL_GAP = 8;
