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
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadNunito } from "@remotion/google-fonts/Nunito";
import { loadFont as loadLora } from "@remotion/google-fonts/Lora";
import { loadFont as loadMerriweather } from "@remotion/google-fonts/Merriweather";
import { loadFont as loadSpaceGrotesk } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadDMSans } from "@remotion/google-fonts/DMSans";
import { loadFont as loadOutfit } from "@remotion/google-fonts/Outfit";
import { loadFont as loadFiraCode } from "@remotion/google-fonts/FiraCode";
import { loadFont as loadRubik } from "@remotion/google-fonts/Rubik";
import { loadFont as loadJetBrainsMono } from "@remotion/google-fonts/JetBrainsMono";

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
const anton = loadAnton();
const nunito = loadNunito();
const lora = loadLora();
const merriweather = loadMerriweather();
const spaceGrotesk = loadSpaceGrotesk();
const dmSans = loadDMSans();
const outfit = loadOutfit();
const firaCode = loadFiraCode();
const rubik = loadRubik();
const jetBrainsMono = loadJetBrainsMono();

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
  anton: anton.fontFamily,

  // Body/Text
  inter: inter.fontFamily,
  roboto: roboto.fontFamily,
  lato: lato.fontFamily,
  openSans: openSans.fontFamily,
  sourceSans: sourceSans.fontFamily,
  nunito: nunito.fontFamily,
  dmSans: dmSans.fontFamily,
  outfit: outfit.fontFamily,
  spaceGrotesk: spaceGrotesk.fontFamily,

  // Serif
  lora: lora.fontFamily,
  merriweather: merriweather.fontFamily,

  // Mono
  jetBrainsMono: jetBrainsMono.fontFamily,
  firaCode: firaCode.fontFamily,

  // Display extra
  rubik: rubik.fontFamily,
} as const;

/**
 * Font Pairings - Curated combinations for different moods
 */
export const FONT_PAIRS = {
  modernTech: {
    headline: FONTS.montserrat,
    body: FONTS.inter,
    mood: "Modern Professional",
  },
  boldImpact: {
    headline: FONTS.bebasNeue,
    body: FONTS.roboto,
    mood: "Bold Impact",
  },
  friendlyTech: {
    headline: FONTS.poppins,
    body: FONTS.inter,
    mood: "Friendly Tech",
  },
  strongReadable: {
    headline: FONTS.oswald,
    body: FONTS.sourceSans,
    mood: "Strong & Readable",
  },
  elegantEditorial: {
    headline: FONTS.playfairDisplay,
    body: FONTS.lato,
    mood: "Elegant Editorial",
  },
  cleanMinimal: {
    headline: FONTS.inter,
    body: FONTS.inter,
    mood: "Clean Minimal",
  },
} as const;

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

export default FONT_PAIRS.modernTech;
