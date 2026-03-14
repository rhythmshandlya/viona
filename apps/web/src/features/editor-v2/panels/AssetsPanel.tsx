/**
 * Assets Panel
 * Displays extracted composition assets that users can select for AI editing
 * + allows uploading custom assets (logos, icons, brand images)
 */

'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Box, Type, Sparkles, Circle, Image, Layers, RefreshCw, ChevronRight, Upload, Trash2, X, Plus, Music, Film, ImageIcon, type LucideIcon } from 'lucide-react';
import { api, ExtractedAsset, ProjectMediaAsset, SceneInfo } from '@/lib/api';
import { useProjectId, useEditorActions, useSelectedElement, useItemIds, useItems, useEditorStore } from '../store/use-editor-store';
import type { Track, TimelineItem } from '../store/types';

interface AssetsPanelProps {
  className?: string;
  onEditWithAI?: (asset: ExtractedAsset) => void;
  onYouTubeClipAdded?: (clip: { clipId: string; duration: number; clipUrl: string; sourceTitle?: string; frameStyle?: string; startSeconds: number; endSeconds: number; sourceUrl: string }) => void;
}

// Icon mapping for asset types
const AssetIcon: Record<ExtractedAsset['type'], LucideIcon> = {
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
  element: 'text-[var(--editor-accent)]',
  text: 'text-green-400',
  shape: 'text-violet-400',
  icon: 'text-yellow-400',
  background: 'text-gray-400',
};

// File type badge colors
const mimeTypeBadge = (mime: string) => {
  if (mime.startsWith('audio/')) return { label: 'Audio', color: 'text-yellow-400 bg-yellow-400/10' };
  if (mime.startsWith('video/')) return { label: 'Video', color: 'text-red-400 bg-red-400/10' };
  if (mime.includes('svg')) return { label: 'SVG', color: 'text-orange-400 bg-orange-400/10' };
  if (mime.includes('png')) return { label: 'PNG', color: 'text-blue-400 bg-blue-400/10' };
  if (mime.includes('jpeg') || mime.includes('jpg')) return { label: 'JPG', color: 'text-green-400 bg-green-400/10' };
  if (mime.includes('webp')) return { label: 'WEBP', color: 'text-violet-400 bg-violet-400/10' };
  if (mime.includes('gif')) return { label: 'GIF', color: 'text-pink-400 bg-pink-400/10' };
  return { label: 'IMG', color: 'text-gray-400 bg-gray-400/10' };
};

function getAssetTypeIcon(mimeType: string) {
  if (mimeType.startsWith('audio/')) return <Music className="w-4 h-4 text-yellow-400" />;
  if (mimeType.startsWith('video/')) return <Film className="w-4 h-4 text-red-400" />;
  return null;
}

/** Find or create a track of the given type */
function findOrCreateTrack(
  tracks: Track[],
  trackType: string,
  addTrack: (track: Partial<Track>) => string,
): string {
  const existing = tracks.find((t) => t.type === trackType);
  if (existing) return existing.id;
  const count = tracks.filter((t) => t.type === trackType).length;
  const names: Record<string, string> = { video: 'Video', audio: 'Audio', overlay: 'Overlay' };
  return addTrack({
    type: trackType as Track['type'],
    name: `${names[trackType] || trackType} ${count + 1}`,
    position: tracks.length,
    height: 60,
    locked: false,
    visible: true,
    collapsed: false,
  });
}

export function AssetsPanel({ className = '', onEditWithAI, onYouTubeClipAdded }: AssetsPanelProps) {
  const [assets, setAssets] = useState<ExtractedAsset[]>([]);
  const [sceneTimings, setSceneTimings] = useState<Map<number, { startMs: number; endMs: number; contentDisplayMs?: number }>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedScenes, setExpandedScenes] = useState<Set<number>>(new Set([1, 2, 3])); // Expand first 3 scenes by default

  // Uploaded assets state
  const [uploadedAssets, setUploadedAssets] = useState<ProjectMediaAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pendingFiles, setPendingFiles] = useState<{ file: File; label: string }[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const projectId = useProjectId();
  const selectedElement = useSelectedElement();
  const { setSelectedElement, pause, seek, setElementPickerEnabled } = useEditorActions();

  // Watch visual items — refetch assets when they change
  const itemIds = useItemIds();
  const items = useItems();
  const visualItemIds = itemIds.filter(id => items[id]?.type === 'visual');
  const visualKeyRef = useRef(visualItemIds.join(','));

  // Fetch scene assets
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
      const timings = new Map<number, { startMs: number; endMs: number; contentDisplayMs?: number }>();
      for (const scene of scenesResponse.scenes) {
        timings.set(scene.id, { startMs: scene.startMs, endMs: scene.endMs, contentDisplayMs: scene.contentDisplayMs });
      }
      setSceneTimings(timings);
    } catch (err) {
      setError('Failed to load assets');
      console.error('Failed to fetch assets:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Fetch uploaded assets
  const fetchUploadedAssets = useCallback(async () => {
    if (!projectId) return;
    try {
      const { assets } = await api.getProjectMedia(projectId);
      setUploadedAssets(assets);
    } catch (err) {
      console.error('Failed to fetch uploaded assets:', err);
    }
  }, [projectId]);

  useEffect(() => {
    fetchAssets();
    fetchUploadedAssets();
  }, [fetchAssets, fetchUploadedAssets]);

  // Refetch when visual items change (added, removed, or replaced after edits)
  useEffect(() => {
    const newKey = visualItemIds.join(',');
    if (newKey !== visualKeyRef.current) {
      visualKeyRef.current = newKey;
      fetchAssets();
    }
  }, [visualItemIds, fetchAssets]);

  // Stable preview URL map — only creates/revokes URLs for added/removed files
  const previewUrlsRef = useRef(new Map<File, string>());

  const pendingPreviewUrls = useMemo(() => {
    const newMap = new Map<File, string>();
    for (const { file } of pendingFiles) {
      const existing = previewUrlsRef.current.get(file);
      if (existing) {
        newMap.set(file, existing);
      } else if (file.type.startsWith('image/') && !file.type.includes('svg')) {
        newMap.set(file, URL.createObjectURL(file));
      }
    }
    // Revoke URLs for removed files
    for (const [file, url] of previewUrlsRef.current) {
      if (!newMap.has(file)) URL.revokeObjectURL(url);
    }
    previewUrlsRef.current = newMap;
    return pendingFiles.map(({ file }) => newMap.get(file) ?? null);
  }, [pendingFiles]);

  useEffect(() => {
    return () => { previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url)); };
  }, []);

  // Handle file selection (supports multiple)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newPending = Array.from(files).map(file => ({
      file,
      label: file.name.replace(/\.[^.]+$/, ''),
    }));
    setPendingFiles(prev => [...prev, ...newPending]);
    e.target.value = '';
  };

  // Update label for a specific pending file
  const updatePendingLabel = (index: number, label: string) => {
    setPendingFiles(prev => prev.map((p, i) => i === index ? { ...p, label } : p));
  };

  // Remove a specific pending file
  const removePending = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Handle upload confirmation — uploads all pending files
  const handleUpload = async () => {
    if (!projectId || pendingFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    const total = pendingFiles.length;
    const uploaded: ProjectMediaAsset[] = [];
    try {
      for (let i = 0; i < pendingFiles.length; i++) {
        const { file, label } = pendingFiles[i];
        const asset = await api.uploadProjectMedia(projectId, file, label || undefined, (p) => {
          setUploadProgress(Math.round(((i + p / 100) / total) * 100));
        });
        uploaded.push(asset);
      }
      setUploadedAssets(prev => [...uploaded.toReversed(), ...prev]);
      setPendingFiles([]);
    } catch (err) {
      console.error('Upload failed:', err);
      // Keep un-uploaded files pending
      if (uploaded.length > 0) {
        setUploadedAssets(prev => [...uploaded.toReversed(), ...prev]);
        setPendingFiles(prev => prev.slice(uploaded.length));
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Handle delete
  const handleDelete = async (assetId: string) => {
    if (!projectId) return;
    setDeletingId(assetId);
    try {
      await api.deleteProjectMedia(projectId, assetId);
      setUploadedAssets(prev => prev.filter(a => a.id !== assetId));
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeletingId(null);
    }
  };

  // Group scene assets by scene
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
      position: asset.position,
      size: asset.size,
    });

    pause();
    const timing = sceneTimings.get(asset.sceneId);
    if (timing) {
      const seekMs = Math.max(timing.startMs, timing.endMs - 1000);
      seek(seekMs);
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

  const isAssetSelected = (asset: ExtractedAsset) => {
    return selectedElement?.name === asset.name && selectedElement?.sceneId === asset.sceneId;
  };

  // Drag & drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/') || f.type.startsWith('audio/') || f.type.startsWith('video/'));
    if (files.length > 0) {
      const newPending = files.map(file => ({
        file,
        label: file.name.replace(/\.[^.]+$/, ''),
      }));
      setPendingFiles(prev => [...prev, ...newPending]);
    }
  };

  if (loading && assets.length === 0 && uploadedAssets.length === 0) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="flex items-center gap-2 text-[var(--editor-text-muted)] text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Loading assets...
        </div>
      </div>
    );
  }

  if (error && uploadedAssets.length === 0) {
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

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,audio/*,video/*,.svg"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Your Assets section */}
      <div className="border-b border-[var(--editor-border-subtle)]">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs font-medium text-[var(--editor-text-secondary)]">
            Your Assets {uploadedAssets.length > 0 && `(${uploadedAssets.length})`}
          </span>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium
                       text-[var(--editor-accent)] hover:bg-[var(--editor-accent-soft)] transition-colors
                       disabled:opacity-50"
          >
            <Upload className="w-3 h-3" />
            Upload
          </button>
        </div>

        {/* Pending files — inline label inputs */}
        {pendingFiles.length > 0 && (
          <div className="px-4 pb-2 space-y-1.5">
            {pendingFiles.map((pending, idx) => (
              <div key={`${pending.file.name}-${pending.file.lastModified}`} className="flex items-center gap-2 p-2 rounded-lg border border-[var(--editor-border-subtle)]
                              bg-[var(--editor-bg-surface)]">
                <div className="w-8 h-8 rounded bg-[var(--editor-bg-hover)] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {pendingPreviewUrls[idx] ? (
                    <img src={pendingPreviewUrls[idx]!} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Image className="w-4 h-4 text-[var(--editor-text-muted)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={pending.label}
                    onChange={(e) => updatePendingLabel(idx, e.target.value)}
                    placeholder="Label (e.g. Company logo)"
                    className="w-full bg-transparent text-xs text-[var(--editor-text-primary)]
                               placeholder:text-[var(--editor-text-muted)] outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleUpload()}
                    autoFocus={idx === pendingFiles.length - 1}
                  />
                  <div className="text-[10px] text-[var(--editor-text-muted)] truncate">
                    {pending.file.name}
                  </div>
                </div>
                <button
                  onClick={() => removePending(idx)}
                  className="p-0.5 text-[var(--editor-text-muted)] hover:text-[var(--editor-text-secondary)]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] text-[var(--editor-accent)] hover:underline"
              >
                + Add more
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setPendingFiles([])}
                className="px-2 py-1 rounded text-[10px] text-[var(--editor-text-muted)]
                           hover:text-[var(--editor-text-secondary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="px-2 py-1 rounded text-[10px] font-medium bg-[var(--editor-accent)]
                           text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {uploading ? `${uploadProgress}%` : pendingFiles.length > 1 ? `Upload (${pendingFiles.length})` : 'Upload'}
              </button>
            </div>
          </div>
        )}

        {/* Uploaded assets grid */}
        {uploadedAssets.length > 0 ? (
          <div className="px-4 pb-3 grid grid-cols-3 gap-2">
            {uploadedAssets.map((asset) => {
              const badge = mimeTypeBadge(asset.mimeType);
              const isAudioVideo = asset.mimeType.startsWith('audio/') || asset.mimeType.startsWith('video/');
              return (
                <div
                  key={asset.id}
                  className="group relative rounded-lg border border-[var(--editor-border-subtle)]
                             bg-[var(--editor-bg-surface)] overflow-hidden cursor-grab"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/x-project-asset', JSON.stringify({
                      id: asset.id,
                      url: asset.url,
                      mimeType: asset.mimeType,
                      filename: asset.filename,
                      label: asset.label,
                    }));
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                >
                  <div className="aspect-square flex items-center justify-center bg-[var(--editor-bg-hover)] p-1">
                    {isAudioVideo ? (
                      <div className="flex flex-col items-center gap-1">
                        {getAssetTypeIcon(asset.mimeType)}
                        <span className="text-[9px] text-[var(--editor-text-muted)]">{badge.label}</span>
                      </div>
                    ) : (
                      <img
                        src={asset.url}
                        alt={asset.label || asset.filename}
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                  <div className="px-1.5 py-1">
                    <div className="text-[10px] text-[var(--editor-text-primary)] truncate">
                      {asset.label || asset.filename}
                    </div>
                    <span className={`inline-block text-[9px] font-medium px-1 rounded ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>
                  {/* Insert at playhead — visible on hover */}
                  <button
                    onClick={() => {
                      const state = useEditorStore.getState();
                      let itemType: string;
                      let trackType: string;
                      if (asset.mimeType.startsWith('audio/')) {
                        itemType = 'audio';
                        trackType = 'audio';
                      } else if (asset.mimeType.startsWith('video/')) {
                        itemType = 'video';
                        trackType = 'video';
                      } else {
                        itemType = 'image';
                        trackType = 'overlay';
                      }
                      const trackId = findOrCreateTrack(state.tracks, trackType, state.addTrack);
                      const startMs = state.currentTimeMs;
                      const id = `item-${itemType}-${Date.now()}`;
                      const durationMs = itemType === 'image' ? 5000 : 10000;
                      const item: Partial<TimelineItem> = {
                        id,
                        type: itemType as any,
                        trackId,
                        startMs,
                        endMs: startMs + durationMs,
                        data: { src: asset.url, volume: 1 } as any,
                        ...(itemType !== 'audio' ? {
                          transform: { x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1 },
                        } : {}),
                      };
                      state.addItem(trackId, item as TimelineItem);
                      state.select([id]);
                    }}
                    className="absolute bottom-1 right-1 w-5 h-5 rounded flex items-center justify-center
                               bg-[var(--editor-accent)]/80 text-white opacity-0 group-hover:opacity-100 transition-opacity
                               hover:bg-[var(--editor-accent)]"
                    title="Insert at playhead"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  {/* Delete button — visible on hover */}
                  <button
                    onClick={() => handleDelete(asset.id)}
                    disabled={deletingId === asset.id}
                    className="absolute top-1 right-1 w-5 h-5 rounded flex items-center justify-center
                               bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity
                               hover:bg-red-500 disabled:opacity-50"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : pendingFiles.length === 0 && (
          <div
            className="mx-4 mb-3 p-3 rounded-lg border border-dashed border-[var(--editor-border-subtle)]
                        text-center cursor-pointer hover:border-[var(--editor-accent)]/50 hover:bg-[var(--editor-accent)]/5
                        transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <Upload className="w-5 h-5 mx-auto mb-1 text-[var(--editor-text-muted)]" />
            <p className="text-[11px] text-[var(--editor-text-muted)]">
              Drop images, audio, or video here
            </p>
          </div>
        )}
      </div>

      {/* Scene Assets section */}
      {assets.length > 0 && (
        <>
          <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--editor-border-subtle)]">
            <span className="text-xs font-medium text-[var(--editor-text-secondary)]">
              Scene Assets ({assets.length})
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

          <div className="overflow-y-auto flex-1">
            {Object.entries(assetsByScene).map(([sceneIdStr, { sceneName, assets: sceneAssets }]) => {
              const sceneId = parseInt(sceneIdStr);
              const isExpanded = expandedScenes.has(sceneId);

              return (
                <div key={sceneId} className="border-b border-[var(--editor-border-subtle)] last:border-b-0">
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
        </>
      )}

      {/* Empty state — no visuals, no uploaded assets */}
      {assets.length === 0 && uploadedAssets.length === 0 && pendingFiles.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <Layers className="w-8 h-8 mx-auto mb-2 text-[var(--editor-text-muted)] opacity-50" />
            <p className="text-sm text-[var(--editor-text-muted)] mb-1">No assets yet</p>
            <p className="text-xs text-[var(--editor-text-muted)] opacity-70">
              Upload brand assets or generate visuals to see scene assets
            </p>
          </div>
        </div>
      )}

      {/* No visuals but has uploaded assets */}
      {assets.length === 0 && uploadedAssets.length > 0 && (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-[var(--editor-text-muted)] text-center">
            Generate visuals to see scene assets
          </p>
        </div>
      )}

      {/* Selected asset indicator */}
      {selectedElement && (
        <div className="px-4 py-3 border-t border-[var(--editor-border-subtle)] bg-[var(--editor-accent)]/5 flex-shrink-0">
          <div className="text-[10px] text-[var(--editor-text-muted)] mb-1">Selected:</div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-[var(--editor-accent)]">
              {selectedElement.name}
            </span>
            <span className="text-[10px] text-[var(--editor-text-muted)]">
              Scene {selectedElement.sceneId}
            </span>
          </div>
          {onEditWithAI && (
            <button
              onClick={() => {
                const asset = assets.find(a => a.name === selectedElement.name && a.sceneId === selectedElement.sceneId);
                if (asset) onEditWithAI(asset);
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                         bg-[var(--editor-accent-soft)] text-[var(--editor-accent)] border border-[var(--editor-accent)]/25
                         hover:bg-[var(--editor-accent-muted)] transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Edit with AI
            </button>
          )}
        </div>
      )}
    </div>
  );
}
