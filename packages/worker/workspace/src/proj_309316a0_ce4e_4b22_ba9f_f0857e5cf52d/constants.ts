// Electric Sunset Color Palette
export const COLORS = {
  primary: '#ff6b6b',    // Coral - for "low" warmth
  secondary: '#feca57',  // Gold - for transition/energy
  accent: '#ff9ff3',     // Pink - for highlights
  cool: '#667eea',       // Indigo - for "high" coolness
  dark: '#1a1a2e',       // Background depth
};

// Spring configuration for smooth physics-based animation
export const SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };

// Timing constants from scenes.json
export const TIMING = {
  // Scene 1: Anticipation
  scene1Start: 0,
  scene1End: 33,

  // Scene 2: High
  scene2Start: 34,
  scene2End: 51,
  keyHighFrame: 34,  // "High" spoken

  // Scene 3: And Low
  scene3Start: 52,
  scene3End: 73,
  keyAndFrame: 52,   // "and" spoken
  keyLowFrame: 55,   // "low" spoken

  // Total
  totalFrames: 73,
};

// Video configuration
export const VIDEO_CONFIG = {
  fps: 24,
  width: 1080,
  height: 1920,
  durationInFrames: 73,
};
