import { interpolate, Easing } from 'remotion';
import { sf, VOX_TIMING, voxEaseOut, voxEaseIn } from './constants';

/**
 * Stuttered slide-in entrance.
 * Returns { opacity, translateX, translateY } for the given frame.
 */
export function voxEntrance(
  frame: number,
  start: number,
  duration = VOX_TIMING.entranceDuration,
  direction: 'up' | 'down' | 'left' | 'right' = 'up',
  travel = 30,
): { opacity: number; translateX: number; translateY: number } {
  const stuttered = sf(frame);
  // Opacity leads position by 4 frames
  const opacity = interpolate(frame, [start, start + duration + 4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseOut,
  });
  const progress = interpolate(stuttered, [start + 4, start + duration + 4], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseOut,
  });
  const dirs = { up: [0, travel], down: [0, -travel], left: [travel, 0], right: [-travel, 0] };
  const [dx, dy] = dirs[direction];
  return { opacity, translateX: dx * progress, translateY: dy * progress };
}

/**
 * Fade-down exit. Duration = 75% of entrance by default.
 */
export function voxExit(
  frame: number,
  start: number,
  duration = VOX_TIMING.exitDuration,
): { opacity: number; translateY: number } {
  const opacity = interpolate(frame, [start, start + duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseIn,
  });
  const translateY = interpolate(sf(frame), [start, start + duration], [0, 15], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseIn,
  });
  return { opacity, translateY };
}

/**
 * Yellow highlighter sweep — returns width% and rotation for the highlight bar.
 */
export function highlighterSweep(
  frame: number,
  start: number,
  duration = VOX_TIMING.highlighterSpeed,
): { widthPercent: number; rotation: number; yOffset: number } {
  const widthPercent = interpolate(frame, [start, start + duration], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseOut,
  });
  const rotation = 0.8;
  const yOffset = -1;
  return { widthPercent, rotation, yOffset };
}

/**
 * Character-by-character typewriter reveal.
 */
export function typewriterReveal(
  frame: number,
  start: number,
  totalChars: number,
  speed = VOX_TIMING.typewriterSpeed,
): { visibleChars: number } {
  const elapsed = Math.max(0, sf(frame) - start);
  const visibleChars = Math.min(totalChars, Math.floor(elapsed / speed));
  return { visibleChars };
}

/**
 * Draw-on progress for lines, borders, connectors.
 */
export function drawOn(
  frame: number,
  start: number,
  duration = VOX_TIMING.drawOnSpeed,
): { progress: number } {
  const progress = interpolate(sf(frame), [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseOut,
  });
  return { progress };
}

/**
 * Counter roll — number ticks from 0 to target with overshoot.
 */
export function counterRoll(
  frame: number,
  start: number,
  duration: number,
  target: number,
): { displayValue: number } {
  const raw = interpolate(sf(frame), [start, start + duration], [0, target * 1.08], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseOut,
  });
  const settle = interpolate(sf(frame), [start + duration, start + duration + 8], [raw, target], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const displayValue = sf(frame) >= start + duration ? Math.round(settle) : Math.round(raw);
  return { displayValue };
}

/**
 * Staggered item reveal — returns per-item opacity array.
 */
export function progressiveBuild(
  frame: number,
  start: number,
  itemCount: number,
  stagger = VOX_TIMING.staggerDelay,
): { itemOpacities: number[] } {
  const itemOpacities = Array.from({ length: itemCount }, (_, i) => {
    const itemStart = start + i * stagger;
    return interpolate(frame, [itemStart, itemStart + VOX_TIMING.entranceDuration], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: voxEaseOut,
    });
  });
  return { itemOpacities };
}

/**
 * Pop-in with overshoot — for icons, data points, badges.
 */
export function popIn(
  frame: number,
  start: number,
  duration = 6,
): { scale: number; opacity: number } {
  const opacity = interpolate(frame, [start, start + 4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(sf(frame), [start, start + duration, start + duration + 6], [0, 1.08, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseOut,
  });
  return { scale, opacity };
}

/**
 * Micro-motion for holds — prevents static frames.
 */
export function voxIdle(
  frame: number,
  seed: number,
  type: 'breathe' | 'scale' = 'breathe',
): { translateY: number; scale: number } {
  const period = type === 'breathe' ? 60 : 90;
  const phase = (seed % 100) / 100 * Math.PI * 2;
  const wave = Math.sin((frame / period) * Math.PI * 2 + phase);
  if (type === 'breathe') {
    return { translateY: wave * 0.5, scale: 1 };
  }
  return { translateY: 0, scale: 1 + wave * 0.002 };
}
