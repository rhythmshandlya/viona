/**
 * B-Roll Panel
 * Upload videos, drag them onto the timeline, or generate AI B-roll from stock footage
 */

'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Film, Sparkles, Trash2, Volume2, Loader2, Upload, GripVertical } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { api, ProjectMediaAsset } from '@/lib/api';
import {
  useProjectId,
  useItemIds,
  useItems,
  useTimelineActions,
  usePlaybackActions,
  useProjectActions,
  useCurrentTimeMs,
} from '../store/use-editor-store';
import { BrollItemData } from '../store/types';

interface BrollPanelProps {
  className?: string;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BrollPanel({ className = '' }: BrollPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mediaAssets, setMediaAssets] = useState<ProjectMediaAsset[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const projectId = useProjectId();
  const itemIds = useItemIds();
  const items = useItems();
  const currentTimeMs = useCurrentTimeMs();
  const { deleteItems, updateItemData } = useTimelineActions();
  const { pause, seek } = usePlaybackActions();
  const { loadProject } = useProjectActions();

  // Filter B-roll items
  const brollItems = itemIds
    .map((id) => items[id])
    .filter((item) => item?.type === 'broll')
    .sort((a, b) => a.startMs - b.startMs);

  // Load media assets on mount
  useEffect(() => {
    if (!projectId) return;
    setIsLoadingAssets(true);
    api.getProjectMedia(projectId)
      .then((res) => setMediaAssets(res.assets))
      .catch((err) => console.error('Failed to load media assets:', err))
      .finally(() => setIsLoadingAssets(false));
  }, [projectId]);

  // Upload handler
  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || !projectId) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        const asset = await api.uploadProjectMedia(projectId, file, undefined, (progress) => {
          setUploadProgress(progress);
        });
        setMediaAssets((prev) => [...prev, asset]);
      }
    } catch (err) {
      console.error('Failed to upload media:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [projectId]);

  // Delete asset
  const handleDeleteAsset = useCallback(async (assetId: string) => {
    if (!projectId) return;
    try {
      await api.deleteProjectMedia(projectId, assetId);
      setMediaAssets((prev) => prev.filter((a) => a.id !== assetId));
    } catch (err) {
      console.error('Failed to delete asset:', err);
    }
  }, [projectId]);

  // Drag start for media library clips
  const handleDragStart = useCallback((e: React.DragEvent, asset: ProjectMediaAsset) => {
    e.dataTransfer.setData('application/x-broll-asset', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  // Generate B-roll from transcript
  const handleGenerate = useCallback(async () => {
    if (!projectId || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      await api.generateBroll(projectId);
      await loadProject(projectId);
    } catch (err) {
      console.error('Failed to generate B-roll:', err);
      setError('Failed to generate B-roll. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [projectId, isGenerating, loadProject]);

  // Remove a B-roll item
  const handleRemove = useCallback(
    (itemId: string) => {
      deleteItems([itemId]);
    },
    [deleteItems]
  );

  // Seek to B-roll clip
  const handleSeek = useCallback(
    (startMs: number) => {
      pause();
      seek(startMs);
    },
    [pause, seek]
  );

  // Update volume
  const handleVolumeChange = useCallback(
    (itemId: string, volume: number) => {
      updateItemData(itemId, { volume });
    },
    [updateItemData]
  );

  return (
    <div className={`${className}`}>
      {/* Section A: Media Library */}
      <div className="border-b border-[var(--editor-border-subtle)]">
        <div className="px-4 py-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--editor-text-secondary)] uppercase tracking-wide">
            Media Library
          </span>
        </div>

        {/* Upload button */}
        <div className="px-4 pb-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || !projectId}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium
                       rounded-md transition-all border border-dashed border-[var(--editor-border-subtle)]
                       text-[var(--editor-text-secondary)]
                       hover:border-[var(--editor-accent)] hover:text-[var(--editor-accent)]
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading... {uploadProgress}%
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload Video
              </>
            )}
          </button>
        </div>

        {/* Media grid */}
        {isLoadingAssets ? (
          <div className="px-4 pb-3 text-center">
            <Loader2 className="w-4 h-4 animate-spin mx-auto text-[var(--editor-text-muted)]" />
          </div>
        ) : mediaAssets.length > 0 ? (
          <div className="px-4 pb-3 grid grid-cols-2 gap-2">
            {mediaAssets.map((asset) => (
              <div
                key={asset.id}
                draggable
                onDragStart={(e) => handleDragStart(e, asset)}
                className="group relative rounded-md bg-[var(--editor-bg-elevated)] border border-[var(--editor-border-subtle)]
                           hover:border-[var(--editor-accent)] cursor-grab active:cursor-grabbing transition-colors"
              >
                <div className="flex items-center gap-2 p-2">
                  <GripVertical className="w-3 h-3 text-[var(--editor-text-muted)] opacity-0 group-hover:opacity-100 flex-shrink-0" />
                  <Film className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-[var(--editor-text-primary)] truncate">
                      {asset.filename}
                    </div>
                    {asset.fileSize && (
                      <div className="text-[9px] text-[var(--editor-text-muted)]">
                        {formatFileSize(asset.fileSize)}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteAsset(asset.id);
                    }}
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--editor-bg-hover)]
                               text-[var(--editor-text-muted)] hover:text-red-400 transition-all flex-shrink-0"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 pb-3">
            <p className="text-[10px] text-[var(--editor-text-muted)] text-center">
              Upload videos to drag onto the timeline
            </p>
          </div>
        )}
      </div>

      {/* Section B: AI Generate */}
      <div className="px-4 py-3 border-b border-[var(--editor-border-subtle)]">
        <div className="mb-2">
          <span className="text-xs font-semibold text-[var(--editor-text-secondary)] uppercase tracking-wide">
            AI Generate
          </span>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !projectId}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium
                     rounded-md transition-all
                     bg-[var(--editor-accent)] text-white
                     hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate B-Roll
            </>
          )}
        </button>
        <p className="mt-2 text-[10px] text-[var(--editor-text-muted)]">
          AI picks stock footage from Pexels based on your transcript.
        </p>
      </div>

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 border-b border-[var(--editor-border-subtle)]">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Section C: Timeline B-Roll Items */}
      <div>
        <div className="px-4 py-2">
          <span className="text-xs font-semibold text-[var(--editor-text-secondary)] uppercase tracking-wide">
            Timeline Clips
          </span>
        </div>

        {brollItems.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <Film className="w-6 h-6 mx-auto mb-2 text-[var(--editor-text-muted)] opacity-50" />
            <p className="text-xs text-[var(--editor-text-muted)]">
              No B-roll on timeline
            </p>
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[400px]">
            {brollItems.map((item) => {
              const data = item.data as BrollItemData;
              const isActive = currentTimeMs >= item.startMs && currentTimeMs < item.endMs;
              const label = data.sourceType === 'upload'
                ? (data.filename || 'Upload')
                : (data.photographer ? `by ${data.photographer}` : 'Stock footage');

              return (
                <div
                  key={item.id}
                  className={`border-b border-[var(--editor-border-subtle)] last:border-b-0 ${
                    isActive ? 'bg-[var(--editor-accent)]/5' : ''
                  }`}
                >
                  <button
                    onClick={() => handleSeek(item.startMs)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--editor-bg-hover)] transition-colors"
                  >
                    <div className="w-12 h-8 rounded bg-[var(--editor-bg-elevated)] flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {data.previewUrl ? (
                        <img
                          src={data.previewUrl}
                          alt="B-roll preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Film className="w-4 h-4 text-[var(--editor-text-muted)]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className={`text-sm truncate ${
                        isActive ? 'text-[var(--editor-accent)]' : 'text-[var(--editor-text-primary)]'
                      }`}>
                        {formatTime(item.startMs)} - {formatTime(item.endMs)}
                      </div>
                      <div className="text-[10px] text-[var(--editor-text-muted)] truncate">
                        {label}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(item.id);
                      }}
                      className="p-1 rounded hover:bg-[var(--editor-bg-hover)] text-[var(--editor-text-muted)]
                                 hover:text-red-400 transition-colors flex-shrink-0"
                      title="Remove clip"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </button>

                  <div className="px-4 pb-2 flex items-center gap-2">
                    <Volume2 className="w-3.5 h-3.5 text-[var(--editor-text-muted)] flex-shrink-0" />
                    <Slider
                      value={[data.volume * 100]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={([vol]) => handleVolumeChange(item.id, vol / 100)}
                      className="flex-1"
                    />
                    <span className="text-[10px] text-[var(--editor-text-muted)] w-7 text-right">
                      {Math.round(data.volume * 100)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
