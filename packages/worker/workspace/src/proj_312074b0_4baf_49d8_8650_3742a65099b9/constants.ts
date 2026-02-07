// Electric Sunset Color Palette
export const COLORS = {
  primary: '#ff6b6b',    // Coral - high energy moments
  secondary: '#feca57',  // Gold - transitions
  accent: '#667eea',     // Cool Blue - low/calm states
  dark: '#1a1a2e',       // Deep dark - background/depth
  background: '#1a1a2e',
};

// Standard spring config for smooth animations
export const SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };

// Softer spring for settle effects
export const SETTLE_SPRING = { damping: 28, stiffness: 70, mass: 1.0 };

// Video config
export const VIDEO_CONFIG = {
  fps: 24,
  width: 1080,
  height: 1920,
  durationInFrames: 73,
};

// Scene timing (frames)
export const TIMING = {
  // Scene 1: High State
  scene1Start: 0,
  scene1End: 40,
  highWordSync: 34,  // "High" spoken at frame 34

  // Scene 2: Low State
  scene2Start: 41,
  scene2End: 73,
  andWordSync: 52,   // "and" spoken at frame 52
  lowWordSync: 55,   // "low" spoken at frame 55
};

// Sphere sizes relative to canvas
export const SPHERE_CONFIG = {
  highScale: 1.0,      // Full size when high
  lowScale: 0.6,       // 60% when low
  baseRadius: 80,      // Base radius in pixels
};

// Vertical positions (as percentage from bottom)
export const POSITIONS = {
  highY: 0.80,   // 80% from bottom = high position
  lowY: 0.20,    // 20% from bottom = low position
};
