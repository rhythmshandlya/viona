/**
 * Effects Utility Functions
 * Convert CaptionEffects to CSS and provide helper functions
 */

import type { CaptionEffects, ShadowEffect, GlowEffect } from '@/features/editor-v2/store/types';

/**
 * Convert hex color to RGB string
 */
export function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0, 0, 0';
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

/**
 * Convert a single shadow effect to CSS string
 */
export function shadowToCss(shadow: ShadowEffect): string {
  const { offsetX, offsetY, blur, color, opacity } = shadow;
  return `${offsetX}px ${offsetY}px ${blur}px rgba(${hexToRgb(color)}, ${opacity})`;
}

/**
 * Convert CaptionEffects to CSS textShadow property
 */
export function effectsToCss(effects: CaptionEffects | undefined): React.CSSProperties {
  if (!effects) {
    return {};
  }

  const shadows: string[] = [];

  // Primary shadow
  if (effects.shadow) {
    shadows.push(shadowToCss(effects.shadow));
  }

  // Secondary shadow
  if (effects.shadowSecondary) {
    shadows.push(shadowToCss(effects.shadowSecondary));
  }

  // Glow effect (rendered as multiple layered shadows)
  if (effects.glow?.enabled) {
    const { color, intensity, size } = effects.glow;
    const rgb = hexToRgb(color);
    // Layer 1: tight glow
    shadows.push(`0 0 ${Math.round(size * 0.3)}px rgba(${rgb}, ${intensity})`);
    // Layer 2: medium glow
    shadows.push(`0 0 ${Math.round(size * 0.6)}px rgba(${rgb}, ${intensity * 0.7})`);
    // Layer 3: wide glow
    shadows.push(`0 0 ${size}px rgba(${rgb}, ${intensity * 0.4})`);
  }

  return {
    textShadow: shadows.length > 0 ? shadows.join(', ') : 'none',
  };
}

/**
 * Quick effect presets
 */
export const EFFECT_PRESETS = {
  none: {
    shadow: null,
    shadowSecondary: null,
    glow: null,
  } as CaptionEffects,

  soft: {
    shadow: { offsetX: 1, offsetY: 1, blur: 6, color: '#000000', opacity: 0.5 },
    shadowSecondary: null,
    glow: null,
  } as CaptionEffects,

  hard: {
    shadow: { offsetX: 2, offsetY: 2, blur: 0, color: '#000000', opacity: 0.9 },
    shadowSecondary: null,
    glow: null,
  } as CaptionEffects,

  neon: {
    shadow: null,
    shadowSecondary: null,
    glow: { enabled: true, color: '#00ffff', intensity: 0.8, size: 25 },
  } as CaptionEffects,
};

export type EffectPresetId = keyof typeof EFFECT_PRESETS;
