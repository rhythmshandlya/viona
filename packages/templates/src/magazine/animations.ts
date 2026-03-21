import { interpolate, Easing } from 'remotion';

export const magazineEasing = Easing.bezier(0.25, 0.1, 0.25, 1.0);

export function editorialReveal(frame: number, start: number, duration = 20) {
  const opacity = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: magazineEasing,
  });
  const translateY = interpolate(frame, [start, start + duration], [15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: magazineEasing,
  });
  return { opacity, translateY };
}

export function paperSlide(
  frame: number,
  start: number,
  duration = 25,
  direction: 'left' | 'right' | 'up' | 'down' = 'up',
) {
  const progress = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: magazineEasing,
  });
  const rotation = interpolate(
    frame,
    [start, start + duration],
    [direction === 'left' ? -3 : 3, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing },
  );
  // Direction = where element enters FROM. Offsets sized for 1080x1920 viewport.
  const offsets = { left: [-1200, 0], right: [1200, 0], up: [0, 2000], down: [0, -2000] };
  const [startX, startY] = offsets[direction];
  const translateX = interpolate(progress, [0, 1], [startX, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const translateY = interpolate(progress, [0, 1], [startY, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return { translateX, translateY, rotation, opacity: progress };
}

export function exitTear(frame: number, start: number, duration = 20) {
  const progress = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: magazineEasing,
  });
  return { progress, opacity: 1 - progress };
}
