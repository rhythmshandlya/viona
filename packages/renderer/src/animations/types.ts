import type { CSSProperties } from 'react';

export type AnimationType =
  | 'none'
  | 'elastic-pop' | 'bounce-up' | 'shake' | 'color-wipe'
  | '3d-flip' | 'punch'
  | 'fade-rise' | 'typewriter' | 'smooth-slide' | 'soft-scale'
  | 'underline-wipe';

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
