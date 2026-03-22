import { interpolate } from 'remotion';

interface HeadlineZoomResult {
  scale: number;
  translateX: number;
  translateY: number;
  surroundFade: number;
}

/**
 * Camera animation: zoom into headline start → pan across → zoom back out.
 *
 * Translate values computed for transformOrigin '50% 17%' (540, 326 on 1080×1920).
 * At 2× zoom the visible content window is ~540px wide. The camera starts
 * framing the left side of the headline (content x≈40–580) and pans to the
 * right side (content x≈500–1040), covering the full headline width.
 */
export function useHeadlineZoom(
  frame: number,
  zoomInStart: number,
  zoomInEnd: number,
  panEnd: number,
  zoomOutEnd: number,
): HeadlineZoomResult {
  // Scale: 1 → 2 during zoom-in, hold at 2 during pan, 2 → 1 during zoom-out
  const scale = interpolate(
    frame,
    [zoomInStart, zoomInEnd, panEnd, zoomOutEnd],
    [1, 2, 2, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Horizontal pan: translate to headline start, sweep across, return to origin.
  // tx=460 frames the left edge; tx=-460 frames the right edge.
  const translateX = interpolate(
    frame,
    [zoomInStart, zoomInEnd, panEnd, zoomOutEnd],
    [0, 460, -460, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Vertical: lift slightly so headline sits at comfortable reading height
  const translateY = interpolate(
    frame,
    [zoomInStart, zoomInEnd, panEnd, zoomOutEnd],
    [0, 46, 46, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Surround fades out during zoom-in, stays hidden during pan, fades back in during zoom-out
  const surroundFade = interpolate(
    frame,
    [zoomInStart, zoomInEnd, panEnd, zoomOutEnd],
    [1, 0, 0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return { scale, translateX, translateY, surroundFade };
}
