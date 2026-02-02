/**
 * Easing Utilities for Remotion Animations
 *
 * Based on Remotion's Easing module with additional custom curves
 * for cinematic motion graphics.
 *
 * @see https://www.remotion.dev/docs/easing
 */

import { Easing } from 'remotion';

/**
 * Pre-configured easing curves for common animation patterns
 */
export const EASING = {
  // Standard curves
  linear: Easing.linear,
  ease: Easing.ease,

  // Power curves
  easeInQuad: Easing.in(Easing.quad),
  easeOutQuad: Easing.out(Easing.quad),
  easeInOutQuad: Easing.inOut(Easing.quad),

  easeInCubic: Easing.in(Easing.cubic),
  easeOutCubic: Easing.out(Easing.cubic),
  easeInOutCubic: Easing.inOut(Easing.cubic),

  // Expressive curves
  easeInBack: Easing.in(Easing.back(1.7)),
  easeOutBack: Easing.out(Easing.back(1.7)),
  easeInOutBack: Easing.inOut(Easing.back(1.7)),

  // Elastic/bounce
  easeOutBounce: Easing.out(Easing.bounce),
  easeOutElastic: Easing.out(Easing.elastic(1)),

  // Cinematic curves (custom bezier)
  /** Smooth deceleration - great for entrances */
  smoothOut: Easing.bezier(0.25, 0.1, 0.25, 1),
  /** Dramatic slow-in fast-out */
  dramatic: Easing.bezier(0.68, -0.55, 0.27, 1.55),
  /** Apple-style smooth */
  appleSmooth: Easing.bezier(0.4, 0, 0.2, 1),
  /** Snappy with slight overshoot */
  snappy: Easing.bezier(0.34, 1.56, 0.64, 1),
  /** Luxurious slow reveal */
  luxurious: Easing.bezier(0.19, 1, 0.22, 1),
  /** Energetic pop */
  pop: Easing.bezier(0.175, 0.885, 0.32, 1.275),
} as const;

/**
 * Spring configurations for different animation feels
 */
export const SPRING_CONFIGS = {
  /** Smooth, no bounce - professional feel */
  smooth: { damping: 20, stiffness: 60, mass: 1 },
  /** Subtle bounce - modern UI */
  gentle: { damping: 15, stiffness: 80, mass: 1 },
  /** Noticeable bounce - playful */
  bouncy: { damping: 10, stiffness: 100, mass: 1 },
  /** Very bouncy - energetic */
  springy: { damping: 8, stiffness: 180, mass: 1 },
  /** Quick and snappy */
  snappy: { damping: 18, stiffness: 200, mass: 0.8 },
  /** Slow and luxurious */
  slow: { damping: 25, stiffness: 40, mass: 1.2 },
  /** Wobbly - cartoon feel */
  wobbly: { damping: 5, stiffness: 150, mass: 1 },
} as const;

/**
 * Animation timing presets (in frames at 30fps)
 */
export const TIMING = {
  /** Ultra fast - 10 frames (0.33s) */
  instant: 10,
  /** Fast - 15 frames (0.5s) */
  fast: 15,
  /** Normal - 24 frames (0.8s) */
  normal: 24,
  /** Slow - 36 frames (1.2s) */
  slow: 36,
  /** Dramatic - 60 frames (2s) */
  dramatic: 60,
  /** Hero animation - 90 frames (3s) */
  hero: 90,
} as const;

/**
 * Stagger timing presets
 */
export const STAGGER = {
  /** Rapid fire - 4 frames */
  rapid: 4,
  /** Quick - 6 frames */
  quick: 6,
  /** Normal - 8 frames */
  normal: 8,
  /** Relaxed - 12 frames */
  relaxed: 12,
  /** Slow reveal - 16 frames */
  slow: 16,
} as const;

export type EasingType = keyof typeof EASING;
export type SpringConfigType = keyof typeof SPRING_CONFIGS;
