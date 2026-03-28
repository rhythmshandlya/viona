/**
 * Cover-transform math for mapping source video coordinates to canvas pixels.
 *
 * Models the CSS transform chain used by VideoItem.tsx:
 *   1. objectFit: cover — scales source to fill item box, cropping overflow
 *   2. objectPosition: x% y% — shifts which part of the source is visible
 *   3. transform: scale(N) — zooms from element center (transform-origin: 50% 50%)
 */

export interface CoverTransform {
  baseCoverScale: number;
  renderedW: number;
  renderedH: number;
  offsetX: number;
  offsetY: number;
  cropScale: number;
  itemW: number;
  itemH: number;
}

/**
 * Compute the objectFit:cover + crop transform parameters.
 *
 * @param srcW  Source video width in pixels
 * @param srcH  Source video height in pixels
 * @param itemW Video item width on canvas in pixels
 * @param itemH Video item height on canvas in pixels
 * @param cropX objectPosition X percentage (0-100, default 50)
 * @param cropY objectPosition Y percentage (0-100, default 50)
 * @param cropScale CSS transform: scale() value (default 1)
 */
export function computeCoverTransform(
  srcW: number, srcH: number,
  itemW: number, itemH: number,
  cropX = 50, cropY = 50, cropScale = 1,
): CoverTransform {
  const baseCoverScale = Math.max(itemW / srcW, itemH / srcH);
  const renderedW = srcW * baseCoverScale;
  const renderedH = srcH * baseCoverScale;
  const offsetX = (renderedW - itemW) * (cropX / 100);
  const offsetY = (renderedH - itemH) * (cropY / 100);
  return { baseCoverScale, renderedW, renderedH, offsetX, offsetY, cropScale, itemW, itemH };
}

/**
 * Transform a point from source video pixels to canvas pixels.
 *
 * Two-stage transform matching CSS behavior:
 * 1. objectFit:cover + objectPosition → element-space coords
 * 2. transform:scale() from center (transform-origin: 50% 50%) → canvas coords
 */
export function sourceToCanvas(
  sourceX: number, sourceY: number,
  transform: CoverTransform,
  itemX = 0, itemY = 0,
): { x: number; y: number } {
  // Stage A: objectFit:cover + objectPosition
  const elementX = sourceX * transform.baseCoverScale - transform.offsetX;
  const elementY = sourceY * transform.baseCoverScale - transform.offsetY;
  // Stage B: CSS scale from center
  return {
    x: itemX + (elementX - transform.itemW / 2) * transform.cropScale + transform.itemW / 2,
    y: itemY + (elementY - transform.itemH / 2) * transform.cropScale + transform.itemH / 2,
  };
}

/**
 * Compute crop percentages that center a face in the item box.
 * Only adjusts objectPosition (crop.x/y), NOT crop.scale.
 * Handles division-by-zero when aspect ratios match exactly.
 */
export function computeCenterCrop(
  faceCenterX: number, faceCenterY: number,
  srcW: number, srcH: number,
  itemW: number, itemH: number,
): { x: number; y: number } {
  const baseCoverScale = Math.max(itemW / srcW, itemH / srcH);
  const renderedW = srcW * baseCoverScale;
  const renderedH = srcH * baseCoverScale;
  const deltaW = renderedW - itemW;
  const deltaH = renderedH - itemH;
  const cropX = deltaW > 0.5
    ? (faceCenterX * baseCoverScale - itemW / 2) / deltaW * 100
    : 50;
  const cropY = deltaH > 0.5
    ? (faceCenterY * baseCoverScale - itemH / 2) / deltaH * 100
    : 50;
  return {
    x: Math.max(0, Math.min(100, cropX)),
    y: Math.max(0, Math.min(100, cropY)),
  };
}
