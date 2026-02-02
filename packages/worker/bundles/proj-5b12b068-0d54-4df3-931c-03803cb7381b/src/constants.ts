export const COLORS = {
  bg: '#0f0f23',
  primary: '#8b5cf6',
  secondary: '#3b82f6',
  accent: '#06b6d4',
  success: '#22c55e',
  warning: '#eab308',
  danger: '#ef4444',
  white: '#ffffff',
  text: '#e2e8f0',
  muted: '#64748b',
  glass: 'rgba(255, 255, 255, 0.1)',
  glassBorder: 'rgba(255, 255, 255, 0.2)',
  ember: '#f59e0b',
  cyan: '#22d3ee',
  mint: '#10b981',
  void: '#020617',
  slate: '#1e293b',
  gold: '#fbbf24',
};

export const SPRING_SETTLED = { damping: 20, stiffness: 100, mass: 0.8 };

export const getResponsiveSizes = (width: number, height: number) => {
  const minDim = Math.min(width, height);
  return {
    fontSize: {
      xs: height * 0.018,
      sm: height * 0.022,
      md: height * 0.032,
      lg: height * 0.045,
      xl: height * 0.06,
    },
    spacing: {
      xs: minDim * 0.02,
      sm: minDim * 0.03,
      md: minDim * 0.05,
      lg: minDim * 0.08,
    },
    borderRadius: minDim * 0.02,
    minDim,
  };
};
