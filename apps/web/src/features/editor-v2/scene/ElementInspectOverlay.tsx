/**
 * ElementInspectOverlay
 * Renders over the canvas when inspect mode is active.
 * On hover: highlights elements with data-element-name attributes.
 * On click: selects the element, enables spotlight, and triggers AI chat.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../store/editor-store';
import type { SelectedElement, VisualItemData } from '../store/types';

interface ElementRect {
  name: string;
  left: number;
  top: number;
  width: number;
  height: number;
  area: number;
}

/**
 * Scan the player container for all elements with data-element-name
 * and return their bounding rects relative to the container.
 */
function scanElements(container: HTMLElement): ElementRect[] {
  const containerRect = container.getBoundingClientRect();
  if (containerRect.width === 0 || containerRect.height === 0) return [];

  const els = container.querySelectorAll('[data-element-name]');
  const results: ElementRect[] = [];

  els.forEach((el) => {
    const name = (el as HTMLElement).dataset.elementName;
    if (!name) return;
    const r = el.getBoundingClientRect();
    if (r.width < 5 || r.height < 5) return;

    results.push({
      name,
      left: r.left - containerRect.left,
      top: r.top - containerRect.top,
      width: r.width,
      height: r.height,
      area: r.width * r.height,
    });
  });

  return results;
}

/**
 * Find the smallest (most specific) element whose rect contains the point.
 */
function findElementAtPoint(
  elements: ElementRect[],
  x: number,
  y: number,
): ElementRect | null {
  let best: ElementRect | null = null;

  for (const el of elements) {
    if (
      x >= el.left &&
      x <= el.left + el.width &&
      y >= el.top &&
      y <= el.top + el.height
    ) {
      if (!best || el.area < best.area) {
        best = el;
      }
    }
  }

  return best;
}

interface ElementInspectOverlayProps {
  playerContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function ElementInspectOverlay({ playerContainerRef }: ElementInspectOverlayProps) {
  const [hoveredElement, setHoveredElement] = useState<ElementRect | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [hasElements, setHasElements] = useState(true); // optimistic to avoid flash
  const elementsRef = useRef<ElementRect[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Scan elements on mount and periodically (compositions may lazy-load)
  useEffect(() => {
    const scan = () => {
      if (!playerContainerRef.current) return;
      const found = scanElements(playerContainerRef.current);
      elementsRef.current = found;
      setHasElements(found.length > 0);
    };

    scan();
    const interval = setInterval(scan, 1000);
    return () => clearInterval(interval);
  }, [playerContainerRef]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!overlayRef.current) return;
      const rect = overlayRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setMousePos({ x, y });

      const hit = findElementAtPoint(elementsRef.current, x, y);
      setHoveredElement(hit);
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredElement(null);
    setMousePos(null);
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!hoveredElement) return;

      // Determine which scene this element belongs to from current playback time
      const state = useEditorStore.getState();
      const currentTime = state.currentTimeMs;

      // Find the visual item that spans the current time
      let sceneId = 0;
      const visualItems = state.itemIds
        .map((id) => state.items[id])
        .filter((item) => item?.type === 'visual')
        .sort((a, b) => a.startMs - b.startMs);

      for (let i = 0; i < visualItems.length; i++) {
        const item = visualItems[i];
        if (item.startMs <= currentTime && item.endMs > currentTime) {
          sceneId = i + 1; // 1-indexed scene
          break;
        }
      }

      const element: SelectedElement = {
        name: hoveredElement.name,
        type: 'element',
        sceneId,
        position: {
          x: `${Math.round(hoveredElement.left)}px`,
          y: `${Math.round(hoveredElement.top)}px`,
        },
        size: {
          width: `${Math.round(hoveredElement.width)}px`,
          height: `${Math.round(hoveredElement.height)}px`,
        },
      };

      // Set selection state
      useEditorStore.setState({
        selectedElement: element,
        elementPickerEnabled: true,
        inspectModeEnabled: false,
        aiEditRequested: true,
      });
    },
    [hoveredElement],
  );

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-30"
      style={{ cursor: hoveredElement ? 'crosshair' : 'default', pointerEvents: 'auto' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* Hover highlight */}
      {hoveredElement && (
        <>
          <div
            className="absolute pointer-events-none transition-all duration-75"
            style={{
              left: hoveredElement.left,
              top: hoveredElement.top,
              width: hoveredElement.width,
              height: hoveredElement.height,
              border: '2px solid var(--editor-accent, #8b5cf6)',
              borderRadius: 4,
              backgroundColor: 'rgba(139, 92, 246, 0.08)',
              boxShadow: '0 0 0 1px rgba(139, 92, 246, 0.3)',
            }}
          />

          {/* Element name tooltip near cursor */}
          {mousePos && (
            <div
              className="absolute pointer-events-none px-2 py-1 rounded-md text-xs font-normal text-white bg-black/80 backdrop-blur-sm border border-white/10 whitespace-nowrap"
              style={{
                left: Math.min(mousePos.x + 16, (overlayRef.current?.clientWidth ?? 1000) - 150),
                top: Math.min(mousePos.y + 16, (overlayRef.current?.clientHeight ?? 800) - 40),
              }}
            >
              {hoveredElement.name}
            </div>
          )}
        </>
      )}

      {/* Hint when no element is hovered */}
      {!hoveredElement && !hasElements && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="px-4 py-2 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10">
            <span className="text-white/60 text-xs">
              No inspectable elements found. Generate visuals first.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
