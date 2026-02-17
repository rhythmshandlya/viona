import { FONT_PAIRS } from '../../fonts';
import type { SocialPromoProps } from './schema';

export function getConstants(props: SocialPromoProps) {
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
    hook: { start: 0, duration: 90 },
    benefits: { start: 90, duration: 90 },
    testimonial: { start: 180, duration: 90 },
    cta: { start: 270, duration: 90 },
  };

  return { COLORS, FONTS, SPRING_CONFIG, TIMING };
}

export type TemplateConstants = ReturnType<typeof getConstants>;
