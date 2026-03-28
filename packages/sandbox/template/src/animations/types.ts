import type { CSSProperties } from 'react';

export type AnimationType =
  | 'none'
  // Viral
  | 'elastic-pop' | 'bounce-up' | 'shake' | 'color-wipe'
  | '3d-flip' | 'punch' | 'scale-bounce' | 'slide-up' | 'weight-shift' | 'float'
  | 'rotate-bounce' | 'constant-wiggle' | 'slam-down' | 'shake-entry'
  | 'bubble-pop' | 'wiggle'
  // Cinematic
  | 'fade' | 'fade-rise' | 'typewriter' | 'smooth-slide' | 'soft-scale'
  | 'underline-wipe' | 'scan-line' | 'hand-draw' | 'underline-sweep'
  // Ad / Premium
  | 'apple-fade' | 'google-slide' | 'clean-scale' | 'letter-cascade' | 'smooth-reveal'
  | 'slide-left'
  // Motion (AutoAE-inspired)
  | 'spotlight-reveal' | 'film-burn' | 'glitch' | 'spin-reveal'
  | 'drop-slam' | 'wave' | 'blur-zoom' | 'chromatic-split'
  | 'elastic-horizontal' | 'speed-blur' | 'particle-explode' | 'gather'
  | 'blob-morph' | 'newspaper-rotate' | 'chrome-reflect' | 'brutal-slam'
  | 'neon-buzz' | 'flicker';

export type EasingType = 'linear' | 'ease-out' | 'ease-in-out' | 'spring' | 'elastic' | 'bounce';

export interface AnimationConfig {
  in: AnimationType;
  active: AnimationType;
  out: AnimationType;
  easing: EasingType;
}

export type AnimationFn = (progress: number) => CSSProperties;
export type AnimationPhase = 'in' | 'active' | 'out' | 'idle';

export interface ResolvedAnimation {
  style: CSSProperties;
  phase: AnimationPhase;
}
