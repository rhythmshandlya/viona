export interface FontEntry {
  family: string;
  weights: number[];
  category: 'sans-serif' | 'serif' | 'mono' | 'display' | 'handwriting';
  googleUrl: string;
}

export const FONT_REGISTRY: FontEntry[] = [
  // ============================================
  // Sans-Serif
  // ============================================
  { family: 'Roboto', weights: [400, 500, 700, 900], category: 'sans-serif', googleUrl: 'Roboto:wght@400;500;700;900' },
  { family: 'Open Sans', weights: [400, 500, 600, 700, 800], category: 'sans-serif', googleUrl: 'Open+Sans:wght@400;500;600;700;800' },
  { family: 'Lato', weights: [400, 700, 900], category: 'sans-serif', googleUrl: 'Lato:wght@400;700;900' },
  { family: 'Montserrat', weights: [400, 500, 600, 700, 800, 900], category: 'sans-serif', googleUrl: 'Montserrat:wght@400;500;600;700;800;900' },
  { family: 'Poppins', weights: [400, 500, 600, 700, 800, 900], category: 'sans-serif', googleUrl: 'Poppins:wght@400;500;600;700;800;900' },
  { family: 'Inter', weights: [400, 500, 600, 700, 800, 900], category: 'sans-serif', googleUrl: 'Inter:wght@400;500;600;700;800;900' },
  { family: 'Raleway', weights: [400, 500, 600, 700, 800, 900], category: 'sans-serif', googleUrl: 'Raleway:wght@400;500;600;700;800;900' },
  { family: 'Nunito', weights: [400, 600, 700, 800, 900], category: 'sans-serif', googleUrl: 'Nunito:wght@400;600;700;800;900' },
  { family: 'Nunito Sans', weights: [400, 600, 700, 800, 900], category: 'sans-serif', googleUrl: 'Nunito+Sans:wght@400;600;700;800;900' },
  { family: 'Ubuntu', weights: [400, 500, 700], category: 'sans-serif', googleUrl: 'Ubuntu:wght@400;500;700' },
  { family: 'Rubik', weights: [400, 500, 600, 700, 800, 900], category: 'sans-serif', googleUrl: 'Rubik:wght@400;500;600;700;800;900' },
  { family: 'Noto Sans', weights: [400, 500, 600, 700, 800, 900], category: 'sans-serif', googleUrl: 'Noto+Sans:wght@400;500;600;700;800;900' },
  { family: 'Oswald', weights: [400, 500, 600, 700], category: 'sans-serif', googleUrl: 'Oswald:wght@400;500;600;700' },
  { family: 'Roboto Condensed', weights: [400, 500, 700, 900], category: 'sans-serif', googleUrl: 'Roboto+Condensed:wght@400;500;700;900' },
  { family: 'DM Sans', weights: [400, 500, 600, 700], category: 'sans-serif', googleUrl: 'DM+Sans:wght@400;500;600;700' },
  { family: 'Kanit', weights: [400, 500, 600, 700, 800, 900], category: 'sans-serif', googleUrl: 'Kanit:wght@400;500;600;700;800;900' },
  { family: 'Work Sans', weights: [400, 500, 600, 700, 800, 900], category: 'sans-serif', googleUrl: 'Work+Sans:wght@400;500;600;700;800;900' },
  { family: 'Quicksand', weights: [400, 500, 600, 700], category: 'sans-serif', googleUrl: 'Quicksand:wght@400;500;600;700' },
  { family: 'Barlow', weights: [400, 500, 600, 700, 800, 900], category: 'sans-serif', googleUrl: 'Barlow:wght@400;500;600;700;800;900' },
  { family: 'Mulish', weights: [400, 500, 600, 700, 800, 900], category: 'sans-serif', googleUrl: 'Mulish:wght@400;500;600;700;800;900' },
  { family: 'Manrope', weights: [400, 500, 600, 700, 800], category: 'sans-serif', googleUrl: 'Manrope:wght@400;500;600;700;800' },
  { family: 'Karla', weights: [400, 500, 600, 700, 800], category: 'sans-serif', googleUrl: 'Karla:wght@400;500;600;700;800' },
  { family: 'Cabin', weights: [400, 500, 600, 700], category: 'sans-serif', googleUrl: 'Cabin:wght@400;500;600;700' },
  { family: 'Libre Franklin', weights: [400, 500, 600, 700, 800, 900], category: 'sans-serif', googleUrl: 'Libre+Franklin:wght@400;500;600;700;800;900' },
  { family: 'Outfit', weights: [400, 500, 600, 700, 800], category: 'sans-serif', googleUrl: 'Outfit:wght@400;500;600;700;800' },
  { family: 'Source Sans 3', weights: [400, 600, 700], category: 'sans-serif', googleUrl: 'Source+Sans+3:wght@400;600;700' },
  { family: 'Space Grotesk', weights: [400, 500, 600, 700], category: 'sans-serif', googleUrl: 'Space+Grotesk:wght@400;500;600;700' },
  { family: 'PT Sans', weights: [400, 700], category: 'sans-serif', googleUrl: 'PT+Sans:wght@400;700' },
  { family: 'Josefin Sans', weights: [400, 500, 600, 700], category: 'sans-serif', googleUrl: 'Josefin+Sans:wght@400;500;600;700' },
  { family: 'Titillium Web', weights: [400, 600, 700, 900], category: 'sans-serif', googleUrl: 'Titillium+Web:wght@400;600;700;900' },
  { family: 'Archivo', weights: [400, 500, 600, 700, 800, 900], category: 'sans-serif', googleUrl: 'Archivo:wght@400;500;600;700;800;900' },
  { family: 'Overpass', weights: [400, 500, 600, 700, 800, 900], category: 'sans-serif', googleUrl: 'Overpass:wght@400;500;600;700;800;900' },
  { family: 'Arimo', weights: [400, 500, 600, 700], category: 'sans-serif', googleUrl: 'Arimo:wght@400;500;600;700' },
  { family: 'Exo 2', weights: [400, 500, 600, 700, 800, 900], category: 'sans-serif', googleUrl: 'Exo+2:wght@400;500;600;700;800;900' },
  { family: 'Comfortaa', weights: [400, 500, 600, 700], category: 'sans-serif', googleUrl: 'Comfortaa:wght@400;500;600;700' },
  { family: 'Merriweather Sans', weights: [400, 500, 600, 700, 800], category: 'sans-serif', googleUrl: 'Merriweather+Sans:wght@400;500;600;700;800' },
  { family: 'Signika', weights: [400, 500, 600, 700], category: 'sans-serif', googleUrl: 'Signika:wght@400;500;600;700' },
  { family: 'Red Rose', weights: [400, 500, 600, 700], category: 'sans-serif', googleUrl: 'Red+Rose:wght@400;500;600;700' },
  { family: 'Oxanium', weights: [400, 500, 600, 700, 800], category: 'sans-serif', googleUrl: 'Oxanium:wght@400;500;600;700;800' },
  { family: 'Sofia Sans Extra Condensed', weights: [400, 500, 600, 700, 800, 900], category: 'sans-serif', googleUrl: 'Sofia+Sans+Extra+Condensed:wght@400;500;600;700;800;900' },

  // ============================================
  // Serif
  // ============================================
  { family: 'Playfair Display', weights: [400, 500, 600, 700, 800, 900], category: 'serif', googleUrl: 'Playfair+Display:wght@400;500;600;700;800;900' },
  { family: 'Lora', weights: [400, 500, 600, 700], category: 'serif', googleUrl: 'Lora:wght@400;500;600;700' },
  { family: 'Merriweather', weights: [400, 700, 900], category: 'serif', googleUrl: 'Merriweather:wght@400;700;900' },
  { family: 'Roboto Slab', weights: [400, 500, 600, 700, 800, 900], category: 'serif', googleUrl: 'Roboto+Slab:wght@400;500;600;700;800;900' },
  { family: 'PT Serif', weights: [400, 700], category: 'serif', googleUrl: 'PT+Serif:wght@400;700' },
  { family: 'Noto Serif', weights: [400, 500, 600, 700, 800, 900], category: 'serif', googleUrl: 'Noto+Serif:wght@400;500;600;700;800;900' },
  { family: 'EB Garamond', weights: [400, 500, 600, 700, 800], category: 'serif', googleUrl: 'EB+Garamond:wght@400;500;600;700;800' },
  { family: 'Libre Baskerville', weights: [400, 700], category: 'serif', googleUrl: 'Libre+Baskerville:wght@400;700' },
  { family: 'Source Serif 4', weights: [400, 500, 600, 700, 800, 900], category: 'serif', googleUrl: 'Source+Serif+4:wght@400;500;600;700;800;900' },
  { family: 'Crimson Text', weights: [400, 600, 700], category: 'serif', googleUrl: 'Crimson+Text:wght@400;600;700' },
  { family: 'Cormorant Garamond', weights: [400, 500, 600, 700], category: 'serif', googleUrl: 'Cormorant+Garamond:wght@400;500;600;700' },
  { family: 'Bitter', weights: [400, 500, 600, 700, 800, 900], category: 'serif', googleUrl: 'Bitter:wght@400;500;600;700;800;900' },
  { family: 'DM Serif Display', weights: [400], category: 'serif', googleUrl: 'DM+Serif+Display' },
  { family: 'Abril Fatface', weights: [400], category: 'serif', googleUrl: 'Abril+Fatface' },
  { family: 'Vidaloka', weights: [400], category: 'serif', googleUrl: 'Vidaloka' },
  { family: 'STIX Two Text', weights: [400, 500, 600, 700], category: 'serif', googleUrl: 'STIX+Two+Text:wght@400;500;600;700' },
  { family: 'Gravitas One', weights: [400], category: 'serif', googleUrl: 'Gravitas+One' },
  { family: 'Rakkas', weights: [400], category: 'serif', googleUrl: 'Rakkas' },

  // ============================================
  // Display
  // ============================================
  { family: 'Anton', weights: [400], category: 'display', googleUrl: 'Anton' },
  { family: 'Bebas Neue', weights: [400], category: 'display', googleUrl: 'Bebas+Neue' },
  { family: 'Lobster', weights: [400], category: 'display', googleUrl: 'Lobster' },
  { family: 'Pacifico', weights: [400], category: 'display', googleUrl: 'Pacifico' },
  { family: 'Permanent Marker', weights: [400], category: 'display', googleUrl: 'Permanent+Marker' },
  { family: 'Righteous', weights: [400], category: 'display', googleUrl: 'Righteous' },
  { family: 'Fredoka', weights: [400, 500, 600, 700], category: 'display', googleUrl: 'Fredoka:wght@400;500;600;700' },
  { family: 'Lilita One', weights: [400], category: 'display', googleUrl: 'Lilita+One' },
  { family: 'Bangers', weights: [400], category: 'display', googleUrl: 'Bangers' },
  { family: 'Bungee', weights: [400], category: 'display', googleUrl: 'Bungee' },
  { family: 'Black Ops One', weights: [400], category: 'display', googleUrl: 'Black+Ops+One' },
  { family: 'Audiowide', weights: [400], category: 'display', googleUrl: 'Audiowide' },
  { family: 'Creepster', weights: [400], category: 'display', googleUrl: 'Creepster' },
  { family: 'Boogaloo', weights: [400], category: 'display', googleUrl: 'Boogaloo' },
  { family: 'Honk', weights: [400], category: 'display', googleUrl: 'Honk' },
  { family: 'Pixelify Sans', weights: [400, 500, 600, 700], category: 'display', googleUrl: 'Pixelify+Sans:wght@400;500;600;700' },
  { family: 'Rye', weights: [400], category: 'display', googleUrl: 'Rye' },
  { family: 'New Rocker', weights: [400], category: 'display', googleUrl: 'New+Rocker' },
  { family: 'Vast Shadow', weights: [400], category: 'display', googleUrl: 'Vast+Shadow' },
  { family: 'Sancreek', weights: [400], category: 'display', googleUrl: 'Sancreek' },
  { family: 'Amarante', weights: [400], category: 'display', googleUrl: 'Amarante' },
  { family: 'Metamorphous', weights: [400], category: 'display', googleUrl: 'Metamorphous' },
  { family: 'Ribeye', weights: [400], category: 'display', googleUrl: 'Ribeye' },
  { family: 'Chicle', weights: [400], category: 'display', googleUrl: 'Chicle' },
  { family: 'Press Start 2P', weights: [400], category: 'display', googleUrl: 'Press+Start+2P' },
  { family: 'Agbalumo', weights: [400], category: 'display', googleUrl: 'Agbalumo' },

  // ============================================
  // Handwriting
  // ============================================
  { family: 'Dancing Script', weights: [400, 500, 600, 700], category: 'handwriting', googleUrl: 'Dancing+Script:wght@400;500;600;700' },
  { family: 'Caveat', weights: [400, 500, 600, 700], category: 'handwriting', googleUrl: 'Caveat:wght@400;500;600;700' },
  { family: 'Satisfy', weights: [400], category: 'handwriting', googleUrl: 'Satisfy' },
  { family: 'Great Vibes', weights: [400], category: 'handwriting', googleUrl: 'Great+Vibes' },
  { family: 'Sacramento', weights: [400], category: 'handwriting', googleUrl: 'Sacramento' },
  { family: 'Shadows Into Light', weights: [400], category: 'handwriting', googleUrl: 'Shadows+Into+Light' },
  { family: 'Indie Flower', weights: [400], category: 'handwriting', googleUrl: 'Indie+Flower' },
  { family: 'Kalam', weights: [400, 700], category: 'handwriting', googleUrl: 'Kalam:wght@400;700' },
  { family: 'Courgette', weights: [400], category: 'handwriting', googleUrl: 'Courgette' },
  { family: 'Pangolin', weights: [400], category: 'handwriting', googleUrl: 'Pangolin' },
  { family: 'Mansalva', weights: [400], category: 'handwriting', googleUrl: 'Mansalva' },
  { family: 'Berkshire Swash', weights: [400], category: 'handwriting', googleUrl: 'Berkshire+Swash' },
  { family: 'Eagle Lake', weights: [400], category: 'handwriting', googleUrl: 'Eagle+Lake' },

  // ============================================
  // Monospace
  // ============================================
  { family: 'Roboto Mono', weights: [400, 500, 600, 700], category: 'mono', googleUrl: 'Roboto+Mono:wght@400;500;600;700' },
  { family: 'JetBrains Mono', weights: [400, 500, 600, 700, 800], category: 'mono', googleUrl: 'JetBrains+Mono:wght@400;500;600;700;800' },
  { family: 'Fira Code', weights: [400, 500, 600, 700], category: 'mono', googleUrl: 'Fira+Code:wght@400;500;600;700' },
  { family: 'Source Code Pro', weights: [400, 500, 600, 700, 800, 900], category: 'mono', googleUrl: 'Source+Code+Pro:wght@400;500;600;700;800;900' },
  { family: 'IBM Plex Mono', weights: [400, 500, 600, 700], category: 'mono', googleUrl: 'IBM+Plex+Mono:wght@400;500;600;700' },
  { family: 'Space Mono', weights: [400, 700], category: 'mono', googleUrl: 'Space+Mono:wght@400;700' },
  { family: 'Inconsolata', weights: [400, 500, 600, 700, 800, 900], category: 'mono', googleUrl: 'Inconsolata:wght@400;500;600;700;800;900' },
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
    'handwriting': FONT_REGISTRY.filter(f => f.category === 'handwriting'),
  };
}

/** Find a font entry by family name */
export function findFont(family: string): FontEntry | undefined {
  return FONT_REGISTRY.find(f => f.family === family);
}
