import { BaseRenderer } from './BaseRenderer';
import { ItemRect, RenderItemState } from './types';
import { TimelineItem, VisualItemData } from '../../../store/types';
import { roundRect } from './canvasUtils';

export class VisualRenderer extends BaseRenderer {
  draw(
    ctx: CanvasRenderingContext2D,
    item: TimelineItem,
    rect: ItemRect,
    state: RenderItemState
  ): void {
    // Draw base (background, selection, hover, resize handles)
    super.draw(ctx, item, rect, state);

    const data = item.data as VisualItemData;
    const { x, y, width, height } = rect;

    // Clip to rounded rect
    ctx.save();
    roundRect(ctx, x + 1, y + 1, width - 2, height - 2, 5);
    ctx.clip();

    // Purple gradient background for visuals
    const grad = ctx.createLinearGradient(x, y, x + width, y + height);
    grad.addColorStop(0, 'rgba(139, 92, 246, 0.4)'); // Purple-500
    grad.addColorStop(1, 'rgba(168, 85, 247, 0.25)'); // Purple-400
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, width, height);

    // Icon pattern to indicate visual content
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    const iconSize = 20;
    const spacing = 40;
    for (let ix = x + spacing / 2; ix < x + width; ix += spacing) {
      for (let iy = y + spacing / 2; iy < y + height; iy += spacing) {
        // Simple sparkle/star shape
        ctx.beginPath();
        ctx.moveTo(ix, iy - iconSize / 3);
        ctx.lineTo(ix + iconSize / 6, iy);
        ctx.lineTo(ix, iy + iconSize / 3);
        ctx.lineTo(ix - iconSize / 6, iy);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();

    // Purple accent line on top edge
    ctx.fillStyle = '#8b5cf6';
    roundRect(ctx, x, y, width, 2, 0);
    ctx.fill();

    // Label showing visual type/description
    if (width > 80) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      const label = data.type || 'Visual';
      const maxLabelWidth = width - 16;
      ctx.fillText(label.substring(0, 20), x + 8, y + height / 2, maxLabelWidth);
    }
  }
}
