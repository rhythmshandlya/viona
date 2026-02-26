import { BaseRenderer } from './BaseRenderer';
import { ItemRect, RenderItemState } from './types';
import { TimelineItem, VisualItemData } from '../../../store/types';
import { roundRect } from './canvasUtils';

// Color scheme per displayMode
const DISPLAY_MODE_COLORS: Record<
  'pip' | 'fullscreen' | 'overlay',
  { gradStart: string; gradEnd: string; accent: string }
> = {
  pip: {
    gradStart: 'rgba(59, 130, 246, 0.4)',
    gradEnd: 'rgba(96, 165, 250, 0.25)',
    accent: '#3b82f6',
  },
  fullscreen: {
    gradStart: 'rgba(139, 92, 246, 0.4)',
    gradEnd: 'rgba(168, 85, 247, 0.25)',
    accent: '#8b5cf6',
  },
  overlay: {
    gradStart: 'rgba(249, 115, 22, 0.4)',
    gradEnd: 'rgba(251, 146, 60, 0.25)',
    accent: '#f97316',
  },
};

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

    // Resolve displayMode, defaulting to 'pip' for backwards compatibility
    const displayMode = data.displayMode || 'pip';
    const colors = DISPLAY_MODE_COLORS[displayMode];

    // Clip to rounded rect
    ctx.save();
    roundRect(ctx, x + 1, y + 1, width - 2, height - 2, 5);
    ctx.clip();

    // Color-coded gradient background based on displayMode
    const grad = ctx.createLinearGradient(x, y, x + width, y + height);
    grad.addColorStop(0, colors.gradStart);
    grad.addColorStop(1, colors.gradEnd);
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

    // Color-coded accent line on top edge (2px)
    ctx.fillStyle = colors.accent;
    roundRect(ctx, x, y, width, 2, 0);
    ctx.fill();

    // Label showing visual type/description with mode prefix
    if (width > 80) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      const typeLabel = data.type || 'Visual';
      let label: string;
      switch (displayMode) {
        case 'fullscreen':
          label = `[FULLSCREEN] ${typeLabel}`;
          break;
        case 'overlay':
          label = `[OVERLAY] ${typeLabel}`;
          break;
        default:
          label = typeLabel;
          break;
      }
      const maxLabelWidth = width - 16;
      ctx.fillText(label.substring(0, 30), x + 8, y + height / 2, maxLabelWidth);
    }
  }
}
