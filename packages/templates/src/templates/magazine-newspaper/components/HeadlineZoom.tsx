import { interpolate } from 'remotion';

interface HeadlineZoomResult {
  scale: number;
  surroundFade: number;
}

/**
 * Computes camera push animation values: scale zoom and surrounding content fade.
 *
 * @param frame Current frame
 * @param zoomStart Frame where zoom begins
 * @param zoomEnd Frame where zoom ends
 * @returns Object with `scale` (1.0 -> 1.4) and `surroundFade` (1 -> 0)
 */
export function useHeadlineZoom(
  frame: number,
  zoomStart: number,
  zoomEnd: number,
): HeadlineZoomResult {
  const scale = interpolate(frame, [zoomStart, zoomEnd], [1, 1.4], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const surroundFade = interpolate(frame, [zoomStart, zoomEnd - 5], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return { scale, surroundFade };
}
