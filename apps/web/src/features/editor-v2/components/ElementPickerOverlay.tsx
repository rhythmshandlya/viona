/**
 * ElementPickerOverlay Component
 * Renders clickable overlay regions on top of the video preview
 * allowing users to click on elements to select them for AI editing
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MousePointer2, X } from 'lucide-react';
import { api, SceneInfo, SceneElement } from '@/lib/api';
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
  const [scenes, setScenes] = useState<SceneInfo[]>([]);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);

  const projectId = useProjectId();
  const currentTimeMs = useCurrentTimeMs();
  const selectedElement = useSelectedElement();
  const { setSelectedElement } = useEditorActions();

  // Fetch scenes with elements data
  useEffect(() => {
    if (projectId) {
      api.getScenes(projectId)
        .then((data) => setScenes(data.scenes))
        .catch((err) => console.warn('Failed to fetch scenes:', err));
    }
  }, [projectId]);

  // Find current scene based on playhead position
  const currentScene = React.useMemo(() => {
    return scenes.find(s => currentTimeMs >= s.startMs && currentTimeMs < s.endMs) || null;
  }, [scenes, currentTimeMs]);

  // Get elements for current scene
  const currentElements = currentScene?.elements || [];

  const handleElementClick = useCallback((element: SceneElement, sceneId: number) => {
    const selected: SelectedElement = {
      name: element.name,
      type: element.type,
      sceneId,
      description: element.description,
    };
    setSelectedElement(selected);
  }, [setSelectedElement]);

  const handleClearSelection = useCallback(() => {
    setSelectedElement(null);
  }, [setSelectedElement]);

  // Parse percentage position to number
  const parsePercent = (value: string): number => {
    const match = value.match(/^(\d+(?:\.\d+)?)%?$/);
    return match ? parseFloat(match[1]) : 50;
  };

  if (!enabled) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-20">
      {/* Instruction banner */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/80 rounded-full flex items-center gap-2 text-xs text-white">
        <MousePointer2 size={14} />
        <span>Click an element to select it</span>
        <button
          onClick={() => onToggle(false)}
          className="ml-2 p-0.5 rounded hover:bg-white/20"
        >
          <X size={14} />
        </button>
      </div>

      {/* Element overlays */}
      {currentScene && currentElements.map((element, index) => {
        const x = parsePercent(element.position.x);
        const y = parsePercent(element.position.y);
        const width = parsePercent(element.size.width);
        const height = parsePercent(element.size.height);

        const isSelected = selectedElement?.name === element.name &&
                          selectedElement?.sceneId === currentScene.id;
        const isHovered = hoveredElement === `${currentScene.id}-${element.name}`;

        return (
          <button
            key={`${currentScene.id}-${element.name}-${index}`}
            onClick={() => handleElementClick(element, currentScene.id)}
            onMouseEnter={() => setHoveredElement(`${currentScene.id}-${element.name}`)}
            onMouseLeave={() => setHoveredElement(null)}
            className={`absolute border-2 rounded-lg transition-all cursor-pointer ${
              isSelected
                ? 'border-[var(--editor-accent)] bg-[var(--editor-accent)]/20'
                : isHovered
                ? 'border-white/60 bg-white/10'
                : 'border-white/30 bg-transparent hover:border-white/50'
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
              className={`absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap transition-opacity ${
                isSelected || isHovered ? 'opacity-100' : 'opacity-0'
              } ${
                isSelected
                  ? 'bg-[var(--editor-accent)] text-white'
                  : 'bg-black/80 text-white'
              }`}
            >
              {element.name}
            </div>
          </button>
        );
      })}

      {/* Selected element indicator */}
      {selectedElement && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-[var(--editor-accent)] rounded-full flex items-center gap-2 text-xs text-white">
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

      {/* No elements message */}
      {currentScene && currentElements.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="px-4 py-2 bg-black/80 rounded-lg text-xs text-white/70">
            No selectable elements in this scene
          </div>
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
