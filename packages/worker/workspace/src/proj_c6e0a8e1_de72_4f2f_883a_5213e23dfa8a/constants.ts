// ============================================
// CONSTANTS - Skills vs MCP Explainer
// ============================================

// Cyber Neon Color Palette
export const COLORS = {
  // Primary: Cyan - Skills, efficiency, smart loading
  primary: '#00f5d4',
  // Secondary: Purple - MCP, power, comprehensive access
  secondary: '#7b2cbf',
  // Accent: Magenta - highlights, important moments
  accent: '#f72585',
  // Background: Deep dark
  background: '#0a0a0f',
  // Additional utility colors
  white: '#ffffff',
  darkGray: '#1a1a2e',
  mediumGray: '#2a2a4a',
};

// Spring configuration for smooth animations
export const SPRING_CONFIG = {
  damping: 22,
  stiffness: 90,
  mass: 0.9,
};

// Timing constants from scenes.json (30 fps)
export const TIMING = {
  fps: 30,
  totalDuration: 2208,

  // Scene 1: The Question
  scene1Start: 0,
  scene1End: 87,
  scene1KeySync: 87, // "skill"

  // Scene 2: Skills Introduction
  scene2Start: 88,
  scene2End: 268,
  scene2KeySync: 150, // "folder"

  // Scene 3: Skills Architecture
  scene3Start: 269,
  scene3End: 606,
  scene3KeySync: 457, // "body"

  // Scene 4: Lazy Loading Magic
  scene4Start: 607,
  scene4End: 763,
  scene4KeySync: 657, // "only"

  // Scene 5: MCP Server Introduction
  scene5Start: 764,
  scene5End: 1028,
  scene5KeySync: 845, // "server"

  // Scene 6: Context Performance Trade-off
  scene6Start: 1029,
  scene6End: 1373,
  scene6KeySync: 1114, // "lot"

  // Scene 7: Capability Comparison
  scene7Start: 1374,
  scene7End: 1928,
  scene7KeySync: 1712, // "it"

  // Scene 8: Final Wisdom
  scene8Start: 1929,
  scene8End: 2208,
  scene8KeySync: 1947, // "raw"
};

// Glassmorphism style for cards and containers
export const glassStyle = {
  background: 'rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
};
