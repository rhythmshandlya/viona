import { interpolate } from 'remotion';

interface HeadlineZoomResult {
  scale: number;
  translateX: number;
  translateY: number;
  surroundFade: number;
}

/**
 * Camera animation: zoom into headline start → pan across → zoom back out to full page.
 *
 * Translate values computed for transformOrigin '50% 17%' (540, 326 on 1080×1920).
 * At 2× zoom the visible content window is ~540px wide. The camera starts
 * framing the left side of the headline and pans to the right side, then
 * pulls back to show the full newspaper page.
 */
export function useHeadlineZoom(
  frame: number,
  zoomInStart: number,
  zoomInEnd: number,
  panEnd: number,
  zoomOutEnd: number,
): HeadlineZoomResult {
  // Scale: 1 → 2 → 2 → 1
  const scale = interpolate(
    frame,
    [zoomInStart, zoomInEnd, panEnd, zoomOutEnd],
    [1, 2, 2, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Horizontal: 0 → headline start → headline end → back to 0
  const translateX = interpolate(
    frame,
    [zoomInStart, zoomInEnd, panEnd, zoomOutEnd],
    [0, 460, -460, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Vertical: 0 → reading height → reading height → back to 0
  const translateY = interpolate(
    frame,
    [zoomInStart, zoomInEnd, panEnd, zoomOutEnd],
    [0, 46, 46, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Surround fades out during zoom-in, fades back in during zoom-out
  const surroundFade = interpolate(
    frame,
    [zoomInStart, zoomInEnd, panEnd, zoomOutEnd],
    [1, 0, 0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return { scale, translateX, translateY, surroundFade };
}
