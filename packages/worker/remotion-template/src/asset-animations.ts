/**
 * Asset Animation Presets & Helpers
 *
 * Shared types, default configs, and entrance/exit helpers used by
 * AnimatedIcon and AnimatedImage components.
 */

import { spring, interpolate, SpringConfig } from "remotion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IconAnimationPreset =
  | "icon-pop"
  | "icon-bounce"
  | "icon-fade-rise"
  | "icon-spin-in"
  | "none";

export type PhotoAnimationPreset =
  | "photo-ken-burns"
  | "photo-zoom"
  | "photo-blur-reveal"
  | "photo-fade-scale"
  | "none";

export type IllustrationAnimationPreset =
  | "illust-fade-rise"
  | "illust-slide-up"
  | "none";

export type AssetAnimationPreset =
  | IconAnimationPreset
  | PhotoAnimationPreset
  | IllustrationAnimationPreset;

export type ActiveAnimation = "float" | "pulse" | "none";

export interface KenBurnsConfig {
  startScale: number;
  endScale: number;
  panDirection: "left" | "right" | "up" | "down";
  panAmount: number; // percentage of canvas
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_SPRING: SpringConfig = {
  damping: 22,
  stiffness: 90,
  mass: 0.9,
  overshootClamping: false,
};

export const ICON_DEFAULTS = {
  preset: "icon-pop" as IconAnimationPreset,
  springConfig: DEFAULT_SPRING,
  activeAnimation: "none" as ActiveAnimation,
};

export const PHOTO_DEFAULTS = {
  preset: "photo-ken-burns" as PhotoAnimationPreset,
  kenBurns: {
    startScale: 1.0,
    endScale: 1.15,
    panDirection: "right" as const,
    panAmount: 3,
  } satisfies KenBurnsConfig,
};

export const ILLUSTRATION_DEFAULTS = {
  preset: "illust-fade-rise" as IllustrationAnimationPreset,
  springConfig: DEFAULT_SPRING,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute entrance opacity + scale for a spring-driven entrance.
 * Returns values between 0-1 that can be plugged into `transform` and `opacity`.
 */
export function computeEntrance(
  frame: number,
  delay: number,
  fps: number,
  config: SpringConfig = DEFAULT_SPRING,
): { opacity: number; scale: number } {
  const f = frame - delay;
  if (f < 0) return { opacity: 0, scale: 0 };

  const scale = spring({ frame: f, fps, config });
  const opacity = interpolate(f, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return { opacity, scale };
}

/**
 * Compute exit opacity + scale for a fade-out.
 * Returns 1 before exitAt, then fades to 0 over ~15 frames.
 */
export function computeExit(
  frame: number,
  exitAt: number | undefined,
  fps: number,
): { opacity: number; scale: number } {
  if (exitAt === undefined || frame < exitAt) {
    return { opacity: 1, scale: 1 };
  }

  const elapsed = frame - exitAt;
  const opacity = interpolate(elapsed, [0, 15], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const scale = interpolate(elapsed, [0, 15], [1, 0.85], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Suppress unused-var warning for fps (kept for API consistency)
  void fps;

  return { opacity, scale };
}
