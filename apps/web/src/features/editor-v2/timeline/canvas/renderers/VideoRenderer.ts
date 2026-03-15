import { BaseRenderer } from './BaseRenderer';
import { ItemRect, RenderItemState } from './types';
import { TimelineItem, VideoItemData } from '../../../store/types';
import { getThumbnailCache } from '../ThumbnailCache';
import { roundRect } from './canvasUtils';

export class VideoRenderer extends BaseRenderer {
  private requestRedraw: () => void;

  constructor(requestRedraw: () => void) {
    super();
    this.requestRedraw = requestRedraw;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    item: TimelineItem,
    rect: ItemRect,
    state: RenderItemState
  ): void {
    // Draw base (background, selection, hover, resize handles)
    super.draw(ctx, item, rect, state);

    const data = item.data as VideoItemData;
    const { x, y, width, height } = rect;
    const drawHeight = height - 8;
    const drawY = y + 4;
    // Use a fixed square tile so spacing is consistent regardless of video aspect
    const tileWidth = drawHeight;
    const thumbCount = Math.max(1, Math.ceil(width / tileWidth));
    const durationMs = item.endMs - item.startMs;
    const cache = getThumbnailCache();

    // Clip to rounded rect for thumbnails
    ctx.save();
    roundRect(ctx, x + 1, y + 1, width - 2, height - 2, 5);
    ctx.clip();

    // Use same-origin proxy URL for thumbnails (avoids CORS issues with canvas extraction)
    const thumbSrc = data.thumbnailSrc || data.src;

    for (let i = 0; i < thumbCount; i++) {
      const tileX = x + i * tileWidth;
      const timeMs = item.startMs + (tileX - x) / width * durationMs;
      const bitmap = cache.getThumbnail(thumbSrc, Math.round(timeMs));

      if (bitmap) {
        // Letterbox: scale full frame to fit tile, center with dark bars
        const bw = bitmap.width;
        const bh = bitmap.height;
        const scale = Math.min(tileWidth / bw, drawHeight / bh);
        const dw = Math.round(bw * scale);
        const dh = Math.round(bh * scale);
        const dx = tileX + Math.round((tileWidth - dw) / 2);
        const dy = drawY + Math.round((drawHeight - dh) / 2);

        // Dark background behind letterbox bars
        ctx.fillStyle = '#111';
        ctx.fillRect(tileX, drawY, tileWidth, drawHeight);

        ctx.drawImage(bitmap, dx, dy, dw, dh);
      } else {
        // Gradient placeholder
        const grad = ctx.createLinearGradient(tileX, drawY, tileX + tileWidth, drawY + drawHeight);
        grad.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
        grad.addColorStop(1, 'rgba(59, 130, 246, 0.15)');
        ctx.fillStyle = grad;
        ctx.fillRect(tileX, drawY, tileWidth, drawHeight);
        // Request async extraction
        cache.requestThumbnail(thumbSrc, Math.round(timeMs), this.requestRedraw);
      }
    }

    ctx.restore();

    // Blue accent line on top edge
    ctx.fillStyle = '#3b82f6';
    roundRect(ctx, x, y, width, 2, 0);
    ctx.fill();

    // Muted indicator
    if (data.muted && width > 60) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('Muted', x + 8, y + height - 10);
    }
  }
}
