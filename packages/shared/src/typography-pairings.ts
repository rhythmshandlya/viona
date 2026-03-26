// ---------------------------------------------------------------------------
// Typography Pairings — display font (power/strong) + body font (medium/filler)
// ---------------------------------------------------------------------------

export type TypographyPairingId =
  | 'montserrat-inter'
  | 'oswald-roboto'
  | 'bebas-opensans'
  | 'playfair-lato'
  | 'anton-nunito'
  | 'poppins-dmsans'
  | 'robotocond-sourcesans'
  | 'spacegrotesk-inter'
  | 'dancing-script-montserrat';

export const DEFAULT_TYPOGRAPHY_PAIRING_ID: TypographyPairingId = 'montserrat-inter';

export interface TypographyPairing {
  id: TypographyPairingId;
  name: string;
  vibe: string;
  displayFont: {
    family: string;
    weight: number;
  };
  bodyFont: {
    family: string;
    weight: number;
  };
}

export const TYPOGRAPHY_PAIRINGS: Record<TypographyPairingId, TypographyPairing> = {
  'montserrat-inter': {
    id: 'montserrat-inter',
    name: 'Montserrat + Inter',
    vibe: 'Modern / Versatile',
    displayFont: { family: 'Montserrat', weight: 800 },
    bodyFont: { family: 'Inter', weight: 500 },
  },
  'oswald-roboto': {
    id: 'oswald-roboto',
    name: 'Oswald + Roboto',
    vibe: 'YouTube / Bold Energy',
    displayFont: { family: 'Oswald', weight: 700 },
    bodyFont: { family: 'Roboto', weight: 500 },
  },
  'bebas-opensans': {
    id: 'bebas-opensans',
    name: 'Bebas Neue + Open Sans',
    vibe: 'High Impact / Cinematic',
    displayFont: { family: 'Bebas Neue', weight: 400 },
    bodyFont: { family: 'Open Sans', weight: 500 },
  },
  'playfair-lato': {
    id: 'playfair-lato',
    name: 'Playfair Display + Lato',
    vibe: 'Elegant / Editorial',
    displayFont: { family: 'Playfair Display', weight: 800 },
    bodyFont: { family: 'Lato', weight: 400 },
  },
  'anton-nunito': {
    id: 'anton-nunito',
    name: 'Anton + Nunito',
    vibe: 'Viral / Social Media',
    displayFont: { family: 'Anton', weight: 400 },
    bodyFont: { family: 'Nunito', weight: 600 },
  },
  'poppins-dmsans': {
    id: 'poppins-dmsans',
    name: 'Poppins + DM Sans',
    vibe: 'Friendly / Rounded',
    displayFont: { family: 'Poppins', weight: 800 },
    bodyFont: { family: 'DM Sans', weight: 500 },
  },
  'robotocond-sourcesans': {
    id: 'robotocond-sourcesans',
    name: 'Roboto Condensed + Source Sans 3',
    vibe: 'Professional / Clean',
    displayFont: { family: 'Roboto Condensed', weight: 900 },
    bodyFont: { family: 'Source Sans 3', weight: 400 },
  },
  'spacegrotesk-inter': {
    id: 'spacegrotesk-inter',
    name: 'Space Grotesk + Inter',
    vibe: 'Tech / Startup',
    displayFont: { family: 'Space Grotesk', weight: 700 },
    bodyFont: { family: 'Inter', weight: 500 },
  },
  'dancing-script-montserrat': {
    id: 'dancing-script-montserrat',
    name: 'Dancing Script + Montserrat',
    vibe: 'Cinematic / Elegant Script',
    displayFont: { family: 'Dancing Script', weight: 700 },
    bodyFont: { family: 'Montserrat', weight: 500 },
  },
};

export const TYPOGRAPHY_PAIRING_ORDER: TypographyPairingId[] = [
  'montserrat-inter',
  'oswald-roboto',
  'bebas-opensans',
  'playfair-lato',
  'anton-nunito',
  'poppins-dmsans',
  'robotocond-sourcesans',
  'spacegrotesk-inter',
  'dancing-script-montserrat',
];

/** Get a typography pairing by ID, falling back to the default */
export function getPairing(id: string): TypographyPairing {
  return TYPOGRAPHY_PAIRINGS[id as TypographyPairingId] ?? TYPOGRAPHY_PAIRINGS[DEFAULT_TYPOGRAPHY_PAIRING_ID];
}
