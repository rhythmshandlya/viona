import { FONTS } from '../fonts';

export const BLACKBOARD_COLORS = {
  background: '#0a0a14',
  surface: '#141420',
  surfaceBorder: '#1e1e30',
  primary: '#f59e0b',
  secondary: '#06b6d4',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  textDim: '#64748b',
} as const;

export const BLACKBOARD_FONTS = {
  heading: FONTS.spaceGrotesk,
  body: FONTS.inter,
  mono: FONTS.firaCode,
} as const;

export const BLACKBOARD_TIMING = {
  glowRevealDuration: 20,
  contentRevealDuration: 15,
  staggerDelay: 7,
  holdMinimum: 30,
  exitDuration: 15,
} as const;

export const BLACKBOARD_GLOW = {
  primary: '0 0 20px rgba(245, 158, 11, 0.4), 0 0 60px rgba(245, 158, 11, 0.15)',
  secondary: '0 0 20px rgba(6, 182, 212, 0.4), 0 0 60px rgba(6, 182, 212, 0.15)',
  textPrimary: '0 0 30px rgba(245, 158, 11, 0.3)',
  textSecondary: '0 0 30px rgba(6, 182, 212, 0.3)',
  surfaceBorder: '0 0 1px rgba(245, 158, 11, 0.2)',
} as const;
