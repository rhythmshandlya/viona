import { FONT_PAIRS } from '../../fonts';
import type { WatercolorMapProps } from './schema';

export function getConstants(props: WatercolorMapProps) {
  const c = props?.colors ?? {};
  const COLORS = {
    primary: c.primary ?? '#D64933',
    secondary: c.secondary ?? '#2C3E50',
    accent: c.accent ?? '#E67E22',
    background: c.background ?? '#F5F0EB',
    text: c.text ?? '#2C3E50',
  };

  const FONTS = FONT_PAIRS[props?.fontPair ?? 'elegantEditorial'];

  return { COLORS, FONTS };
}

export type TemplateConstants = ReturnType<typeof getConstants>;
