/**
 * Renderer Registry
 * A simple map-based registry that associates item type strings with their
 * ItemRenderer implementation. Renderers are registered by later tasks;
 * the registry starts empty so existing CanvasRenderer logic is the fallback.
 */

import { ItemRenderer } from './types';

const renderers = new Map<string, ItemRenderer>();

/** Register an ItemRenderer for a given timeline item type (e.g. 'video', 'audio'). */
export function registerRenderer(type: string, renderer: ItemRenderer): void {
  renderers.set(type, renderer);
}

/** Look up the registered renderer for a type. Returns undefined if none registered. */
export function getRenderer(type: string): ItemRenderer | undefined {
  return renderers.get(type);
}
