import type { CSSProperties } from 'react';

export type AnimationType =
  | 'none'
  // Viral
  | 'elastic-pop' | 'bounce-up' | 'shake' | 'color-wipe'
  | '3d-flip' | 'punch'
  // Cinematic
  | 'fade-rise' | 'typewriter' | 'smooth-slide' | 'soft-scale'
  | 'underline-wipe'
  // Ad / Premium
  | 'apple-fade' | 'google-slide' | 'clean-scale' | 'letter-cascade' | 'smooth-reveal';

export type EasingType = 'linear' | 'ease-out' | 'spring' | 'elastic' | 'bounce';

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
