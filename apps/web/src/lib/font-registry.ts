export interface FontEntry {
  family: string;
  weights: number[];
  category: 'sans-serif' | 'serif' | 'mono' | 'display';
  googleUrl: string;
}

export const FONT_REGISTRY: FontEntry[] = [
  // Sans-serif
  { family: 'Inter', weights: [400, 500, 600, 700, 800, 900], category: 'sans-serif', googleUrl: 'Inter:wght@400;500;600;700;800;900' },
  { family: 'Montserrat', weights: [400, 500, 600, 700, 800, 900], category: 'sans-serif', googleUrl: 'Montserrat:wght@400;500;600;700;800;900' },
  { family: 'Poppins', weights: [400, 500, 600, 700, 800, 900], category: 'sans-serif', googleUrl: 'Poppins:wght@400;500;600;700;800;900' },
  { family: 'Source Sans 3', weights: [400, 600, 700], category: 'sans-serif', googleUrl: 'Source+Sans+3:wght@400;600;700' },
  { family: 'Space Grotesk', weights: [400, 500, 600, 700], category: 'sans-serif', googleUrl: 'Space+Grotesk:wght@400;500;600;700' },
  { family: 'DM Sans', weights: [400, 500, 600, 700], category: 'sans-serif', googleUrl: 'DM+Sans:wght@400;500;600;700' },
  { family: 'Outfit', weights: [400, 500, 600, 700, 800], category: 'sans-serif', googleUrl: 'Outfit:wght@400;500;600;700;800' },
  { family: 'Nunito', weights: [400, 600, 700, 800, 900], category: 'sans-serif', googleUrl: 'Nunito:wght@400;600;700;800;900' },
  // Serif
  { family: 'Playfair Display', weights: [400, 500, 600, 700, 800, 900], category: 'serif', googleUrl: 'Playfair+Display:wght@400;500;600;700;800;900' },
  { family: 'Lora', weights: [400, 500, 600, 700], category: 'serif', googleUrl: 'Lora:wght@400;500;600;700' },
  { family: 'Merriweather', weights: [400, 700, 900], category: 'serif', googleUrl: 'Merriweather:wght@400;700;900' },
  // Mono
  { family: 'JetBrains Mono', weights: [400, 500, 600, 700, 800], category: 'mono', googleUrl: 'JetBrains+Mono:wght@400;500;600;700;800' },
  { family: 'Fira Code', weights: [400, 500, 600, 700], category: 'mono', googleUrl: 'Fira+Code:wght@400;500;600;700' },
  // Display
  { family: 'Anton', weights: [400], category: 'display', googleUrl: 'Anton' },
  { family: 'Bebas Neue', weights: [400], category: 'display', googleUrl: 'Bebas+Neue' },
  { family: 'Rubik', weights: [400, 500, 600, 700, 800, 900], category: 'display', googleUrl: 'Rubik:wght@400;500;600;700;800;900' },
];

/** Load a Google Font dynamically by adding a <link> tag */
export async function loadFont(entry: FontEntry): Promise<void> {
  const id = `font-${entry.family.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(id)) return;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${entry.googleUrl}&display=swap`;
  document.head.appendChild(link);

  await document.fonts.ready;
}

/** Get all fonts grouped by category */
export function getFontsByCategory(): Record<FontEntry['category'], FontEntry[]> {
  return {
    'sans-serif': FONT_REGISTRY.filter(f => f.category === 'sans-serif'),
    'serif': FONT_REGISTRY.filter(f => f.category === 'serif'),
    'mono': FONT_REGISTRY.filter(f => f.category === 'mono'),
    'display': FONT_REGISTRY.filter(f => f.category === 'display'),
  };
}

/** Find a font entry by family name */
export function findFont(family: string): FontEntry | undefined {
  return FONT_REGISTRY.find(f => f.family === family);
}
