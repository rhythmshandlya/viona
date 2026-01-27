/**
 * Canvas Utilities
 * Reusable drawing helpers extracted from CanvasRenderer for use by
 * individual item renderers.
 */

/**
 * Trace a rounded-rectangle path on the context (does NOT fill or stroke).
 * Callers must call ctx.fill() / ctx.stroke() after this.
 */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Truncate text to fit within maxWidth, appending "..." if truncated.
 * Returns the (possibly truncated) string.
 */
export function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  const metrics = ctx.measureText(text);
  if (metrics.width <= maxWidth) {
    return text;
  }
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
}

/**
 * Draw a rounded pill / badge with text.
 */
export function drawPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  options: { bg: string; textColor: string; fontSize: number }
): void {
  const padding = 6;
  ctx.font = `${options.fontSize}px system-ui, sans-serif`;
  const textWidth = ctx.measureText(text).width;
  const pillWidth = textWidth + padding * 2;
  const pillHeight = options.fontSize + padding;

  // Background
  ctx.fillStyle = options.bg;
  roundRect(ctx, x, y, pillWidth, pillHeight, pillHeight / 2);
  ctx.fill();

  // Text
  ctx.fillStyle = options.textColor;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + padding, y + pillHeight / 2);
}
