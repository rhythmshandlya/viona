/**
 * ElementPickerOverlay Component
 * Renders clickable overlay regions on top of the video preview
 * allowing users to click on elements to select them for AI editing.
 * When an element is already selected (from AssetsPanel), it highlights
 * only that element while dimming the rest of the composition.
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MousePointer2, X } from 'lucide-react';
import { api, SceneInfo, ExtractedAsset } from '@/lib/api';
import {
  useCurrentTimeMs,
  useEditorActions,
  useSelectedElement,
  useProjectId,
} from '../store/use-editor-store';
import { SelectedElement } from '../store/types';

interface ElementPickerOverlayProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function ElementPickerOverlay({ enabled, onToggle }: ElementPickerOverlayProps) {
  const [assets, setAssets] = useState<ExtractedAsset[]>([]);
  const [scenes, setScenes] = useState<SceneInfo[]>([]);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);

  const projectId = useProjectId();
  const currentTimeMs = useCurrentTimeMs();
  const selectedElement = useSelectedElement();
  const { setSelectedElement } = useEditorActions();

  // Fetch assets and scenes data
  useEffect(() => {
    if (projectId) {
      Promise.all([
        api.getAssets(projectId),
        api.getScenes(projectId),
      ]).then(([assetsData, scenesData]) => {
        setAssets(assetsData.assets);
        setScenes(scenesData.scenes);
      }).catch(err => console.warn('Failed to fetch overlay data:', err));
    }
  }, [projectId]);

  // Find current scene based on playhead position
  const currentScene = useMemo(() => {
    return scenes.find(s => currentTimeMs >= s.startMs && currentTimeMs < s.endMs) || null;
  }, [scenes, currentTimeMs]);

  // Assets in the current scene (by playhead or by selected element's scene)
  const visibleAssets = useMemo(() => {
    const sceneId = selectedElement?.sceneId ?? currentScene?.id;
    if (!sceneId) return [];
    return assets.filter(a => a.sceneId === sceneId && a.type !== 'background');
  }, [assets, selectedElement, currentScene]);

  const handleElementClick = useCallback((asset: ExtractedAsset) => {
    // Toggle off if clicking same element
    if (selectedElement?.name === asset.name && selectedElement?.sceneId === asset.sceneId) {
      setSelectedElement(null);
      return;
    }
    setSelectedElement({
      name: asset.name,
      type: asset.type,
      sceneId: asset.sceneId,
      description: asset.description,
    });
  }, [selectedElement, setSelectedElement]);

  const handleClearSelection = useCallback(() => {
    setSelectedElement(null);
    onToggle(false);
  }, [setSelectedElement, onToggle]);

  // Parse position/size string to percentage number
  const parsePosition = (value: string): number => {
    if (!value) return 50;
    if (value === 'center') return 50;
    const match = value.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 50;
  };

  const parseSize = (value: string): number => {
    if (!value) return 20;
    if (value === '100%') return 100;
    const match = value.match(/(\d+(?:\.\d+)?)/);
    const size = match ? parseFloat(match[1]) : 20;
    return Math.max(size, 10);
  };

  if (!enabled) {
    return null;
  }

  const hasSelection = !!selectedElement;

  return (
    <div className="absolute inset-0 z-20">
      {/* Dim overlay when an element is selected */}
      {hasSelection && (
        <div
          className="absolute inset-0 bg-black/50 transition-opacity duration-300"
          onClick={handleClearSelection}
        />
      )}

      {/* Top bar */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 bg-black/80 rounded-full flex items-center gap-2 text-xs text-white">
        <MousePointer2 size={14} />
        <span>{hasSelection ? selectedElement.name : 'Click an element to select it'}</span>
        <button
          onClick={handleClearSelection}
          className="ml-2 p-0.5 rounded hover:bg-white/20"
        >
          <X size={14} />
        </button>
      </div>

      {/* Element overlays */}
      {visibleAssets.map((asset, index) => {
        const pos = asset.position;
        const sz = asset.size;
        if (!pos || !sz) return null;

        const x = parsePosition(pos.x);
        const y = parsePosition(pos.y);
        const width = parseSize(sz.width);
        const height = parseSize(sz.height);

        const isSelected = hasSelection &&
          selectedElement.name === asset.name &&
          selectedElement.sceneId === asset.sceneId;
        const isDimmed = hasSelection && !isSelected;
        const isHovered = hoveredElement === `${asset.sceneId}-${asset.name}`;

        return (
          <button
            key={`${asset.sceneId}-${asset.name}-${index}`}
            onClick={() => handleElementClick(asset)}
            onMouseEnter={() => setHoveredElement(`${asset.sceneId}-${asset.name}`)}
            onMouseLeave={() => setHoveredElement(null)}
            className={`absolute rounded-lg transition-all duration-300 cursor-pointer ${
              isSelected
                ? 'border-2 border-[var(--editor-accent)] bg-[var(--editor-accent)]/15 shadow-[0_0_20px_rgba(var(--editor-accent-rgb,99,102,241),0.5)] z-20 scale-105'
                : isDimmed
                ? 'border border-white/10 bg-black/30 opacity-40 z-10'
                : isHovered
                ? 'border-2 border-white/60 bg-white/10 z-20'
                : 'border-2 border-white/40 bg-white/5 hover:border-white/60 z-10'
            }`}
            style={{
              left: `${x - width / 2}%`,
              top: `${y - height / 2}%`,
              width: `${width}%`,
              height: `${height}%`,
            }}
          >
            {/* Label */}
            <div
              className={`absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap shadow-lg transition-all duration-300 ${
                isSelected
                  ? 'bg-[var(--editor-accent)] text-white scale-110'
                  : isDimmed
                  ? 'bg-black/60 text-white/40 scale-90'
                  : 'bg-black/90 text-white'
              }`}
            >
              {asset.name}
            </div>

            {/* Glow ring for selected element */}
            {isSelected && (
              <div className="absolute inset-0 rounded-lg animate-pulse border border-[var(--editor-accent)]/40" />
            )}
          </button>
        );
      })}

      {/* Bottom indicator for selected element */}
      {hasSelection && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 bg-[var(--editor-accent)] rounded-full flex items-center gap-2 text-xs text-white">
          <span className="font-medium">{selectedElement.name}</span>
          <span className="opacity-70">Scene {selectedElement.sceneId}</span>
          <button
            onClick={handleClearSelection}
            className="ml-1 p-0.5 rounded hover:bg-white/20"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Toggle button for element picker mode
 */
export function ElementPickerToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <button
      onClick={() => onToggle(!enabled)}
      className={`p-2 rounded-lg transition-colors ${
        enabled
          ? 'bg-[var(--editor-accent)] text-white'
          : 'bg-[var(--editor-bg-hover)] text-[var(--editor-text-secondary)] hover:bg-[var(--editor-bg-base)]'
      }`}
      title={enabled ? 'Exit element selection mode' : 'Select element from preview'}
    >
      <MousePointer2 size={16} />
    </button>
  );
}
