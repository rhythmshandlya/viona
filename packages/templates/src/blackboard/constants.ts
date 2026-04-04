import { FONTS } from '../fonts';

export const BLACKBOARD_COLORS = {
  background: '#09090b',
  surface: '#18181b',
  surfaceBorder: '#27272a',
  primary: '#f97316',
  secondary: '#3b82f6',
  text: '#fafafa',
  textMuted: '#a1a1aa',
  textDim: '#71717a',
} as const;

export const BLACKBOARD_FONTS = {
  heading: FONTS.inter,
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
  primary: '0 1px 3px rgba(0,0,0,0.4)',
  secondary: '0 1px 3px rgba(0,0,0,0.4)',
  textPrimary: 'none',
  textSecondary: 'none',
  surfaceBorder: '0 1px 2px rgba(0,0,0,0.3)',
} as const;
