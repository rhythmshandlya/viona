/**
 * BaseRenderer
 * Shared drawing logic for all timeline item types.
 * Subclasses call super.draw() then add their own content on top.
 */

import { TimelineItem } from '../../../store/types';
import { ItemRenderer, ItemRect, RenderItemState } from './types';
import { roundRect } from './canvasUtils';

// Item type → color mapping
const ITEM_COLORS: Record<string, string> = {
  video: '#3b82f6',   // blue-500
  audio: '#22c55e',   // green-500
  caption: '#a855f7', // purple-500
  text: '#A78BFA',    // violet-400
  image: '#ec4899',   // pink-500
};

export class BaseRenderer implements ItemRenderer {
  draw(
    ctx: CanvasRenderingContext2D,
    item: TimelineItem,
    rect: ItemRect,
    state: RenderItemState
  ): void {
    const color = ITEM_COLORS[item.type] || ITEM_COLORS.text;
    const { x, y, width, height } = rect;

    // 1. Draw rounded-rect background with item-type color
    ctx.fillStyle = color;
    roundRect(ctx, x, y, width, height, 6);
    ctx.fill();

    // 2. Selection state: bright white border + subtle shadow
    if (state.isSelected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      roundRect(ctx, x, y, width, height, 6);
      ctx.stroke();

      // Subtle bottom shadow for elevation
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 6, y + height + 1);
      ctx.lineTo(x + width - 6, y + height + 1);
      ctx.stroke();
    }

    // 3. Hover state (not selected): subtle border
    if (state.isHovered && !state.isSelected) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      roundRect(ctx, x, y, width, height, 6);
      ctx.stroke();
    }

    // 4. Drag preview state
    if (state.isDragPreview) {
      ctx.globalAlpha = 0.6;
      if (state.isInvalid) {
        ctx.fillStyle = '#ef4444'; // red for invalid
        roundRect(ctx, x, y, width, height, 6);
        ctx.fill();
      }
      // Dashed border for previews
      ctx.strokeStyle = state.isInvalid ? '#ef4444' : '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      roundRect(ctx, x, y, width, height, 6);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // 5. Resize handles — show when selected or hovered
    if ((state.isSelected || state.isHovered) && !state.isDragPreview) {
      this.drawResizeHandles(ctx, rect);
    }
  }

  /**
   * Draw resize handles at left and right edges.
   * Thin vertical bars, subtle white.
   */
  protected drawResizeHandles(ctx: CanvasRenderingContext2D, rect: ItemRect): void {
    const { x, y, width, height } = rect;
    const handleWidth = 3;
    const handleHeight = height * 0.6;
    const handleY = y + (height - handleHeight) / 2;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';

    // Left handle
    roundRect(ctx, x + 1, handleY, handleWidth, handleHeight, 1.5);
    ctx.fill();

    // Right handle
    roundRect(ctx, x + width - handleWidth - 1, handleY, handleWidth, handleHeight, 1.5);
    ctx.fill();
  }
}
