import { FONT_PAIRS } from '../../fonts';
import type { ProductLaunchProps } from './schema';

export function getConstants(props: ProductLaunchProps) {
  const COLORS = {
    primary: props.colors.primary,
    secondary: props.colors.secondary,
    accent: props.colors.accent,
    background: props.colors.background,
    text: props.colors.text,
  };

  const FONTS = FONT_PAIRS[props.fontPair];

  const SPRING_CONFIG = {
    damping: 22,
    stiffness: 90,
    mass: 0.9,
  };

  const TIMING = {
    intro: props.sceneDurations.intro,
    features: props.sceneDurations.features,
    pricing: props.sceneDurations.pricing,
    cta: props.sceneDurations.cta,
  };

  return { COLORS, FONTS, SPRING_CONFIG, TIMING };
}

export type TemplateConstants = ReturnType<typeof getConstants>;
