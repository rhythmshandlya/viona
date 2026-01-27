/**
 * Canvas Renderer
 * Handles all canvas drawing for the timeline
 */

import {
  Track,
  TimelineItem,
  Viewport,
  SelectionBox,
  DragState,
  CaptionItemData,
  AudioItemData,
  VideoItemData,
  SnapTarget,
} from '../../store/types';
import { DragPreview } from '../interactions/DragManager';
import { getRenderer } from './renderers/registry';
import { ItemRect, RenderItemState } from './renderers/types';

export interface RenderState {
  tracks: Track[];
  items: Record<string, TimelineItem>;
  itemIds: string[];
  selectedIds: string[];
  currentTimeMs: number;
  duration: number;
  viewport: Viewport;
  selectionBox: SelectionBox | null;
  dragState: DragState | null;
  // Phase 2: Drag previews and snap lines
  dragPreviews?: DragPreview[];
  snapLines?: { position: number; type: SnapTarget['type'] }[];
  // Split tool state
  splitMode?: boolean;
  splitCursorTimeMs?: number;
}

export interface CanvasRendererOptions {
  trackHeaderWidth: number;
  rulerHeight: number;
  backgroundColor: string;
  trackBackgroundColor: string;
  trackBorderColor: string;
  itemColors: {
    video: string;
    audio: string;
    caption: string;
    text: string;
    image: string;
  };
  selectedBorderColor: string;
  playheadColor: string;
  selectionBoxColor: string;
  textColor: string;
  // Phase 2: Snap and preview colors
  snapLineColor: string;
  snapLinePlayheadColor: string;
  previewOpacity: number;
  invalidPreviewColor: string;
  resizeHandleColor: string;
  resizeHandleSize: number;
}

const DEFAULT_OPTIONS: CanvasRendererOptions = {
  trackHeaderWidth: 0, // No track headers in this version
  rulerHeight: 0, // Ruler is separate component
  backgroundColor: '#18181b', // zinc-900
  trackBackgroundColor: '#27272a', // zinc-800
  trackBorderColor: '#3f3f46', // zinc-700
  itemColors: {
    video: '#3b82f6', // blue-500
    audio: '#22c55e', // green-500
    caption: '#a855f7', // purple-500
    text: '#f59e0b', // amber-500
    image: '#ec4899', // pink-500
  },
  selectedBorderColor: '#ffffff',
  playheadColor: '#ef4444', // red-500
  selectionBoxColor: 'rgba(59, 130, 246, 0.3)', // blue with opacity
  textColor: '#fafafa', // zinc-50
  // Phase 2: Snap and preview colors
  snapLineColor: '#22c55e', // green-500
  snapLinePlayheadColor: '#ef4444', // red-500
  previewOpacity: 0.5,
  invalidPreviewColor: '#ef4444', // red-500
  resizeHandleColor: '#ffffff',
  resizeHandleSize: 6,
};

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private options: CanvasRendererOptions;
  private dpr: number;
  private animationFrameId: number | null = null;

  constructor(canvas: HTMLCanvasElement, options?: Partial<CanvasRendererOptions>) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas 2d context');
    }
    this.ctx = ctx;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.dpr = window.devicePixelRatio || 1;
    this.setupCanvas();
  }

  private setupCanvas(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
  }

  public resize(): void {
    this.dpr = window.devicePixelRatio || 1;
    this.setupCanvas();
  }

  public getWidth(): number {
    return this.canvas.width / this.dpr;
  }

  public getHeight(): number {
    return this.canvas.height / this.dpr;
  }

  /**
   * Main render function - call this to redraw the timeline
   */
  public render(state: RenderState): void {
    const { ctx, options } = this;
    const width = this.getWidth();
    const height = this.getHeight();

    // Clear canvas
    ctx.fillStyle = options.backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Draw track backgrounds
    this.drawTrackBackgrounds(state);

    // Draw items
    this.drawItems(state);

    // Draw drag previews (ghost items)
    if (state.dragPreviews && state.dragPreviews.length > 0) {
      this.drawDragPreviews(state);
    }

    // Draw snap lines
    if (state.snapLines && state.snapLines.length > 0) {
      this.drawSnapLines(state);
    }

    // Draw selection box if active
    if (state.selectionBox) {
      this.drawSelectionBox(state.selectionBox);
    }

    // Draw resize handles on selected items
    this.drawResizeHandles(state);

    // Draw split line indicator when split mode is active
    if (state.splitMode && state.splitCursorTimeMs !== undefined) {
      this.drawSplitLine(state);
    }

    // Draw playhead
    this.drawPlayhead(state);
  }

  /**
   * Request animation frame render
   */
  public requestRender(state: RenderState): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.animationFrameId = requestAnimationFrame(() => {
      this.render(state);
      this.animationFrameId = null;
    });
  }

  private drawTrackBackgrounds(state: RenderState): void {
    const { ctx, options } = this;
    const width = this.getWidth();
    const { viewport, tracks } = state;

    let y = -viewport.scrollY;

    for (const track of tracks) {
      if (y + track.height < 0) {
        y += track.height;
        continue;
      }

      if (y > this.getHeight()) {
        break;
      }

      // Track background
      ctx.fillStyle = options.trackBackgroundColor;
      ctx.fillRect(0, y, width, track.height);

      // Track border (bottom)
      ctx.strokeStyle = options.trackBorderColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + track.height - 0.5);
      ctx.lineTo(width, y + track.height - 0.5);
      ctx.stroke();

      y += track.height;
    }
  }

  private drawItems(state: RenderState): void {
    const { viewport, tracks, items, itemIds, selectedIds } = state;
    const width = this.getWidth();

    // Calculate visible time range
    const visibleStartMs = viewport.scrollX / viewport.zoom;
    const visibleEndMs = (viewport.scrollX + width) / viewport.zoom;

    // Build track position map
    const trackYMap = new Map<string, number>();
    let y = -viewport.scrollY;
    for (const track of tracks) {
      trackYMap.set(track.id, y);
      y += track.height;
    }

    // Draw each visible item
    for (const itemId of itemIds) {
      const item = items[itemId];
      if (!item) continue;

      // Skip if not visible horizontally
      if (item.endMs < visibleStartMs || item.startMs > visibleEndMs) {
        continue;
      }

      const trackY = trackYMap.get(item.trackId);
      if (trackY === undefined) continue;

      const track = tracks.find((t) => t.id === item.trackId);
      if (!track) continue;

      const isSelected = selectedIds.includes(item.id);
      this.drawItem(item, track, trackY, viewport, isSelected);
    }
  }

  private drawItem(
    item: TimelineItem,
    track: Track,
    trackY: number,
    viewport: Viewport,
    isSelected: boolean
  ): void {
    const { ctx, options } = this;

    // Calculate position
    const x = item.startMs * viewport.zoom - viewport.scrollX;
    const width = (item.endMs - item.startMs) * viewport.zoom;
    const y = trackY + 4; // 4px padding
    const height = track.height - 8; // 8px total padding

    // Skip if off screen
    if (x + width < 0 || x > this.getWidth()) {
      return;
    }

    // Try the renderer registry first
    const renderer = getRenderer(item.type);
    if (renderer) {
      const rect: ItemRect = { x, y, width, height };
      const renderState: RenderItemState = {
        isSelected,
        isHovered: false,
        isDragPreview: false,
        isInvalid: false,
        zoom: viewport.zoom,
      };
      renderer.draw(ctx, item, rect, renderState);
      return; // Skip fallback
    }

    // --- Fallback: legacy inline drawing ---

    // Item background
    const color = options.itemColors[item.type] || options.itemColors.text;
    ctx.fillStyle = color;
    this.roundRect(x, y, width, height, 4);
    ctx.fill();

    // Selected border
    if (isSelected) {
      ctx.strokeStyle = options.selectedBorderColor;
      ctx.lineWidth = 2;
      this.roundRect(x, y, width, height, 4);
      ctx.stroke();
    }

    // Draw item content based on type
    switch (item.type) {
      case 'video':
        this.drawVideoItem(item, x, y, width, height);
        break;
      case 'audio':
        this.drawAudioItem(item, x, y, width, height);
        break;
      case 'caption':
        this.drawCaptionItem(item, x, y, width, height);
        break;
      default:
        this.drawDefaultItem(item, x, y, width, height);
    }
  }

  private drawVideoItem(
    item: TimelineItem,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const { ctx, options } = this;

    // Draw video icon
    ctx.fillStyle = options.textColor;
    ctx.font = '12px system-ui, sans-serif';
    ctx.textBaseline = 'middle';

    const padding = 8;
    const iconSize = 14;

    // Video icon (simple triangle play symbol)
    if (width > iconSize + padding * 2) {
      ctx.beginPath();
      ctx.moveTo(x + padding, y + height / 2 - 6);
      ctx.lineTo(x + padding, y + height / 2 + 6);
      ctx.lineTo(x + padding + 10, y + height / 2);
      ctx.closePath();
      ctx.fill();
    }

    // Label
    if (width > 80) {
      ctx.fillText('Video', x + padding + iconSize + 4, y + height / 2);
    }

    // Muted indicator
    const videoData = item.data as VideoItemData;
    if (videoData.muted && width > 120) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText('Muted', x + padding + iconSize + 50, y + height / 2);
    }
  }

  private drawAudioItem(
    item: TimelineItem,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const { ctx, options } = this;
    const data = item.data as AudioItemData;

    // Draw simple waveform visualization
    ctx.strokeStyle = options.textColor;
    ctx.lineWidth = 1;
    ctx.beginPath();

    const waveHeight = height * 0.6;
    const centerY = y + height / 2;
    const steps = Math.min(width / 3, 50);

    for (let i = 0; i < steps; i++) {
      const xPos = x + (i / steps) * width;
      const amplitude = Math.sin(i * 0.5) * (waveHeight / 2) * 0.7;
      if (i === 0) {
        ctx.moveTo(xPos, centerY + amplitude);
      } else {
        ctx.lineTo(xPos, centerY + amplitude);
      }
    }
    ctx.stroke();

    // Draw enhancement badge or processing indicator
    if (data.enhancementStatus === 'processing') {
      // Pulsing indicator
      const badgeX = x + width - 70;
      const badgeY = y + 4;
      if (width > 80) {
        ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
        this.roundRect(badgeX, badgeY, 62, 18, 4);
        ctx.fill();
        ctx.fillStyle = '#22c55e';
        ctx.font = '10px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText('Enhancing...', badgeX + 4, badgeY + 9);
      }
    } else if (data.isEnhanced && data.enhancementStatus === 'complete') {
      // Green "Enhanced" badge
      const badgeX = x + width - 68;
      const badgeY = y + 4;
      if (width > 80) {
        ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
        this.roundRect(badgeX, badgeY, 60, 18, 4);
        ctx.fill();
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1;
        this.roundRect(badgeX, badgeY, 60, 18, 4);
        ctx.stroke();
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText('Enhanced', badgeX + 6, badgeY + 9);
      }
    }
  }

  private drawCaptionItem(
    item: TimelineItem,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const { ctx, options } = this;
    const data = item.data as CaptionItemData;

    // Draw text preview
    ctx.fillStyle = options.textColor;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textBaseline = 'middle';

    const padding = 8;
    const maxTextWidth = width - padding * 2;

    if (maxTextWidth > 20) {
      // Truncate text if needed
      let text = data.text || '';
      const metrics = ctx.measureText(text);
      if (metrics.width > maxTextWidth) {
        while (ctx.measureText(text + '...').width > maxTextWidth && text.length > 0) {
          text = text.slice(0, -1);
        }
        text += '...';
      }

      ctx.fillText(text, x + padding, y + height / 2);
    }
  }

  private drawDefaultItem(
    item: TimelineItem,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const { ctx, options } = this;

    // Just draw the type label
    ctx.fillStyle = options.textColor;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textBaseline = 'middle';

    const padding = 8;
    if (width > 40) {
      ctx.fillText(item.type, x + padding, y + height / 2);
    }
  }

  /**
   * Draw split line indicator — vertical dashed red/orange line at cursor time position
   */
  private drawSplitLine(state: RenderState): void {
    const { ctx } = this;
    const { viewport, splitCursorTimeMs } = state;
    const height = this.getHeight();

    if (splitCursorTimeMs === undefined) return;

    // Calculate x position from time
    const x = splitCursorTimeMs * viewport.zoom - viewport.scrollX;

    // Skip if off screen
    if (x < 0 || x > this.getWidth()) {
      return;
    }

    // Draw vertical dashed line in red/orange
    ctx.save();
    ctx.strokeStyle = '#f97316'; // orange-500
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  private drawPlayhead(state: RenderState): void {
    const { ctx, options } = this;
    const { viewport, currentTimeMs } = state;
    const height = this.getHeight();

    // Calculate playhead position
    const x = currentTimeMs * viewport.zoom - viewport.scrollX;

    // Skip if off screen
    if (x < 0 || x > this.getWidth()) {
      return;
    }

    // Draw playhead line
    ctx.strokeStyle = options.playheadColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    // Draw playhead handle at top
    ctx.fillStyle = options.playheadColor;
    ctx.beginPath();
    ctx.moveTo(x - 6, 0);
    ctx.lineTo(x + 6, 0);
    ctx.lineTo(x + 6, 8);
    ctx.lineTo(x, 14);
    ctx.lineTo(x - 6, 8);
    ctx.closePath();
    ctx.fill();
  }

  private drawSelectionBox(box: SelectionBox): void {
    const { ctx, options } = this;

    const x = Math.min(box.startX, box.endX);
    const y = Math.min(box.startY, box.endY);
    const width = Math.abs(box.endX - box.startX);
    const height = Math.abs(box.endY - box.startY);

    // Fill
    ctx.fillStyle = options.selectionBoxColor;
    ctx.fillRect(x, y, width, height);

    // Border
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
  }

  /**
   * Draw drag preview ghosts
   */
  private drawDragPreviews(state: RenderState): void {
    const { ctx, options } = this;
    const { viewport, tracks, items, dragPreviews } = state;

    if (!dragPreviews) return;

    // Build track position map
    const trackYMap = new Map<string, number>();
    let y = -viewport.scrollY;
    for (const track of tracks) {
      trackYMap.set(track.id, y);
      y += track.height;
    }

    ctx.save();
    ctx.globalAlpha = options.previewOpacity;

    for (const preview of dragPreviews) {
      const trackY = trackYMap.get(preview.previewTrackId);
      if (trackY === undefined) continue;

      const track = tracks.find((t) => t.id === preview.previewTrackId);
      if (!track) continue;

      // Calculate preview position
      const x = preview.previewStartMs * viewport.zoom - viewport.scrollX;
      const width = (preview.previewEndMs - preview.previewStartMs) * viewport.zoom;
      const itemY = trackY + 4;
      const height = track.height - 8;

      // Get item type for color
      const originalItem = items[preview.itemId];
      const itemType = originalItem?.type || 'text';
      const color = preview.isValid
        ? (options.itemColors[itemType] || options.itemColors.text)
        : options.invalidPreviewColor;

      // Draw preview rectangle
      ctx.fillStyle = color;
      this.roundRect(x, itemY, width, height, 4);
      ctx.fill();

      // Draw dashed border
      ctx.strokeStyle = preview.isValid ? options.selectedBorderColor : options.invalidPreviewColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      this.roundRect(x, itemY, width, height, 4);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  /**
   * Draw snap indicator lines
   */
  private drawSnapLines(state: RenderState): void {
    const { ctx, options } = this;
    const { viewport, snapLines } = state;
    const height = this.getHeight();

    if (!snapLines) return;

    for (const line of snapLines) {
      const x = line.position * viewport.zoom - viewport.scrollX;

      // Skip if off screen
      if (x < 0 || x > this.getWidth()) continue;

      // Choose color based on type
      const color = line.type === 'playhead'
        ? options.snapLinePlayheadColor
        : options.snapLineColor;

      // Draw snap line
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw small indicator at top
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, 8, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Draw resize handles on selected items
   */
  private drawResizeHandles(state: RenderState): void {
    const { ctx, options } = this;
    const { viewport, tracks, items, selectedIds, dragState } = state;

    // Don't draw handles while dragging (except for resize)
    if (dragState && dragState.type !== 'resize-left' && dragState.type !== 'resize-right') {
      return;
    }

    // Only draw handles for single selection
    if (selectedIds.length !== 1) return;

    const itemId = selectedIds[0];
    const item = items[itemId];
    if (!item) return;

    // Build track position map
    const trackYMap = new Map<string, number>();
    let y = -viewport.scrollY;
    for (const track of tracks) {
      trackYMap.set(track.id, y);
      y += track.height;
    }

    const trackY = trackYMap.get(item.trackId);
    if (trackY === undefined) return;

    const track = tracks.find((t) => t.id === item.trackId);
    if (!track) return;

    // Calculate item position
    const x = item.startMs * viewport.zoom - viewport.scrollX;
    const width = (item.endMs - item.startMs) * viewport.zoom;
    const itemY = trackY + 4;
    const height = track.height - 8;

    const handleSize = options.resizeHandleSize;
    const handleY = itemY + height / 2 - handleSize / 2;

    // Left handle
    ctx.fillStyle = options.resizeHandleColor;
    ctx.fillRect(x - handleSize / 2, handleY, handleSize, handleSize);
    ctx.strokeStyle = options.trackBorderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - handleSize / 2, handleY, handleSize, handleSize);

    // Right handle
    ctx.fillStyle = options.resizeHandleColor;
    ctx.fillRect(x + width - handleSize / 2, handleY, handleSize, handleSize);
    ctx.strokeStyle = options.trackBorderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + width - handleSize / 2, handleY, handleSize, handleSize);
  }

  /**
   * Helper to draw rounded rectangles
   */
  private roundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    const { ctx } = this;

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
   * Cleanup
   */
  public destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}
