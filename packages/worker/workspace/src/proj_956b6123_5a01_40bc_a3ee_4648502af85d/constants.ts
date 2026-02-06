// Cyber Neon Color Palette
export const COLORS = {
  primary: '#00f5d4',    // Cyan - clean, tech-forward
  secondary: '#7b2cbf',  // Purple - sophisticated depth
  accent: '#f72585',     // Magenta - energy and emphasis
  dark: '#0a0a0f',       // Modern background
  white: '#ffffff',
  glass: 'rgba(255, 255, 255, 0.1)',
  glassBorder: 'rgba(255, 255, 255, 0.2)',
};

// Standard spring configuration
export const SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };

// Scene timing (frames at 30fps)
export const TIMING = {
  scene1Start: 0,
  scene1End: 65,
  scene2Start: 65,
  scene2End: 247,
  scene3Start: 247,
  scene3End: 763,
  scene4Start: 763,
  scene4End: 1028,
  scene5Start: 1028,
  scene5End: 1314,
  scene6Start: 1314,
  scene6End: 2030,
  scene7Start: 2030,
  scene7End: 2208,
};

// Key sync frames
export const SYNC_FRAMES = {
  scene1_whats: 0,
  scene2_skill: 132,
  scene3_frontMatter: 290,
  scene3_instead: 610,
  scene4_mcp: 898,
  scene5_everything: 1056,
  scene5_loaded: 1070,
  scene5_context: 1118,
  scene6_capabilities: 1373,
  scene6_tools: 1956,
  scene7_comment: 2170,
};

// Canvas dimensions (9:16 portrait)
export const CANVAS = {
  width: 1080,
  height: 1920,
  safeMargin: 108, // 10% of width
  topMargin: 192,  // 10% of height
};

// Typography sizes
export const TYPOGRAPHY = {
  title: 96,       // 5% of height
  body: 58,        // 3% of height
  label: 42,
  small: 32,
};

// Glassmorphism style
export const glassStyle = {
  background: COLORS.glass,
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: `1px solid ${COLORS.glassBorder}`,
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
};
