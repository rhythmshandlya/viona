/**
 * Assets Panel
 * Displays extracted composition assets that users can select for AI editing
 */

'use client';

<<<<<<< HEAD
<<<<<<< HEAD
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Type, Sparkles, Circle, Image, Layers, RefreshCw, ChevronRight } from 'lucide-react';
import { api, ExtractedAsset, SceneInfo } from '@/lib/api';
import { useProjectId, useEditorActions, useSelectedElement, useItemIds, useItems } from '../store/use-editor-store';
=======
import React, { useState, useEffect, useCallback } from 'react';
import { Box, Type, Sparkles, Circle, Image, Layers, RefreshCw, ChevronRight } from 'lucide-react';
import { api, ExtractedAsset, SceneInfo } from '@/lib/api';
import { useProjectId, useEditorActions, useSelectedElement } from '../store/use-editor-store';
>>>>>>> 92226f2 (Added asset)
=======
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Type, Sparkles, Circle, Image, Layers, RefreshCw, ChevronRight } from 'lucide-react';
import { api, ExtractedAsset, SceneInfo } from '@/lib/api';
import { useProjectId, useEditorActions, useSelectedElement, useItemIds, useItems } from '../store/use-editor-store';
>>>>>>> 528ad56 (Added export fix)

interface AssetsPanelProps {
  className?: string;
}

// Icon mapping for asset types
const AssetIcon: Record<ExtractedAsset['type'], React.ElementType> = {
  component: Box,
  element: Layers,
  text: Type,
  shape: Circle,
  icon: Sparkles,
  background: Image,
};

// Color mapping for asset types
const AssetColor: Record<ExtractedAsset['type'], string> = {
  component: 'text-blue-400',
  element: 'text-purple-400',
  text: 'text-green-400',
  shape: 'text-orange-400',
  icon: 'text-yellow-400',
  background: 'text-gray-400',
};

export function AssetsPanel({ className = '' }: AssetsPanelProps) {
  const [assets, setAssets] = useState<ExtractedAsset[]>([]);
<<<<<<< HEAD
<<<<<<< HEAD
  const [sceneTimings, setSceneTimings] = useState<Map<number, { startMs: number; endMs: number; contentDisplayMs?: number }>>(new Map());
=======
  const [sceneTimings, setSceneTimings] = useState<Map<number, number>>(new Map());
>>>>>>> 92226f2 (Added asset)
=======
  const [sceneTimings, setSceneTimings] = useState<Map<number, { startMs: number; endMs: number; contentDisplayMs?: number }>>(new Map());
>>>>>>> 528ad56 (Added export fix)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedScenes, setExpandedScenes] = useState<Set<number>>(new Set([1, 2, 3])); // Expand first 3 scenes by default

  const projectId = useProjectId();
  const selectedElement = useSelectedElement();
  const { setSelectedElement, pause, seek, setElementPickerEnabled } = useEditorActions();

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 528ad56 (Added export fix)
  // Watch visual items — refetch assets when they change
  const itemIds = useItemIds();
  const items = useItems();
  const visualItemIds = itemIds.filter(id => items[id]?.type === 'visual');
  const visualKeyRef = useRef(visualItemIds.join(','));

<<<<<<< HEAD
=======
>>>>>>> 92226f2 (Added asset)
=======
>>>>>>> 528ad56 (Added export fix)
  // Fetch assets
  const fetchAssets = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    setError(null);

    try {
      const [assetsResponse, scenesResponse] = await Promise.all([
        api.getAssets(projectId),
        api.getScenes(projectId),
      ]);
      setAssets(assetsResponse.assets);
<<<<<<< HEAD
<<<<<<< HEAD
      const timings = new Map<number, { startMs: number; endMs: number; contentDisplayMs?: number }>();
      for (const scene of scenesResponse.scenes) {
        timings.set(scene.id, { startMs: scene.startMs, endMs: scene.endMs, contentDisplayMs: scene.contentDisplayMs });
=======
      const timings = new Map<number, number>();
      for (const scene of scenesResponse.scenes) {
        timings.set(scene.id, scene.startMs);
>>>>>>> 92226f2 (Added asset)
=======
      const timings = new Map<number, { startMs: number; endMs: number; contentDisplayMs?: number }>();
      for (const scene of scenesResponse.scenes) {
        timings.set(scene.id, { startMs: scene.startMs, endMs: scene.endMs, contentDisplayMs: scene.contentDisplayMs });
>>>>>>> 528ad56 (Added export fix)
      }
      setSceneTimings(timings);
    } catch (err) {
      setError('Failed to load assets');
      console.error('Failed to fetch assets:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 528ad56 (Added export fix)
  // Refetch when visual items change (added, removed, or replaced after edits)
  useEffect(() => {
    const newKey = visualItemIds.join(',');
    if (newKey !== visualKeyRef.current) {
      visualKeyRef.current = newKey;
      fetchAssets();
    }
  }, [visualItemIds, fetchAssets]);

<<<<<<< HEAD
=======
>>>>>>> 92226f2 (Added asset)
=======
>>>>>>> 528ad56 (Added export fix)
  // Group assets by scene
  const assetsByScene = assets.reduce((acc, asset) => {
    const sceneId = asset.sceneId;
    if (!acc[sceneId]) {
      acc[sceneId] = { sceneName: asset.sceneName, assets: [] };
    }
    acc[sceneId].assets.push(asset);
    return acc;
  }, {} as Record<number, { sceneName: string; assets: ExtractedAsset[] }>);

  // Handle asset selection — toggle, seek, and highlight
  const handleAssetClick = (asset: ExtractedAsset) => {
    // Toggle: clicking same asset again deselects and hides overlay
    if (selectedElement?.name === asset.name && selectedElement?.sceneId === asset.sceneId) {
      setSelectedElement(null);
      setElementPickerEnabled(false);
      return;
    }

    setSelectedElement({
      name: asset.name,
      type: asset.type,
      sceneId: asset.sceneId,
      description: asset.description,
    });

<<<<<<< HEAD
<<<<<<< HEAD
    // Pause playback and seek to the last second of the scene
    pause();
    const timing = sceneTimings.get(asset.sceneId);
    if (timing) {
      const seekMs = Math.max(timing.startMs, timing.endMs - 1000);
      seek(seekMs);
=======
    // Pause playback and seek to the scene's start
    pause();
    const startMs = sceneTimings.get(asset.sceneId);
    if (startMs !== undefined) {
      seek(startMs + 100);
>>>>>>> 92226f2 (Added asset)
=======
    // Pause playback and seek to the last second of the scene
    pause();
    const timing = sceneTimings.get(asset.sceneId);
    if (timing) {
      const seekMs = Math.max(timing.startMs, timing.endMs - 1000);
      seek(seekMs);
>>>>>>> 528ad56 (Added export fix)
    }
    setElementPickerEnabled(true);
  };

  // Toggle scene expansion
  const toggleScene = (sceneId: number) => {
    setExpandedScenes(prev => {
      const next = new Set(prev);
      if (next.has(sceneId)) {
        next.delete(sceneId);
      } else {
        next.add(sceneId);
      }
      return next;
    });
  };

  // Check if asset is selected
  const isAssetSelected = (asset: ExtractedAsset) => {
    return selectedElement?.name === asset.name && selectedElement?.sceneId === asset.sceneId;
  };

  if (loading && assets.length === 0) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="flex items-center gap-2 text-[var(--editor-text-muted)] text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Loading assets...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="text-red-400 text-sm mb-2">{error}</div>
        <button
          onClick={fetchAssets}
          className="text-xs text-[var(--editor-accent)] hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="text-center py-8">
          <Layers className="w-8 h-8 mx-auto mb-2 text-[var(--editor-text-muted)] opacity-50" />
          <p className="text-sm text-[var(--editor-text-muted)] mb-1">No assets found</p>
          <p className="text-xs text-[var(--editor-text-muted)] opacity-70">
            Generate or edit visuals to extract assets
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--editor-border-subtle)]">
        <span className="text-xs font-medium text-[var(--editor-text-secondary)]">
          {assets.length} assets
        </span>
        <button
          onClick={fetchAssets}
          disabled={loading}
          className="p-1 rounded hover:bg-[var(--editor-bg-hover)] text-[var(--editor-text-muted)] disabled:opacity-50"
          title="Refresh assets"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Assets list grouped by scene */}
      <div className="overflow-y-auto max-h-[400px]">
        {Object.entries(assetsByScene).map(([sceneIdStr, { sceneName, assets: sceneAssets }]) => {
          const sceneId = parseInt(sceneIdStr);
          const isExpanded = expandedScenes.has(sceneId);

          return (
            <div key={sceneId} className="border-b border-[var(--editor-border-subtle)] last:border-b-0">
              {/* Scene header */}
              <button
                onClick={() => toggleScene(sceneId)}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-[var(--editor-bg-hover)] transition-colors"
              >
                <ChevronRight
                  className={`w-3.5 h-3.5 text-[var(--editor-text-muted)] transition-transform ${
                    isExpanded ? 'rotate-90' : ''
                  }`}
                />
                <span className="text-xs font-medium text-[var(--editor-text-primary)]">
                  {sceneName}
                </span>
                <span className="text-[10px] text-[var(--editor-text-muted)] ml-auto">
                  {sceneAssets.length}
                </span>
              </button>

              {/* Scene assets */}
              {isExpanded && (
                <div className="pb-1">
                  {sceneAssets.map((asset) => {
                    const Icon = AssetIcon[asset.type] || Box;
                    const colorClass = AssetColor[asset.type] || 'text-gray-400';
                    const isSelected = isAssetSelected(asset);

                    return (
                      <button
                        key={asset.id}
                        onClick={() => handleAssetClick(asset)}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                          isSelected
                            ? 'bg-[var(--editor-accent)]/10 border-l-2 border-[var(--editor-accent)]'
                            : 'hover:bg-[var(--editor-bg-hover)] border-l-2 border-transparent'
                        }`}
                      >
                        <Icon className={`w-4 h-4 flex-shrink-0 ${colorClass}`} />
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm truncate ${
                            isSelected ? 'text-[var(--editor-accent)]' : 'text-[var(--editor-text-primary)]'
                          }`}>
                            {asset.name}
                          </div>
                          <div className="text-[10px] text-[var(--editor-text-muted)] capitalize">
                            {asset.type}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected asset indicator */}
      {selectedElement && (
        <div className="px-4 py-2 border-t border-[var(--editor-border-subtle)] bg-[var(--editor-accent)]/5">
          <div className="text-[10px] text-[var(--editor-text-muted)] mb-1">Selected:</div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--editor-accent)]">
              {selectedElement.name}
            </span>
            <span className="text-[10px] text-[var(--editor-text-muted)]">
              Scene {selectedElement.sceneId}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
