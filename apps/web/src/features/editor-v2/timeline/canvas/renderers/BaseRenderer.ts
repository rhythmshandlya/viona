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
  visual: '#8b5cf6',  // purple-500
  broll: '#06b6d4',   // cyan-500
  scene: '#f59e0b',   // amber-500
  shape: '#64748b',   // slate-500
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

    // 5. Transform badge — small blue icon when item has non-default transform
    if (item.transform) {
      const t = item.transform;
      const hasCustomTransform =
        t.x !== 0 || t.y !== 0 ||
        t.width !== '100%' || t.height !== '100%' ||
        t.rotation !== 0 || t.opacity !== 1;
      if (hasCustomTransform) {
        ctx.fillStyle = '#60a5fa';
        ctx.font = '10px sans-serif';
        ctx.fillText('\u229E', x + 4, y + 12);
      }
    }

    // 6. Filter badge — small orange dot when item has active filters
    if (item.filters) {
      const f = item.filters;
      const hasFilters =
        (f.brightness !== undefined && f.brightness !== 1) ||
        (f.contrast !== undefined && f.contrast !== 1) ||
        (f.saturation !== undefined && f.saturation !== 1) ||
        (f.blur !== undefined && f.blur !== 0) ||
        (f.hue !== undefined && f.hue !== 0) ||
        (f.grayscale !== undefined && f.grayscale !== 0) ||
        (f.sepia !== undefined && f.sepia !== 0);
      if (hasFilters) {
        ctx.beginPath();
        ctx.arc(x + width - 8, y + 8, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#f97316';
        ctx.fill();
      }
    }

    // 7. Keyframe diamonds — shown on selected items with keyframes
    if (state.isSelected && item.keyframes?.length) {
      const laneY = y + height - 6;
      for (const kf of item.keyframes) {
        const kfX = x + ((kf.timeMs / (item.endMs - item.startMs)) * width);
        ctx.save();
        ctx.translate(kfX, laneY);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#a78bfa';
        ctx.fillRect(-3, -3, 6, 6);
        ctx.restore();
      }
    }

    // 8. Resize handles — show when selected or hovered
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
