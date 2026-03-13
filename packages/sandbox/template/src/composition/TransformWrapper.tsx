import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';

interface Transform {
  x: number | string;
  y: number | string;
  width: number | string;
  height: number | string;
  rotation: number;
  opacity: number;
}

interface Keyframe {
  timeMs: number;
  props: Partial<Transform>;
  easing?: string;
}

interface Filters {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  blur?: number;
  hue?: number;
  grayscale?: number;
  sepia?: number;
}

interface TransformWrapperProps {
  transform: Transform;
  keyframes?: Keyframe[];
  filters?: Filters;
  fps: number;
  children: React.ReactNode;
}

/** Map easing name to a Remotion Easing function */
function getEasingFn(easing?: string): ((t: number) => number) | undefined {
  if (!easing) return undefined;
  if (easing.startsWith('cubic-bezier(')) {
    const match = easing.match(/cubic-bezier\(([\d.]+),\s*([\d.-]+),\s*([\d.]+),\s*([\d.-]+)\)/);
    if (match) {
      const [, x1, y1, x2, y2] = match.map(Number);
      return Easing.bezier(x1, y1, x2, y2);
    }
  }
  switch (easing) {
    case 'linear':
      return Easing.linear;
    case 'ease-in':
      return Easing.in(Easing.ease);
    case 'ease-out':
      return Easing.out(Easing.ease);
    case 'ease-in-out':
      return Easing.inOut(Easing.ease);
    case 'spring':
      return Easing.out(Easing.ease);
    default:
      return undefined;
  }
}

/** Convert a number|string value to a CSS string (append 'px' to numbers) */
function toCss(val: number | string): string {
  if (typeof val === 'string') return val;
  return `${val}px`;
}

/**
 * Interpolate between two values given a progress [0..1].
 * Numbers are lerped; strings (e.g. '50%') snap at midpoint.
 */
function interpolateValue(
  from: number | string,
  to: number | string,
  progress: number,
  easing?: Keyframe['easing'],
): number | string {
  // If both are numbers, use Remotion interpolate for precision
  if (typeof from === 'number' && typeof to === 'number') {
    const easingFn = getEasingFn(easing);
    return interpolate(progress, [0, 1], [from, to], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: easingFn,
    });
  }
  // String values can't be numerically interpolated -- snap at midpoint
  return progress < 0.5 ? from : to;
}

/**
 * Resolve the current value of a transform property by walking keyframes.
 * - Before first keyframe: interpolate from base to first keyframe
 * - Between keyframes: interpolate between adjacent pair
 * - After last keyframe: use last keyframe value
 */
function resolveValue(
  prop: keyof Transform,
  base: Transform,
  keyframes: Keyframe[],
  currentTimeMs: number,
): number | string {
  // Filter to keyframes that define this property
  const relevant = keyframes
    .filter((kf) => kf.props[prop] !== undefined)
    .sort((a, b) => a.timeMs - b.timeMs);

  const baseValue = base[prop];

  if (relevant.length === 0) {
    return baseValue;
  }

  const first = relevant[0];
  const last = relevant[relevant.length - 1];

  // Before first keyframe: interpolate from base to first keyframe
  if (currentTimeMs <= first.timeMs) {
    if (currentTimeMs <= 0 || first.timeMs <= 0) return baseValue;
    const progress = currentTimeMs / first.timeMs;
    return interpolateValue(baseValue, first.props[prop]!, progress, first.easing);
  }

  // After last keyframe: hold last value
  if (currentTimeMs >= last.timeMs) {
    return last.props[prop]!;
  }

  // Between keyframes: find the surrounding pair
  for (let i = 0; i < relevant.length - 1; i++) {
    const kfA = relevant[i];
    const kfB = relevant[i + 1];
    if (currentTimeMs >= kfA.timeMs && currentTimeMs <= kfB.timeMs) {
      const duration = kfB.timeMs - kfA.timeMs;
      const progress = duration > 0 ? (currentTimeMs - kfA.timeMs) / duration : 1;
      return interpolateValue(kfA.props[prop]!, kfB.props[prop]!, progress, kfB.easing);
    }
  }

  // Fallback (shouldn't happen)
  return baseValue;
}

/** Build a CSS filter string from a Filters object */
function buildFilterString(filters?: Filters): string {
  if (!filters) return 'none';
  const parts: string[] = [];
  if (filters.brightness !== undefined && filters.brightness !== 1) {
    parts.push(`brightness(${filters.brightness})`);
  }
  if (filters.contrast !== undefined && filters.contrast !== 1) {
    parts.push(`contrast(${filters.contrast})`);
  }
  if (filters.saturation !== undefined && filters.saturation !== 1) {
    parts.push(`saturate(${filters.saturation})`);
  }
  if (filters.blur !== undefined && filters.blur !== 0) {
    parts.push(`blur(${filters.blur}px)`);
  }
  if (filters.hue !== undefined && filters.hue !== 0) {
    parts.push(`hue-rotate(${filters.hue}deg)`);
  }
  if (filters.grayscale !== undefined && filters.grayscale !== 0) {
    parts.push(`grayscale(${filters.grayscale})`);
  }
  if (filters.sepia !== undefined && filters.sepia !== 0) {
    parts.push(`sepia(${filters.sepia})`);
  }
  return parts.length > 0 ? parts.join(' ') : 'none';
}

export const TransformWrapper: React.FC<TransformWrapperProps> = ({
  transform,
  keyframes,
  filters,
  fps,
  children,
}) => {
  const frame = useCurrentFrame();
  const currentTimeMs = (frame / fps) * 1000;

  const sortedKeyframes = keyframes ?? [];

  // Resolve each transform property
  const x = resolveValue('x', transform, sortedKeyframes, currentTimeMs);
  const y = resolveValue('y', transform, sortedKeyframes, currentTimeMs);
  const width = resolveValue('width', transform, sortedKeyframes, currentTimeMs);
  const height = resolveValue('height', transform, sortedKeyframes, currentTimeMs);
  const rotation = resolveValue('rotation', transform, sortedKeyframes, currentTimeMs) as number;
  const opacity = resolveValue('opacity', transform, sortedKeyframes, currentTimeMs) as number;

  const filterStr = buildFilterString(filters);

  const style: React.CSSProperties = {
    position: 'absolute',
    left: toCss(x),
    top: toCss(y),
    width: toCss(width),
    height: toCss(height),
    transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
    opacity,
    overflow: 'hidden',
    filter: filterStr !== 'none' ? filterStr : undefined,
  };

  return <div style={style}>{children}</div>;
};

export default TransformWrapper;
