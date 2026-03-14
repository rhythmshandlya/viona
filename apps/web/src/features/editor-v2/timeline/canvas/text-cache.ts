const textWidthCache = new Map<string, number>();

/**
 * Cached version of ctx.measureText().width.
 * Cache is shared across CanvasRenderer and canvasUtils.
 */
export function getCachedTextWidth(ctx: CanvasRenderingContext2D, text: string, font: string): number {
  const key = `${font}|${text}`;
  let width = textWidthCache.get(key);
  if (width === undefined) {
    ctx.font = font;
    width = ctx.measureText(text).width;
    textWidthCache.set(key, width);
    if (textWidthCache.size > 500) {
      const firstKey = textWidthCache.keys().next().value;
      if (firstKey) textWidthCache.delete(firstKey);
    }
  }
  return width;
}

export function clearTextCache(): void {
  textWidthCache.clear();
}
