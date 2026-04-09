import { FONT_PAIRS } from '../../fonts';

export function getConstants() {
  const COLORS = {
    primary: '#FFEB00',
    secondary: '#1e1e1e',
    accent: '#6D98A8',
    background: '#1a1a2e',
    text: '#F1F3F2',
  };

  const FONTS = FONT_PAIRS['voxDocumentary'];

  return { COLORS, FONTS };
}

export type TemplateConstants = ReturnType<typeof getConstants>;
