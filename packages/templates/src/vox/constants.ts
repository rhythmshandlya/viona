import { Easing } from 'remotion';

// === COLORS ===
export const VOX_COLORS = {
  highlight: '#FFEB00',
  teal: '#6D98A8',
  offWhite: '#F1F3F2',
  charcoal: '#4C4E4D',
  darkGray: '#444745',
  deepPurple: '#35313F',
  lightGray: '#BBBBBB',
  medGray: '#AAAAAA',
  white: '#FFFFFF',
  warmBlack: '#1A1A2E',
  mutedRed: '#C84B4B',
  mutedGreen: '#5B8A72',
} as const;

// === FONTS ===
export const VOX_FONTS = {
  headline: 'Playfair Display',
  body: 'Inter',
  mono: 'JetBrains Mono',
} as const;

// === FONT SIZES (at 1080px base) ===
export const VOX_SIZES = {
  hero: 72,
  h1: 56,
  h2: 44,
  h3: 36,
  body: 28,
  label: 22,
  tiny: 16,
} as const;

// === TIMING ===
export const VOX_TIMING = {
  stutterStep: 2.5,
  entranceDuration: 10,
  exitDuration: 8,
  staggerDelay: 5,
  holdMinimum: 20,
  highlighterSpeed: 10,
  typewriterSpeed: 2,
  drawOnSpeed: 10,
} as const;

// === SPRING ===
export const VOX_SPRING = {
  entrance: { damping: 20, stiffness: 180, mass: 1 },
  settle: { damping: 25, stiffness: 200, mass: 1 },
} as const;

// === EASING ===
export const voxEaseOut = Easing.bezier(0.25, 0.1, 0.25, 1.0);
export const voxEaseIn = Easing.bezier(0.4, 0.0, 1.0, 1.0);

// === GRAIN ===
export const VOX_GRAIN = {
  opacity: 0.3,
  cycleFrames: 8,
} as const;

// === ROUGH EDGE ===
export const VOX_ROUGH = {
  turbulenceFrequency: 0.04,
  displacementScale: 3,
} as const;

// === STUTTER HELPER ===
/** Quantize frame to 12fps steps within 30fps timeline */
export const sf = (frame: number): number =>
  Math.floor(frame / VOX_TIMING.stutterStep) * VOX_TIMING.stutterStep;
