import { BaseRenderer } from './BaseRenderer';
import { ItemRect, RenderItemState } from './types';
import { TimelineItem, CaptionItemData } from '../../../store/types';
import { useEditorStore } from '../../../store/editor-store';
import { truncateText, drawPill } from './canvasUtils';

export class CaptionRenderer extends BaseRenderer {
  draw(
    ctx: CanvasRenderingContext2D,
    item: TimelineItem,
    rect: ItemRect,
    state: RenderItemState
  ): void {
    super.draw(ctx, item, rect, state);

    const data = item.data as CaptionItemData;
    const { x, y, width, height } = rect;
    const padding = 8;

    // 1. Display mode indicator (top-left corner)
    if (width > 80) {
      const displayMode = useEditorStore.getState().captionPreset.displayMode;
      const modeLabel = displayMode === 'word-by-word' ? 'W'
        : displayMode === 'karaoke' ? 'K'
        : 'P';

      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(modeLabel, x + padding, y + 4);
    }

    // 2. Text preview (center, semi-bold)
    const textMaxWidth = width - padding * 2 - (width > 120 ? 60 : 0); // Reserve space for badge
    if (textMaxWidth > 20) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      const displayText = truncateText(ctx, data.text || '', textMaxWidth);
      ctx.fillText(displayText, x + padding, y + height / 2);
    }

    // 3. Word count badge (right edge)
    if (width > 120 && data.words && data.words.length > 0) {
      const badgeText = `${data.words.length}w`;
      drawPill(ctx, x + width - 36, y + height / 2 - 8, badgeText, {
        bg: 'rgba(255, 255, 255, 0.1)',
        textColor: 'rgba(255, 255, 255, 0.5)',
        fontSize: 9,
      });
    }
  }
}
