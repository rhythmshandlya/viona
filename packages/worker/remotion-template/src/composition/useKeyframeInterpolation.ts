import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';

interface TransformProps {
  x: number | string;
  y: number | string;
  width: number | string;
  height: number | string;
  rotation: number;
  opacity: number;
}

interface KeyframeInput {
  timeMs: number;
  props: Partial<TransformProps>;
  easing?: string;
}

function mapEasing(easingStr: string | undefined): ((t: number) => number) {
  switch (easingStr) {
    case 'ease-in':
      return Easing.in(Easing.ease);
    case 'ease-out':
      return Easing.out(Easing.ease);
    case 'ease-in-out':
      return Easing.inOut(Easing.ease);
    case 'linear':
    default:
      if (easingStr?.startsWith('cubic-bezier(')) {
        const match = easingStr.match(
          /cubic-bezier\(\s*([\d.]+)\s*,\s*([\d.-]+)\s*,\s*([\d.]+)\s*,\s*([\d.-]+)\s*\)/
        );
        if (match) {
          return Easing.bezier(
            parseFloat(match[1]),
            parseFloat(match[2]),
            parseFloat(match[3]),
            parseFloat(match[4]),
          );
        }
      }
      return Easing.linear;
  }
}

/**
 * Interpolates numeric transform properties between keyframes.
 * Returns the interpolated transform for the current frame.
 * String values (like '50%') are NOT interpolated — they snap to the nearest keyframe.
 */
export function useKeyframeInterpolation(
  baseTransform: TransformProps | undefined,
  keyframes: KeyframeInput[] | undefined,
): TransformProps {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const defaults: TransformProps = {
    x: baseTransform?.x ?? 0,
    y: baseTransform?.y ?? 0,
    width: baseTransform?.width ?? '100%',
    height: baseTransform?.height ?? '100%',
    rotation: baseTransform?.rotation ?? 0,
    opacity: baseTransform?.opacity ?? 1,
  };

  if (!keyframes || keyframes.length === 0) {
    return defaults;
  }

  const sorted = [...keyframes].sort((a, b) => a.timeMs - b.timeMs);

  // Interpolate purely numeric properties
  const numericProps: (keyof TransformProps)[] = ['rotation', 'opacity'];
  const result = { ...defaults };

  for (const prop of numericProps) {
    const propKeyframes = sorted
      .filter((kf) => kf.props[prop] != null)
      .map((kf) => ({
        frame: Math.round((kf.timeMs / 1000) * fps),
        value: kf.props[prop] as number,
        easing: kf.easing,
      }));

    if (propKeyframes.length === 0) continue;
    if (propKeyframes.length === 1) {
      (result as any)[prop] = propKeyframes[0].value;
      continue;
    }

    const frames = propKeyframes.map((kf) => kf.frame);
    const values = propKeyframes.map((kf) => kf.value);
    const easing = mapEasing(propKeyframes[1]?.easing);

    (result as any)[prop] = interpolate(frame, frames, values, {
      easing,
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  }

  // For position/size props that can be strings or numbers
  const mixedProps: (keyof TransformProps)[] = ['x', 'y', 'width', 'height'];
  for (const prop of mixedProps) {
    const propKeyframes = sorted
      .filter((kf) => kf.props[prop] != null)
      .map((kf) => ({
        frame: Math.round((kf.timeMs / 1000) * fps),
        value: kf.props[prop]!,
        easing: kf.easing,
      }));

    if (propKeyframes.length === 0) continue;

    const allNumeric = propKeyframes.every((kf) => typeof kf.value === 'number');
    if (allNumeric && propKeyframes.length >= 2) {
      const frames = propKeyframes.map((kf) => kf.frame);
      const values = propKeyframes.map((kf) => kf.value as number);
      const easing = mapEasing(propKeyframes[1]?.easing);
      (result as any)[prop] = interpolate(frame, frames, values, {
        easing,
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    } else {
      // Mixed or single — snap to nearest keyframe
      let closest = propKeyframes[0];
      for (const kf of propKeyframes) {
        if (Math.abs(kf.frame - frame) < Math.abs(closest.frame - frame)) {
          closest = kf;
        }
      }
      (result as any)[prop] = closest.value;
    }
  }

  return result;
}
