import { interpolate } from 'remotion';
import { generateTornClipPath } from '../../../magazine/effects';

interface TearTransitionResult {
  clipPath: string;
  translateX: number;
  opacity: number;
}

/**
 * Animated torn-edge clip-path that sweeps across frame for an exit transition.
 * The torn region shifts right-to-left as the paper slides out and fades.
 *
 * @param frame Current frame
 * @param tearStart Frame where tear begins
 * @param tearDuration Duration of tear animation in frames
 * @param width Container width in px
 * @param height Container height in px
 * @returns Object with clipPath, translateX, and opacity values
 */
export function useTearTransition(
  frame: number,
  tearStart: number,
  tearDuration: number,
  width = 1080,
  height = 1920,
): TearTransitionResult {
  const progress = interpolate(frame, [tearStart, tearStart + tearDuration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Generate a torn right edge that sweeps across
  const tornClip = generateTornClipPath(['right'], 0.8, 77, width, height);

  // Shift the clip region from full coverage to off-screen left
  // by adjusting translateX to slide the content out
  const translateX = interpolate(progress, [0, 1], [0, -width * 0.6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const opacity = interpolate(progress, [0, 0.7, 1], [1, 0.8, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Only apply the torn clip-path once tear starts
  const clipPath = frame >= tearStart ? tornClip : 'none';

  return { clipPath, translateX, opacity };
}
