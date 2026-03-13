import { FONT_PAIRS } from '../../fonts';
import type { EventLocatorProps } from './schema';

export function getConstants(props: EventLocatorProps) {
  const COLORS = {
    primary: props.colors.primary,
    secondary: props.colors.secondary,
    accent: props.colors.accent,
    background: props.colors.background,
    text: props.colors.text,
  };

  const pair = FONT_PAIRS[props.fontPair];
  const FONTS = {
    headline: pair.headline,
    body: pair.body,
  };

  return { COLORS, FONTS };
}

export type TemplateConstants = ReturnType<typeof getConstants>;
