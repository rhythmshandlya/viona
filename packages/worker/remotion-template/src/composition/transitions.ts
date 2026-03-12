/**
 * Pure functions that compute CSS styles for scene transitions.
 * Each function takes a progress value (0→1) and returns CSSProperties.
 *
 * Enter transitions: progress 0→1 means entering (invisible → fully visible)
 * Exit transitions:  progress 0→1 means exiting (fully visible → invisible)
 */
import type { CSSProperties } from 'react';
import type { TransitionType } from './types';

/** Crossfade: simple opacity transition */
function crossfade(progress: number, isExit: boolean): CSSProperties {
  const opacity = isExit ? 1 - progress : progress;
  return { opacity };
}

/** Fade: same as crossfade (alias for clarity in transition picker) */
function fade(progress: number, isExit: boolean): CSSProperties {
  return crossfade(progress, isExit);
}

/** Slide left: outgoing slides left, incoming slides from right */
function slideLeft(progress: number, isExit: boolean): CSSProperties {
  const translateX = isExit ? -progress * 100 : (1 - progress) * 100;
  return {
    transform: `translateX(${translateX}%)`,
    opacity: 1,
  };
}

/** Slide up: outgoing slides up, incoming slides from bottom */
function slideUp(progress: number, isExit: boolean): CSSProperties {
  const translateY = isExit ? -progress * 100 : (1 - progress) * 100;
  return {
    transform: `translateY(${translateY}%)`,
    opacity: 1,
  };
}

/** Zoom: outgoing scales down + fades, incoming scales up from small */
function zoom(progress: number, isExit: boolean): CSSProperties {
  if (isExit) {
    const scale = 1 - progress * 0.3; // 1.0 → 0.7
    return {
      transform: `scale(${scale})`,
      opacity: 1 - progress,
    };
  }
  const scale = 0.7 + progress * 0.3; // 0.7 → 1.0
  return {
    transform: `scale(${scale})`,
    opacity: progress,
  };
}

/** Morph: outgoing shrinks to center, incoming expands from center */
function morph(progress: number, isExit: boolean): CSSProperties {
  if (isExit) {
    const scale = 1 - progress * 0.5; // 1.0 → 0.5
    return {
      transform: `scale(${scale})`,
      opacity: 1 - progress,
    };
  }
  const scale = 0.5 + progress * 0.5; // 0.5 → 1.0
  return {
    transform: `scale(${scale})`,
    opacity: progress,
  };
}

/** Cut: instant switch, no animation */
function cut(_progress: number, _isExit: boolean): CSSProperties {
  return {};
}

const TRANSITION_FNS: Record<TransitionType, (progress: number, isExit: boolean) => CSSProperties> = {
  cut,
  crossfade,
  fade,
  'slide-left': slideLeft,
  'slide-up': slideUp,
  zoom,
  morph,
};

/**
 * Compute the CSS style for a scene at a given transition progress.
 * @param type - The transition type
 * @param progress - 0→1 progress through the transition
 * @param isExit - true if this is the exiting scene, false if entering
 */
export function computeTransitionStyle(
  type: TransitionType,
  progress: number,
  isExit: boolean,
): CSSProperties {
  const fn = TRANSITION_FNS[type] || cut;
  return fn(progress, isExit);
}
