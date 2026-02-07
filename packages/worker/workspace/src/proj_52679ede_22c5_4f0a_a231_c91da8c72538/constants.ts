// Cyber Neon Color Palette
export const COLORS = {
  primary: '#00f5d4',    // Cyan - timing wheels and positive elements
  secondary: '#7b2cbf',  // Purple - background depth
  accent: '#f72585',     // Magenta - problems and warnings
  success: '#00ff88',    // Bright Green - solution highlights
  dark: '#0a0a0f',       // Deep background
  white: '#ffffff',
  gray: '#4a4a5a',
};

// Standard spring configuration
export const SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };

// Timing constants from scenes.json (in frames at 30fps)
export const TIMING = {
  scene1Start: 0,
  scene1End: 120,
  scene2Start: 120,
  scene2End: 602,
  scene3Start: 602,
  scene3End: 1167,
  scene4Start: 1167,
  scene4End: 1268,
  scene5Start: 1268,
  scene5End: 1635,
  scene6Start: 1635,
  scene6End: 2258,
  scene7Start: 2258,
  scene7End: 2645,
  scene8Start: 2645,
  scene8End: 2967,
};

// Key sync frames for visual events
export const KEY_SYNCS = {
  challenge: 43,    // "challenge" word - box materializes
  binary: 404,      // "binary" - heap assembles
  but: 611,         // "But" - scene shifts, warnings appear
  yes: 1193,        // "Yes" - timing wheel emerges
  picture: 1279,    // "Picture" - clock face assembles
  what: 1642,       // "What" - second wheel slides in
  this: 2423,       // "This" - logos appear
  follow: 2770,     // "Follow" - button pulses
};

// Video configuration
export const VIDEO_CONFIG = {
  fps: 30,
  width: 1080,
  height: 1920,
  durationInFrames: 2967,
};
