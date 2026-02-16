import { BaseRenderer } from './BaseRenderer';
import { ItemRect, RenderItemState } from './types';
import { TimelineItem, BrollItemData } from '../../../store/types';
import { roundRect, truncateText } from './canvasUtils';

export class BrollRenderer extends BaseRenderer {
  draw(
    ctx: CanvasRenderingContext2D,
    item: TimelineItem,
    rect: ItemRect,
    state: RenderItemState
  ): void {
    // Draw base (background, selection, hover, resize handles)
    super.draw(ctx, item, rect, state);

    const data = item.data as BrollItemData;
    const { x, y, width, height } = rect;
    const isUpload = data.sourceType === 'upload';

    // Clip to rounded rect
    ctx.save();
    roundRect(ctx, x + 1, y + 1, width - 2, height - 2, 5);
    ctx.clip();

    // Different gradient for uploads vs Pexels
    const grad = ctx.createLinearGradient(x, y, x + width, y + height);
    if (isUpload) {
      // Purple/indigo gradient for user uploads
      grad.addColorStop(0, 'rgba(99, 102, 241, 0.4)');    // indigo-500
      grad.addColorStop(1, 'rgba(139, 92, 246, 0.25)');   // violet-500
    } else {
      // Cyan/teal gradient for Pexels stock footage
      grad.addColorStop(0, 'rgba(6, 182, 212, 0.4)');     // cyan-500
      grad.addColorStop(1, 'rgba(20, 184, 166, 0.25)');   // teal-500
    }
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, width, height);

    // Film strip pattern to indicate B-roll content
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    const stripWidth = 6;
    const spacing = 24;
    for (let ix = x + spacing / 2; ix < x + width; ix += spacing) {
      ctx.fillRect(ix, y, stripWidth, height);
    }

    ctx.restore();

    // Accent line on top edge (different color for uploads)
    ctx.fillStyle = isUpload ? '#6366f1' : '#06b6d4';
    roundRect(ctx, x, y, width, 2, 0);
    ctx.fill();

    // Label showing filename for uploads or photographer for Pexels
    if (width > 60) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      let label: string;
      if (isUpload) {
        label = data.filename || 'Upload';
      } else {
        label = data.photographer ? `${data.photographer}` : 'B-Roll';
      }
      const maxLabelWidth = width - 16;
      ctx.fillText(truncateText(ctx, label, maxLabelWidth), x + 8, y + height / 2, maxLabelWidth);
    }
  }
}
