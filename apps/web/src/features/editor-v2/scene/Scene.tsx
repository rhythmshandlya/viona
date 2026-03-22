/**
 * Scene Component
 * Maximized preview area containing the Remotion player
 * with optional social platform preview overlay
 */

'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Player } from '../player/Player';
import { useProject, useSelectedElement, useElementPickerEnabled, useInspectModeEnabled, useIsPlaying, useEditorStore, useCurrentTimeMs } from '../store/use-editor-store';
import { SocialPreviewOverlay } from './SocialPreviewOverlay';
import { ElementInspectOverlay } from './ElementInspectOverlay';
import { CaptionDragOverlay } from '../components/CaptionDragOverlay';
import { ItemDragOverlay } from '../components/ItemDragOverlay';
import { type SocialPlatform, type OverlayMode } from './social-platforms';

interface HighlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Find a selected element by its data-element-name attribute.
 * New compositions add these attributes; for old ones we return null
 * and the fallback overlay is shown.
 */
function findElementByDataAttr(
  container: HTMLElement,
  elementName: string,
): HighlightRect | null {
  const containerRect = container.getBoundingClientRect();
  if (containerRect.width === 0 || containerRect.height === 0) return null;

  // Try various casing/formatting of the name
  const variants = new Set([
    elementName,
    elementName.toLowerCase(),
    elementName.toLowerCase().replace(/\s+/g, '-'),
    elementName.toLowerCase().replace(/\s+/g, ''),
    // Reverse the name extraction: "Primary" → "primary", "Title Text" → "titleText"
    elementName.charAt(0).toLowerCase() + elementName.slice(1).replace(/\s+(.)/g, (_, c: string) => c.toUpperCase()),
  ]);

  for (const name of variants) {
    const el = container.querySelector(`[data-element-name="${name}"]`) as HTMLElement | null;
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 5 && r.height > 5) {
        return {
          left: r.left - containerRect.left,
          top: r.top - containerRect.top,
          width: r.width,
          height: r.height,
        };
      }
    }
  }

  return null;
}

/** Resolve a transform value (number or "100%") to canvas pixels */
function resolveValue(v: number | string, canvasSize: number): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.endsWith('%')) {
    return (parseFloat(v) / 100) * canvasSize;
  }
  return parseFloat(String(v)) || 0;
}

const NON_SPATIAL_TYPES = new Set(['audio', 'caption']);

interface SceneProps {
  className?: string;
  activePlatform: SocialPlatform | null;
  overlayMode: OverlayMode;
  padding?: number;
}

export function Scene({ className, activePlatform, overlayMode, padding = 64 }: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const project = useProject();
  const selectedElement = useSelectedElement();
  const elementPickerEnabled = useElementPickerEnabled();
  const inspectModeEnabled = useInspectModeEnabled();
  const isPlaying = useIsPlaying();
  const currentTimeMs = useCurrentTimeMs();
  const select = useEditorStore((s) => s.select);
  const [scale, setScale] = useState(1);
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);

  /** Click-to-select: hit-test canvas items at click position */
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!project || !playerContainerRef.current) return;
    // Don't intercept if element picker is active
    if (elementPickerEnabled) return;

    const rect = playerContainerRef.current.getBoundingClientRect();
    const cssZoom = parseFloat(getComputedStyle(playerContainerRef.current).zoom || '1');
    const canvasX = (e.clientX - rect.left) / cssZoom;
    const canvasY = (e.clientY - rect.top) / cssZoom;

    const videoWidth = project.videoSettings.canvasWidth;
    const videoHeight = project.videoSettings.canvasHeight;
    const state = useEditorStore.getState();

    // Get items visible at current time, sorted by track position (highest = frontmost)
    const trackPositions = new Map<string, number>();
    for (const t of Object.values(state.tracks)) {
      trackPositions.set(t.id, t.position ?? 0);
    }

    const visibleItems = state.itemIds
      .map((id) => state.items[id])
      .filter((item) =>
        item &&
        !NON_SPATIAL_TYPES.has(item.type) &&
        item.startMs <= currentTimeMs &&
        item.endMs > currentTimeMs
      )
      // Sort: overlays/visuals first, video last (video covers full canvas and would eat all clicks)
      .sort((a, b) => {
        if (a.type === 'video' && b.type !== 'video') return 1;
        if (b.type === 'video' && a.type !== 'video') return -1;
        return (trackPositions.get(b.trackId) ?? 0) - (trackPositions.get(a.trackId) ?? 0);
      });

    for (const item of visibleItems) {
      const t = item.transform ?? { x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1 };
      const ix = resolveValue(t.x, videoWidth);
      const iy = resolveValue(t.y, videoHeight);
      const iw = resolveValue(t.width, videoWidth);
      const ih = resolveValue(t.height, videoHeight);

      if (canvasX >= ix && canvasX <= ix + iw && canvasY >= iy && canvasY <= iy + ih) {
        select([item.id], 'replace');
        return;
      }
    }

    // Clicked on empty space — deselect
    select([], 'replace');
  }, [project, currentTimeMs, elementPickerEnabled, select]);

  // Calculate scale to fit player in container
  const calculateScale = useCallback(() => {
    if (!containerRef.current || !project) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth - padding;
    const containerHeight = container.clientHeight - padding;

    if (containerWidth <= 0 || containerHeight <= 0) return;

    const videoWidth = project.videoSettings.canvasWidth;
    const videoHeight = project.videoSettings.canvasHeight;

    const scaleX = containerWidth / videoWidth;
    const scaleY = containerHeight / videoHeight;
    setScale(Math.min(scaleX, scaleY));
  }, [project, padding]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    calculateScale();
    let rafId: number | null = null;
    const ro = new ResizeObserver(() => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        calculateScale();
        rafId = null;
      });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [calculateScale]);

  // Look for data-element-name in the rendered composition DOM
  useEffect(() => {
    if (!elementPickerEnabled || !selectedElement || !playerContainerRef.current) {
      setHighlightRect(null);
      return;
    }

    const tryFind = () => {
      if (!playerContainerRef.current || !selectedElement) return;
      const rect = findElementByDataAttr(playerContainerRef.current, selectedElement.name);
      setHighlightRect(rect);
    };

    // Retry a few times as the composition may still be loading
    tryFind();
    const t1 = setTimeout(tryFind, 500);
    const t2 = setTimeout(tryFind, 1200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [elementPickerEnabled, selectedElement]);

  if (!project) {
    return (
      <div className={`flex items-center justify-center bg-[var(--editor-bg-base)] ${className || ''}`}>
        <p className="text-[var(--editor-text-muted)] text-sm">Loading...</p>
      </div>
    );
  }

  const videoWidth = project.videoSettings.canvasWidth;
  const videoHeight = project.videoSettings.canvasHeight;

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center bg-[var(--editor-bg-base)] overflow-hidden ${className || ''}`}
    >
      {/* Outer wrapper with actual display dimensions */}
      <div
        className="relative rounded-lg overflow-hidden shadow-2xl"
        style={{
          width: Math.round(videoWidth * scale),
          height: Math.round(videoHeight * scale),
        }}
      >
        {/* Inner container at native resolution, scaled with CSS zoom for crisp text */}
        <div
          ref={playerContainerRef}
          style={{
            width: videoWidth,
            height: videoHeight,
            zoom: scale,
          }}
          onClick={handleCanvasClick}
        >
          <Player />

          {/* Element inspect mode overlay */}
          {inspectModeEnabled && !isPlaying && (
            <ElementInspectOverlay playerContainerRef={playerContainerRef} />
          )}

          {/* Item drag/resize overlay for V2 transforms (rendered first = lower z-priority) */}
          <ItemDragOverlay
            containerRef={playerContainerRef}
            canvasWidth={videoWidth}
            canvasHeight={videoHeight}
          />

          {/* Caption drag/resize/rotate overlay (rendered last = highest click priority) */}
          <CaptionDragOverlay
            containerRef={playerContainerRef}
            canvasWidth={videoWidth}
            canvasHeight={videoHeight}
          />

          {/* Element selection overlay */}
          {elementPickerEnabled && selectedElement && (
            <div className="absolute inset-0 pointer-events-none z-20">
              {highlightRect ? (
                /* Spotlight: element visible, everything else dimmed */
                <div
                  className="absolute rounded-sm"
                  style={{
                    left: highlightRect.left,
                    top: highlightRect.top,
                    width: highlightRect.width,
                    height: highlightRect.height,
                    border: '2px solid var(--editor-accent, #8b5cf6)',
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55), 0 0 16px rgba(139, 92, 246, 0.5)',
                  }}
                />
              ) : (
                /* Dim overlay for compositions without data-element-name */
                <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
                  {/* Centered indicator */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2 px-5 py-3 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full animate-pulse"
                          style={{ backgroundColor: 'var(--editor-accent, #8b5cf6)' }}
                        />
                        <span className="text-white text-sm font-normal">
                          {selectedElement.name}
                        </span>
                      </div>
                      <span className="text-white/40 text-[10px]">
                        Regenerate visuals to enable element highlighting
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {/* Element context is shown in the AI chat panel header via aiContext */}
            </div>
          )}

          {/* Social preview overlay */}
          {activePlatform && (
            <SocialPreviewOverlay
              platform={activePlatform}
              mode={overlayMode}
              width={videoWidth}
              height={videoHeight}
            />
          )}
        </div>
      </div>
    </div>
  );
}
