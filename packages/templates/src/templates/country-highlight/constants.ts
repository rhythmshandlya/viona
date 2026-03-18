import { FONT_PAIRS } from '../../fonts';
import type { CountryHighlightProps } from './schema';

export function getConstants(props: CountryHighlightProps) {
  const c = props?.colors ?? {};
  const COLORS = {
    primary: c.primary ?? '#CC0000',
    secondary: c.secondary ?? '#1a1a2e',
    accent: c.accent ?? '#E67E22',
    background: c.background ?? '#0f0f23',
    text: c.text ?? '#FFFFFF',
  };

  const FONTS = FONT_PAIRS[props?.fontPair ?? 'boldImpact'];

  return { COLORS, FONTS };
}

export type TemplateConstants = ReturnType<typeof getConstants>;
