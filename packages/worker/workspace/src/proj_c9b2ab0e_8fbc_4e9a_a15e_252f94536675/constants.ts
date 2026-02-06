// Color Palette: Cyber Neon
export const COLORS = {
  primary: '#00f5d4',    // Cyan - Comments and system elements
  secondary: '#7b2cbf',  // Purple - Background and containers
  accent: '#feca57',     // Gold - Winners and highlights
  warning: '#f72585',    // Magenta - Constraints and problems
  dark: '#0a0a0f',       // Background
  white: '#ffffff',
  glass: 'rgba(255, 255, 255, 0.1)',
  glassStroke: 'rgba(255, 255, 255, 0.2)',
};

// Standard spring config for smooth animations
export const SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };

// Scene timing (in frames at 30fps)
export const TIMING = {
  fps: 30,
  totalFrames: 2334,

  // Scene 1: The Scenario Setup
  scene1: { start: 0, end: 450, keySync: 129 },

  // Scene 2: The Memory Crisis
  scene2: { start: 451, end: 829, keySync: 394 },

  // Scene 3: The Solution Reveal
  scene3: { start: 830, end: 1034, keySync: 883 },

  // Scene 4: Algorithm Mechanics (3D dice)
  scene4: { start: 1035, end: 1606, keySync: 1089 },

  // Scene 5: Mathematical Fairness Proof
  scene5: { start: 1607, end: 1714, keySync: 1537 },

  // Scene 6: The Challenge
  scene6: { start: 1715, end: 1994, keySync: 1849 },

  // Scene 7: Call to Action
  scene7: { start: 1995, end: 2334, keySync: 1949 },
};

// Video dimensions (9:16 vertical)
export const VIDEO = {
  width: 1080,
  height: 1920,
  fps: 30,
};

// Responsive sizing helpers
export const RESPONSIVE = {
  safeMargin: 0.1,  // 10%
  titleSize: 0.05,  // 5% of height
  bodySize: 0.03,   // 3% of height
  maxContentWidth: 0.8, // 80%
};
