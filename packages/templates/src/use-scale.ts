import { useVideoConfig } from 'remotion';

const BASE_WIDTH = 1080;

/**
 * Returns a scaling function `s(px)` that maps pixel values designed for a
 * 1080-wide canvas to the current composition width.
 *
 * At 1080 width → `s(x) === x` (identity, zero visual change).
 * At 540 width  → `s(56) === 28` (half size).
 */
export function useScale(): (px: number) => number {
  const { width } = useVideoConfig();
  const ratio = width / BASE_WIDTH;
  return (px: number) => px * ratio;
}
