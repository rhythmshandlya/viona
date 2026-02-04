/**
 * Color Utilities for Visual Effects
 *
 * Provides color manipulation, gradients, and palette generation
 * for sophisticated visual design. Designed for premium aesthetics
 * in motion graphics and explainer videos.
 */

/**
 * Premium color palettes for different moods and aesthetics
 */
export const PALETTES = {
  /** Modern tech - purple/cyan gradient with depth */
  modern: {
    bg: '#0f0f23',
    bgAlt: '#1a1a3e',
    primary: '#8b5cf6',
    primaryLight: '#a78bfa',
    primaryDark: '#7c3aed',
    secondary: '#3b82f6',
    accent: '#06b6d4',
    accentAlt: '#22d3ee',
    success: '#22c55e',
    warning: '#eab308',
    danger: '#ef4444',
    text: '#ffffff',
    textSecondary: '#e2e8f0',
    muted: '#64748b',
    border: '#334155',
  },
  /** Minimal - sophisticated high contrast */
  minimal: {
    bg: '#0a0a0a',
    bgAlt: '#141414',
    primary: '#ffffff',
    primaryLight: '#ffffff',
    primaryDark: '#e5e5e5',
    secondary: '#a3a3a3',
    accent: '#3b82f6',
    accentAlt: '#60a5fa',
    success: '#22c55e',
    warning: '#eab308',
    danger: '#ef4444',
    text: '#ffffff',
    textSecondary: '#d4d4d4',
    muted: '#525252',
    border: '#262626',
  },
  /** Luxury - refined gold on deep black */
  luxury: {
    bg: '#0d0d0d',
    bgAlt: '#1a1612',
    primary: '#d4af37',
    primaryLight: '#e5c76b',
    primaryDark: '#b8942e',
    secondary: '#c9a227',
    accent: '#f5f5dc',
    accentAlt: '#fefdf8',
    success: '#22c55e',
    warning: '#eab308',
    danger: '#dc2626',
    text: '#f5f5dc',
    textSecondary: '#d4d4aa',
    muted: '#6b6b6b',
    border: '#3d3525',
  },
  /** Playful - vibrant and energetic */
  playful: {
    bg: '#1a1a2e',
    bgAlt: '#252547',
    primary: '#f97316',
    primaryLight: '#fb923c',
    primaryDark: '#ea580c',
    secondary: '#eab308',
    accent: '#ec4899',
    accentAlt: '#f472b6',
    success: '#22c55e',
    warning: '#eab308',
    danger: '#ef4444',
    text: '#ffffff',
    textSecondary: '#fce7f3',
    muted: '#64748b',
    border: '#3b3b6d',
  },
  /** Nature - organic greens with warmth */
  nature: {
    bg: '#0f1f0f',
    bgAlt: '#162816',
    primary: '#22c55e',
    primaryLight: '#4ade80',
    primaryDark: '#16a34a',
    secondary: '#16a34a',
    accent: '#84cc16',
    accentAlt: '#a3e635',
    success: '#22c55e',
    warning: '#eab308',
    danger: '#ef4444',
    text: '#ecfdf5',
    textSecondary: '#bbf7d0',
    muted: '#4b5563',
    border: '#365336',
  },
  /** Ocean - deep blues with teal accents */
  ocean: {
    bg: '#0c1929',
    bgAlt: '#132d4a',
    primary: '#0ea5e9',
    primaryLight: '#38bdf8',
    primaryDark: '#0284c7',
    secondary: '#06b6d4',
    accent: '#14b8a6',
    accentAlt: '#2dd4bf',
    success: '#22c55e',
    warning: '#eab308',
    danger: '#ef4444',
    text: '#f0f9ff',
    textSecondary: '#bae6fd',
    muted: '#475569',
    border: '#1e3a5f',
  },
  /** Sunset - warm oranges and pinks */
  sunset: {
    bg: '#1f1315',
    bgAlt: '#2d1a1e',
    primary: '#f43f5e',
    primaryLight: '#fb7185',
    primaryDark: '#e11d48',
    secondary: '#f97316',
    accent: '#fbbf24',
    accentAlt: '#fcd34d',
    success: '#22c55e',
    warning: '#eab308',
    danger: '#ef4444',
    text: '#fff1f2',
    textSecondary: '#fecdd3',
    muted: '#6b6b6b',
    border: '#4a2a2f',
  },
  /** Midnight - deep purple sophistication */
  midnight: {
    bg: '#0f0720',
    bgAlt: '#1a0f35',
    primary: '#a855f7',
    primaryLight: '#c084fc',
    primaryDark: '#9333ea',
    secondary: '#8b5cf6',
    accent: '#ec4899',
    accentAlt: '#f472b6',
    success: '#22c55e',
    warning: '#eab308',
    danger: '#ef4444',
    text: '#faf5ff',
    textSecondary: '#e9d5ff',
    muted: '#6b6b7d',
    border: '#3b2566',
  },
} as const;

/**
 * Semantic color mappings for common use cases
 */
export const SEMANTIC_COLORS = {
  /** Success states */
  success: { bg: '#052e16', text: '#22c55e', accent: '#4ade80' },
  /** Warning states */
  warning: { bg: '#422006', text: '#eab308', accent: '#facc15' },
  /** Error/danger states */
  danger: { bg: '#450a0a', text: '#ef4444', accent: '#f87171' },
  /** Info states */
  info: { bg: '#0c1929', text: '#0ea5e9', accent: '#38bdf8' },
  /** Neutral states */
  neutral: { bg: '#1f2937', text: '#9ca3af', accent: '#d1d5db' },
} as const;

/**
 * Gradient presets for common effects
 */
export const GRADIENTS = {
  /** Purple to cyan - modern tech */
  tech: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
  /** Pink to orange - energetic */
  vibrant: 'linear-gradient(135deg, #ec4899, #f97316)',
  /** Blue to teal - professional */
  professional: 'linear-gradient(135deg, #3b82f6, #14b8a6)',
  /** Gold shine - luxury */
  gold: 'linear-gradient(135deg, #d4af37, #f5f5dc, #d4af37)',
  /** Dark fade - depth */
  depth: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%)',
  /** Subtle mesh - premium background */
  mesh: `
    radial-gradient(at 40% 20%, rgba(139, 92, 246, 0.15) 0px, transparent 50%),
    radial-gradient(at 80% 0%, rgba(59, 130, 246, 0.1) 0px, transparent 50%),
    radial-gradient(at 0% 50%, rgba(6, 182, 212, 0.1) 0px, transparent 50%),
    radial-gradient(at 80% 50%, rgba(236, 72, 153, 0.08) 0px, transparent 50%),
    radial-gradient(at 0% 100%, rgba(34, 197, 94, 0.08) 0px, transparent 50%)
  `,
} as const;

/**
 * Convert hex to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert RGB to hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Lighten a hex color by percentage
 */
export function lighten(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const amount = Math.round(2.55 * percent);
  return rgbToHex(
    Math.min(255, r + amount),
    Math.min(255, g + amount),
    Math.min(255, b + amount)
  );
}

/**
 * Darken a hex color by percentage
 */
export function darken(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const amount = Math.round(2.55 * percent);
  return rgbToHex(
    Math.max(0, r - amount),
    Math.max(0, g - amount),
    Math.max(0, b - amount)
  );
}

/**
 * Add alpha to a hex color
 */
export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Interpolate between two colors
 */
export function interpolateColor(color1: string, color2: string, t: number): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  return rgbToHex(
    Math.round(c1.r + (c2.r - c1.r) * t),
    Math.round(c1.g + (c2.g - c1.g) * t),
    Math.round(c1.b + (c2.b - c1.b) * t)
  );
}

/**
 * Create a gradient string for CSS
 */
export function gradient(
  direction: string,
  ...colors: string[]
): string {
  return `linear-gradient(${direction}, ${colors.join(', ')})`;
}

/**
 * Create a radial gradient for glow effects
 */
export function radialGlow(color: string, intensity: number = 1): string {
  return `radial-gradient(circle at center, ${withAlpha(color, 0.3 * intensity)}, transparent 70%)`;
}

/**
 * Create a layered glow effect (multiple blur layers)
 */
export function layeredGlow(color: string, size: number, intensity: number = 1): string {
  return [
    `0 0 ${size * 0.5}px ${withAlpha(color, 0.6 * intensity)}`,
    `0 0 ${size}px ${withAlpha(color, 0.4 * intensity)}`,
    `0 0 ${size * 2}px ${withAlpha(color, 0.2 * intensity)}`,
    `0 0 ${size * 3}px ${withAlpha(color, 0.1 * intensity)}`,
  ].join(', ');
}

/**
 * Create a premium shadow stack for depth
 */
export function premiumShadow(elevation: 'sm' | 'md' | 'lg' | 'xl' = 'md'): string {
  const shadows = {
    sm: [
      '0 1px 2px rgba(0,0,0,0.1)',
      '0 2px 4px rgba(0,0,0,0.1)',
    ],
    md: [
      '0 2px 4px rgba(0,0,0,0.1)',
      '0 4px 8px rgba(0,0,0,0.1)',
      '0 8px 16px rgba(0,0,0,0.1)',
    ],
    lg: [
      '0 4px 8px rgba(0,0,0,0.1)',
      '0 8px 16px rgba(0,0,0,0.1)',
      '0 16px 32px rgba(0,0,0,0.15)',
      '0 32px 64px rgba(0,0,0,0.1)',
    ],
    xl: [
      '0 8px 16px rgba(0,0,0,0.1)',
      '0 16px 32px rgba(0,0,0,0.1)',
      '0 32px 64px rgba(0,0,0,0.15)',
      '0 64px 128px rgba(0,0,0,0.1)',
    ],
  };
  return shadows[elevation].join(', ');
}

/**
 * Adjust color saturation
 */
export function saturate(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
  const factor = 1 + percent / 100;
  return rgbToHex(
    Math.round(gray + factor * (r - gray)),
    Math.round(gray + factor * (g - gray)),
    Math.round(gray + factor * (b - gray))
  );
}

/**
 * Mix two colors together
 */
export function mix(color1: string, color2: string, weight: number = 0.5): string {
  return interpolateColor(color1, color2, weight);
}

/**
 * Get complementary color
 */
export function complementary(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(255 - r, 255 - g, 255 - b);
}

/**
 * Create a color scheme from a base color
 */
export function colorScheme(baseHex: string) {
  return {
    base: baseHex,
    light: lighten(baseHex, 20),
    lighter: lighten(baseHex, 40),
    dark: darken(baseHex, 20),
    darker: darken(baseHex, 40),
    muted: withAlpha(baseHex, 0.6),
    subtle: withAlpha(baseHex, 0.2),
    glow: withAlpha(baseHex, 0.4),
  };
}

/**
 * Generate a glassmorphism background
 */
export function glassBackground(
  tintColor: string = '#ffffff',
  opacity: number = 0.1,
  blur: number = 20
): { background: string; backdropFilter: string } {
  return {
    background: `linear-gradient(135deg, ${withAlpha(tintColor, opacity * 1.5)}, ${withAlpha(tintColor, opacity * 0.5)})`,
    backdropFilter: `blur(${blur}px) saturate(1.2)`,
  };
}

export type PaletteType = keyof typeof PALETTES;
export type SemanticColorType = keyof typeof SEMANTIC_COLORS;
export type GradientType = keyof typeof GRADIENTS;
