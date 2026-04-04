import { interpolate, Easing } from 'remotion';

export const blackboardEasing = Easing.bezier(0.16, 1, 0.3, 1);

export function glowFadeIn(frame: number, start: number, duration = 20) {
  const contentProgress = interpolate(
    frame,
    [start, start + duration],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );
  const scale = interpolate(contentProgress, [0, 1], [0.98, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const translateY = interpolate(
    frame,
    [start, start + duration],
    [15, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );
  return { glowProgress: contentProgress, contentProgress, scale, translateY };
}

export function glowPulse(frame: number, start: number, duration = 15) {
  const progress = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const intensity = Math.sin(progress * Math.PI) * 0.15;
  return { intensity, active: frame >= start && frame <= start + duration };
}

export function glowExit(frame: number, start: number, duration = 15) {
  const progress = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic),
  });
  return { opacity: 1 - progress, glowScale: 1 - progress * 0.3 };
}

export function staggeredGlowIn(
  frame: number,
  baseStart: number,
  index: number,
  staggerDelay = 7,
  duration = 20,
) {
  return glowFadeIn(frame, baseStart + index * staggerDelay, duration);
}

export function drawLine(frame: number, start: number, duration = 25) {
  const progress = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: blackboardEasing,
  });
  return { progress };
}
