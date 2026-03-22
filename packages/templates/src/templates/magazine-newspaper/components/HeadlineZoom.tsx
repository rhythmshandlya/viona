import { interpolate } from 'remotion';

interface HeadlineZoomResult {
  scale: number;
  translateX: number;
  translateY: number;
  surroundFade: number;
}

/**
 * Camera animation: zoom into headline start → pan across → hold.
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
): HeadlineZoomResult {
  // Scale: 1 → 2 during zoom-in, hold at 2 during and after pan
  const scale = interpolate(
    frame,
    [zoomInStart, zoomInEnd],
    [1, 2],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Horizontal pan: translate to headline start, sweep across, hold at end.
  // tx=460 frames the left edge; tx=-460 frames the right edge.
  const translateX = interpolate(
    frame,
    [zoomInStart, zoomInEnd, panEnd],
    [0, 460, -460],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Vertical: lift slightly so headline sits at comfortable reading height
  const translateY = interpolate(
    frame,
    [zoomInStart, zoomInEnd],
    [0, 46],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Surround fades out during zoom-in and stays hidden
  const surroundFade = interpolate(
    frame,
    [zoomInStart, zoomInEnd],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return { scale, translateX, translateY, surroundFade };
}
