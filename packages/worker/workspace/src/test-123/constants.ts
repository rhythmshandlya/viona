// Colors from the Soft Gradient (Calm/Educational) palette
export const COLORS = {
  primary: '#667eea', // Indigo
  secondary: '#764ba2', // Purple
  accent: '#66a6ff', // Sky
  dark: '#1e1e2f',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
};

// Standard spring configuration
export const SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };

// Scene timing from scenes.json (30fps)
export const TIMING = {
  scene1Start: 0,
  scene1End: 60,
  scene2Start: 61,
  scene2End: 140,
  scene3Start: 141,
  scene3End: 220,
  scene4Start: 221,
  scene4End: 300,

  // Key sync points
  containerFormation: 20,
  titleComplete: 60,
  contentComplete: 100,
  emphasisPeak: 180,
  finalState: 260,
};

// Layout constants from responsive design requirements
export const LAYOUT = {
  safeMargin: 0.1, // 10%
  titleSize: 0.05, // 5% of height
  bodySize: 0.035, // 3.5% of height
  maxContentWidth: 0.8, // 80%
};

// Video configuration
export const VIDEO_CONFIG = {
  fps: 30,
  durationInFrames: 300,
  width: 1920,
  height: 1080,
};