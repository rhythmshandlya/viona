export type {
  AnimationType,
  EasingType,
  AnimationConfig,
  AnimationFn,
  AnimationPhase,
  ResolvedAnimation,
} from './types';

export { getAnimation, ANIMATION_REGISTRY } from './animations';
export { getEasing, linear, easeOut, spring, elastic, bounce } from './easing';
export { resolveAnimation, isAnimationConfig } from './resolve';
export type { WordTimingContext } from './resolve';
export { migrateAnimation } from './migrate';
