import type { EasingType } from './types';

export function linear(t: number): number {
  return t;
}

export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function spring(t: number): number {
  const stiffness = 100;
  const damping = 10;
  const w = Math.sqrt(stiffness);
  const d = damping / (2 * Math.sqrt(stiffness));
  if (d < 1) {
    const wd = w * Math.sqrt(1 - d * d);
    return 1 - Math.exp(-d * w * t) * (Math.cos(wd * t) + (d * w / wd) * Math.sin(wd * t));
  }
  return 1 - (1 + w * t) * Math.exp(-w * t);
}

export function elastic(t: number): number {
  if (t === 0 || t === 1) return t;
  const p = 0.3;
  return Math.pow(2, -10 * t) * Math.sin(((t - p / 4) * (2 * Math.PI)) / p) + 1;
}

export function bounce(t: number): number {
  if (t < 1 / 2.75) {
    return 7.5625 * t * t;
  } else if (t < 2 / 2.75) {
    const t2 = t - 1.5 / 2.75;
    return 7.5625 * t2 * t2 + 0.75;
  } else if (t < 2.5 / 2.75) {
    const t2 = t - 2.25 / 2.75;
    return 7.5625 * t2 * t2 + 0.9375;
  } else {
    const t2 = t - 2.625 / 2.75;
    return 7.5625 * t2 * t2 + 0.984375;
  }
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

const EASING_MAP: Record<EasingType, (t: number) => number> = {
  linear,
  'ease-out': easeOut,
  'ease-in-out': easeInOut,
  spring,
  elastic,
  bounce,
};

export function getEasing(type: EasingType): (t: number) => number {
  return EASING_MAP[type] || linear;
}
