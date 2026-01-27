/**
 * Renderer Types
 * Interfaces for the modular item renderer system.
 * Each timeline item type can register its own renderer via the registry.
 */

import { TimelineItem } from '../../../store/types';

/** The pixel-space rectangle of an item on the canvas */
export interface ItemRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Contextual state passed to each item renderer */
export interface RenderItemState {
  isSelected: boolean;
  isHovered: boolean;
  isDragPreview: boolean;
  isInvalid: boolean;
  zoom: number;
}

/** Interface that per-type item renderers must implement */
export interface ItemRenderer {
  draw(
    ctx: CanvasRenderingContext2D,
    item: TimelineItem,
    rect: ItemRect,
    state: RenderItemState
  ): void;
}
