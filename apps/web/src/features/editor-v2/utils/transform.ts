import type { Transform, Keyframe } from '../store/types';

/**
 * Resolve the effective transform at a given time by applying keyframe overrides.
 * Finds the keyframe values at `relativeTimeMs` (relative to item start) and
 * merges them into the base transform. For hit-testing and selection overlays.
 */
export function resolveTransformAtTime(
  base: Transform,
  keyframes: Keyframe[] | undefined,
  relativeTimeMs: number,
): Transform {
  if (!keyframes || keyframes.length === 0) return base;

  const sorted = [...keyframes].sort((a, b) => a.timeMs - b.timeMs);

  // Collect all animated property names
  const animatedProps = new Set<string>();
  for (const kf of sorted) {
    for (const key of Object.keys(kf.props)) {
      animatedProps.add(key);
    }
  }

  if (animatedProps.size === 0) return base;

  const result = { ...base };

  for (const prop of animatedProps) {
    // Find the keyframes bracketing current time for this property
    let before: { timeMs: number; value: number | string } | null = null;
    let after: { timeMs: number; value: number | string } | null = null;

    for (const kf of sorted) {
      const val = (kf.props as Record<string, unknown>)[prop];
      if (val === undefined) continue;

      if (kf.timeMs <= relativeTimeMs) {
        before = { timeMs: kf.timeMs, value: val as number | string };
      } else if (!after) {
        after = { timeMs: kf.timeMs, value: val as number | string };
      }
    }

    if (before && !after) {
      // Past last keyframe — hold value
      (result as Record<string, unknown>)[prop] = before.value;
    } else if (!before && after) {
      // Before first keyframe — keep base value (no transition started yet)
    } else if (before && after) {
      // Between two keyframes — linearly interpolate if both are numbers
      if (typeof before.value === 'number' && typeof after.value === 'number') {
        const t = (relativeTimeMs - before.timeMs) / (after.timeMs - before.timeMs);
        (result as Record<string, unknown>)[prop] = before.value + (after.value - before.value) * t;
      } else {
        (result as Record<string, unknown>)[prop] = before.value;
      }
    }
  }

  return result;
}
