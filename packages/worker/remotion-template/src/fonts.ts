/**
 * Font Presets for Remotion Visual Generator
 *
 * Uses @remotion/google-fonts for optimized font loading.
 * All fonts are loaded statically at bundle time for consistent rendering.
 */

import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadBebasNeue } from "@remotion/google-fonts/BebasNeue";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as loadRoboto } from "@remotion/google-fonts/Roboto";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadPlayfairDisplay } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadLato } from "@remotion/google-fonts/Lato";
import { loadFont as loadOpenSans } from "@remotion/google-fonts/OpenSans";
import { loadFont as loadSourceSansPro } from "@remotion/google-fonts/SourceSans3";

// Load all fonts
const montserrat = loadMontserrat();
const inter = loadInter();
const bebasNeue = loadBebasNeue();
const poppins = loadPoppins();
const roboto = loadRoboto();
const oswald = loadOswald();
const playfairDisplay = loadPlayfairDisplay();
const lato = loadLato();
const openSans = loadOpenSans();
const sourceSans = loadSourceSansPro();

/**
 * Font Presets - Ready-to-use font family strings
 */
export const FONTS = {
  // Display/Headlines
  montserrat: montserrat.fontFamily,
  bebasNeue: bebasNeue.fontFamily,
  oswald: oswald.fontFamily,
  poppins: poppins.fontFamily,
  playfairDisplay: playfairDisplay.fontFamily,

  // Body/Text
  inter: inter.fontFamily,
  roboto: roboto.fontFamily,
  lato: lato.fontFamily,
  openSans: openSans.fontFamily,
  sourceSans: sourceSans.fontFamily,
} as const;

/**
 * Font Pairings - Curated combinations for different moods
 */
export const FONT_PAIRS = {
  // Modern Tech - Clean, professional
  modernTech: {
    headline: FONTS.montserrat,
    body: FONTS.inter,
    mood: "Modern Professional",
  },

  // Bold Impact - Strong, attention-grabbing
  boldImpact: {
    headline: FONTS.bebasNeue,
    body: FONTS.roboto,
    mood: "Bold Impact",
  },

  // Friendly Tech - Approachable, modern
  friendlyTech: {
    headline: FONTS.poppins,
    body: FONTS.inter,
    mood: "Friendly Tech",
  },

  // Strong & Readable - Confident, clear
  strongReadable: {
    headline: FONTS.oswald,
    body: FONTS.sourceSans,
    mood: "Strong & Readable",
  },

  // Elegant Editorial - Sophisticated, premium
  elegantEditorial: {
    headline: FONTS.playfairDisplay,
    body: FONTS.lato,
    mood: "Elegant Editorial",
  },

  // Clean Minimal - Simple, versatile
  cleanMinimal: {
    headline: FONTS.inter,
    body: FONTS.inter,
    mood: "Clean Minimal",
  },
} as const;

/**
 * Font Weights - Semantic weight names
 */
export const FONT_WEIGHTS = {
  thin: 100,
  extraLight: 200,
  light: 300,
  regular: 400,
  medium: 500,
  semiBold: 600,
  bold: 700,
  extraBold: 800,
  black: 900,
} as const;

/**
 * Font Size Scale (Modular Scale 1.25)
 * Base: 16px
 */
export const FONT_SIZES = {
  caption: 12,
  small: 14,
  body: 16,
  large: 20,
  h4: 25,
  h3: 31,
  h2: 39,
  h1: 49,
  display: 61,
  hero: 76,
} as const;

/**
 * Content-Based Font Recommendations
 */
export type ContentCategory =
  | "tech"
  | "lifestyle"
  | "business"
  | "entertainment"
  | "educational"
  | "news";

export function getFontPairForContent(category: ContentCategory) {
  const recommendations: Record<ContentCategory, keyof typeof FONT_PAIRS> = {
    tech: "modernTech",
    lifestyle: "friendlyTech",
    business: "strongReadable",
    entertainment: "boldImpact",
    educational: "cleanMinimal",
    news: "elegantEditorial",
  };

  return FONT_PAIRS[recommendations[category]];
}

/**
 * Default Export - Most commonly used preset
 * Montserrat + Inter is the most versatile combination
 */
export default FONT_PAIRS.modernTech;
