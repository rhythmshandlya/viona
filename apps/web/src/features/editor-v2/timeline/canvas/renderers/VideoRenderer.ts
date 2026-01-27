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
    const thumbHeight = height - 8;
    const thumbAspect = (data.width && data.height) ? data.width / data.height : 16 / 9;
    const thumbWidth = Math.round(thumbHeight * thumbAspect);
    const thumbCount = Math.max(1, Math.ceil(width / thumbWidth));
    const durationMs = item.endMs - item.startMs;
    const cache = getThumbnailCache();

    // Clip to rounded rect for thumbnails
    ctx.save();
    roundRect(ctx, x + 1, y + 1, width - 2, height - 2, 5);
    ctx.clip();

    for (let i = 0; i < thumbCount; i++) {
      const thumbX = x + (i / thumbCount) * width;
      const slotWidth = width / thumbCount;
      const timeMs = item.startMs + (i / thumbCount) * durationMs;
      const bitmap = cache.getThumbnail(data.src, Math.round(timeMs));

      if (bitmap) {
        ctx.drawImage(bitmap, thumbX, y + 4, slotWidth, thumbHeight);
      } else {
        // Gradient placeholder
        const grad = ctx.createLinearGradient(thumbX, y + 4, thumbX + slotWidth, y + 4 + thumbHeight);
        grad.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
        grad.addColorStop(1, 'rgba(59, 130, 246, 0.15)');
        ctx.fillStyle = grad;
        ctx.fillRect(thumbX, y + 4, slotWidth, thumbHeight);
        // Request async extraction
        cache.requestThumbnail(data.src, Math.round(timeMs), this.requestRedraw);
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
