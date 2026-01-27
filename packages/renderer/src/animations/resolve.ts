import type { AnimationConfig, AnimationPhase, ResolvedAnimation } from './types';
import { getAnimation } from './animations';
import { getEasing } from './easing';

const TRANSITION_DURATION_MS = 200;

export interface WordTimingContext {
  elapsedMs: number;
  wordDurationMs: number;
  isActive: boolean;
  hasAppeared: boolean;
  isFuture: boolean;
}

export function resolveAnimation(
  config: AnimationConfig,
  ctx: WordTimingContext
): ResolvedAnimation {
  const easing = getEasing(config.easing);

  if (ctx.isFuture) {
    return { style: { opacity: 0.4 }, phase: 'idle' };
  }

  if (ctx.hasAppeared && !ctx.isActive) {
    return { style: {}, phase: 'idle' };
  }

  if (ctx.isActive) {
    const inDuration = Math.min(TRANSITION_DURATION_MS, ctx.wordDurationMs * 0.3);
    const outDuration = Math.min(TRANSITION_DURATION_MS, ctx.wordDurationMs * 0.2);
    const activeDuration = ctx.wordDurationMs - inDuration - outDuration;

    let phase: AnimationPhase;
    let progress: number;

    if (ctx.elapsedMs < inDuration) {
      phase = 'in';
      progress = easing(ctx.elapsedMs / inDuration);
    } else if (ctx.elapsedMs < inDuration + activeDuration) {
      phase = 'active';
      progress = (ctx.elapsedMs - inDuration) / Math.max(activeDuration, 1);
    } else {
      phase = 'out';
      progress = easing((ctx.elapsedMs - inDuration - activeDuration) / Math.max(outDuration, 1));
    }

    const animPhase = phase as 'in' | 'active' | 'out';
    const animFn = getAnimation(config[animPhase], animPhase);
    const animStyle = animFn(Math.max(0, Math.min(1, progress)));

    return { style: animStyle, phase };
  }

  return { style: {}, phase: 'idle' };
}

export function isAnimationConfig(value: unknown): value is AnimationConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    'in' in value &&
    'out' in value &&
    'active' in value
  );
}
