/**
 * Editor V2 Zustand Store
 * Main state management with immer for immutable updates
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import { api, Project as ApiProject } from '@/lib/api';
import {
  EditorStore,
  EditorState,
  Track,
  TimelineItem,
  HistoryEntry,
  DEFAULT_TRACK_HEIGHT,
  DEFAULT_ZOOM,
  DEFAULT_FPS,
  DEFAULT_VIDEO_SETTINGS,
  DEFAULT_CAPTION_STYLE,
  DEFAULT_LAYOUT_SETTINGS,
  LAYOUT_PRESETS,
  CaptionItemData,
  CaptionWord,
  VideoItemData,
  AudioItemData,
  VisualItemData,
  VideoSettings,
  CaptionStyle,
  AnimationConfig,
  WordStyleOverrides,
  LayoutSettings,
  LayoutPresetId,
  LayoutMode,
  PiPSettings,
  SplitSettings,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Debounce utility for auto-save
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
const debouncedSave = (saveFn: () => Promise<void>, delay = 1000) => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    saveFn();
    saveTimeout = null;
  }, delay);
};

// Initial state
const initialState: EditorState = {
  // Project
  project: null,
  isLoading: false,
  error: null,

  // Timeline data
  tracks: [],
  items: {},
  itemIds: [],
  duration: 0,
  fps: DEFAULT_FPS,

  // Selection
  selectedIds: [],
  lastSelectedId: null,
  selectionBox: null,

  // Playback
  currentTimeMs: 0,
  isPlaying: false,

  // Viewport
  viewport: {
    zoom: DEFAULT_ZOOM,
    scrollX: 0,
    scrollY: 0,
  },

  // Drag state
  dragState: null,

  // History
  history: [],
  historyIndex: -1,

  // UI state
  isSaving: false,

  // Caption style toggle
  applyStyleToAll: false,

  // Clipboard and split mode
  clipboard: null,
  splitMode: false,

  // Layout settings
  layoutSettings: DEFAULT_LAYOUT_SETTINGS,
  layoutPresetId: 'pip-tutorial' as LayoutPresetId,

  // Scene selection for AI editing
  selectedSceneId: null,
  selectedTimeRange: null,
  selectedElement: null,

  // Element picker mode
  elementPickerEnabled: false,

  // AI edit request
  aiEditRequested: false,

  // Safe zone settings
  safeZonePlatform: 'none',
  showSafeZone: false,
};

/**
 * Migrate legacy animation string (e.g. 'pop') to V2 AnimationConfig object.
 * Mirrors the logic in packages/renderer/src/animations/migrate.ts.
 */
function migrateAnimationLegacy(legacy: string): AnimationConfig {
  switch (legacy) {
    case 'pop':
      return { in: 'elastic-pop', active: 'none', out: 'none', easing: 'spring' };
    case 'fade':
      return { in: 'fade-rise', active: 'none', out: 'fade-rise', easing: 'ease-out' };
    case 'highlight':
      return { in: 'soft-scale', active: 'none', out: 'none', easing: 'ease-out' };
    case 'none':
    default:
      return { in: 'none', active: 'none', out: 'none', easing: 'linear' };
  }
}

/**
 * Track heights per type — taller for video/audio, compact for text-based tracks
 */
const TRACK_HEIGHTS: Record<string, number> = {
  video: 48,
  audio: 36,
  caption: 28,
  text: 28,
  overlay: 28,
  visual: 48,
};

/**
 * Convert API project to editor format
 */
function convertApiProject(apiProject: ApiProject, videoUrl: string): {
  project: NonNullable<EditorState['project']>;
  tracks: Track[];
  items: Record<string, TimelineItem>;
  itemIds: string[];
  duration: number;
} {
  // Merge video settings with defaults to ensure all properties exist
  const apiVideoSettings = (apiProject as any).videoSettings || {};
  const videoSettings: VideoSettings = {
    ...DEFAULT_VIDEO_SETTINGS,
    ...apiVideoSettings,
  };

  const project = {
    id: apiProject.id,
    title: (apiProject as any).title || null,
    status: apiProject.status,
    videoKey: apiProject.videoKey,
    videoUrl,
    outputKey: apiProject.outputKey || null,
    durationMs: apiProject.durationMs || 0,
    fps: apiProject.fps || DEFAULT_FPS,
    sourceWidth: (apiProject as any).sourceWidth || apiProject.width || 1920,
    sourceHeight: (apiProject as any).sourceHeight || apiProject.height || 1080,
    videoSettings,
  };

  // Convert tracks (normalize 'subtitle' → 'caption')
  const tracks: Track[] = apiProject.tracks
    .map((t) => {
      const type = t.type === 'subtitle' ? 'caption' : t.type as Track['type'];
      return {
        id: t.id,
        type,
        name: type === 'caption' ? 'Captions' : t.name,
        position: t.position,
        locked: t.locked,
        visible: t.visible,
        height: TRACK_HEIGHTS[type as string] || DEFAULT_TRACK_HEIGHT,
        collapsed: false,
      };
    });

  // Ensure we have a video track
  const hasVideoTrack = tracks.some((t) => t.type === 'video');
  if (!hasVideoTrack) {
    tracks.push({
      id: `video-track-${nanoid(8)}`,
      type: 'video',
      name: 'Video',
      position: 0,
      locked: false,
      visible: true,
      height: TRACK_HEIGHTS.video,
      collapsed: false,
    });
  }

  // Ensure we have a caption track
  const hasCaptionTrack = tracks.some((t) => t.type === 'caption');
  if (!hasCaptionTrack) {
    tracks.push({
      id: `caption-track-${nanoid(8)}`,
      type: 'caption',
      name: 'Captions',
      position: 1,
      locked: false,
      visible: true,
      height: TRACK_HEIGHTS.caption,
      collapsed: false,
    });
  }

  // Ensure we have a visual track if there are visual items
  const hasVisualItems = apiProject.items?.some((i: { type: string }) => i.type === 'visual');
  const hasVisualTrack = tracks.some((t) => t.type === 'visual');
  if (hasVisualItems && !hasVisualTrack) {
    tracks.push({
      id: `visual-track-${nanoid(8)}`,
      type: 'visual',
      name: 'Visuals',
      position: tracks.length,
      locked: false,
      visible: true,
      height: TRACK_HEIGHTS.visual,
      collapsed: false,
    });
  }

  // Sort tracks by position
  tracks.sort((a, b) => a.position - b.position);

  // Convert items
  const items: Record<string, TimelineItem> = {};
  const itemIds: string[] = [];

  // Add video item if project has video
  if (project.videoKey && project.videoUrl) {
    const videoTrack = tracks.find((t) => t.type === 'video');
    if (videoTrack) {
      const videoId = `video-${nanoid(8)}`;
      items[videoId] = {
        id: videoId,
        type: 'video',
        trackId: videoTrack.id,
        startMs: 0,
        endMs: project.durationMs,
        data: {
          src: project.videoUrl,
          width: project.sourceWidth,
          height: project.sourceHeight,
          volume: 1,
          playbackRate: 1,
          previewUrl: project.videoUrl,
        } as VideoItemData,
      };
      itemIds.push(videoId);
    }
  }

  // Convert subtitle items to captions
  const captionTrack = tracks.find((t) => t.type === 'caption');
  for (const item of apiProject.items) {
    if (item.type === 'subtitle' && captionTrack) {
      const data = item.data as {
        text?: string;
        words?: Array<{ text: string; startMs: number; endMs: number }>;
        style?: Record<string, unknown>;
      };

      // Merge caption style with defaults to ensure all properties exist
      const apiCaptionStyle = data.style || {};
      const captionStyle: CaptionStyle = {
        ...DEFAULT_CAPTION_STYLE,
        ...(apiCaptionStyle as Partial<CaptionStyle>),
      };

      // Migrate legacy animation string to V2 AnimationConfig
      if (typeof captionStyle.animation === 'string') {
        captionStyle.animation = migrateAnimationLegacy(captionStyle.animation);
      }

      const captionItem: TimelineItem = {
        id: item.id,
        type: 'caption',
        trackId: captionTrack.id,
        startMs: item.startMs,
        endMs: item.endMs,
        data: {
          text: data.text || '',
          words: (data.words || []).map((w) => ({
            text: w.text,
            startMs: w.startMs - item.startMs, // Convert to relative time
            endMs: w.endMs - item.startMs,
          })),
          style: captionStyle,
        } as CaptionItemData,
      };

      items[item.id] = captionItem;
      itemIds.push(item.id);
    }

    // Convert audio items — use enhanced audio by default when available
    if (item.type === 'audio') {
      const audioTrack = tracks.find((t) => t.type === 'audio');
      if (audioTrack) {
        const raw = item.data as Record<string, unknown>;
        const isComplete = raw.enhancementStatus === 'complete';
        const enhancedKey = raw.enhancedSrc as string | undefined;
        const originalKey = raw.originalSrc as string | undefined;

        // Resolve MinIO keys to streaming URLs
        const resolveUrl = (key: string | undefined) =>
          key ? `${API_URL}/api/media/outputs/${key}` : '';

        const audioItem: TimelineItem = {
          id: item.id,
          type: 'audio',
          trackId: audioTrack.id,
          startMs: item.startMs,
          endMs: item.endMs,
          data: {
            src: isComplete ? resolveUrl(enhancedKey) : resolveUrl(originalKey),
            originalSrc: resolveUrl(originalKey),
            enhancedSrc: resolveUrl(enhancedKey),
            isEnhanced: isComplete,
            sourceVideoItemId: (raw.sourceVideoItemId as string) || '',
            volume: (raw.volume as number) ?? 1,
            enhancementStatus: (raw.enhancementStatus as AudioItemData['enhancementStatus']) || 'idle',
            enhancementProgress: (raw.enhancementProgress as number) ?? 0,
          } as AudioItemData,
        };

        items[item.id] = audioItem;
        itemIds.push(item.id);
      }
    }

    // Convert visual items
    if (item.type === 'visual') {
      const visualTrack = tracks.find((t) => t.type === 'visual');
      if (visualTrack) {
        const raw = item.data as Record<string, unknown>;

        const visualItem: TimelineItem = {
          id: item.id,
          type: 'visual',
          trackId: visualTrack.id,
          startMs: item.startMs,
          endMs: item.endMs,
          data: {
            visualId: (raw.visualId as string) || '',
            compositionId: (raw.compositionId as string) || '',
            bundleUrl: (raw.bundleUrl as string) || '',
            videoUrl: (raw.videoUrl as string) || undefined,
            type: (raw.type as string) || 'visual',
            description: (raw.description as string) || '',
            width: (raw.width as number) || 1920,
            height: (raw.height as number) || 1080,
            fps: (raw.fps as number) || 30,
          } as VisualItemData,
        };

        items[item.id] = visualItem;
        itemIds.push(item.id);
      }
    }
  }

  return {
    project,
    tracks,
    items,
    itemIds,
    duration: project.durationMs,
  };
}

/**
 * Create the editor store with immer middleware
 */
export const useEditorStore = create<EditorStore>()(
  immer((set, get) => ({
    ...initialState,

    // ========================================
    // Project Actions
    // ========================================

    loadProject: async (projectId: string) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const apiProject = await api.getProject(projectId);

        // Use presigned URL from API (allows cross-origin video loading without cookies)
        // Fall back to direct URL for backwards compatibility
        const videoUrl = (apiProject as any).videoPresignedUrl
          || (apiProject.videoKey ? `${API_URL}/api/projects/${projectId}/video` : '');

        const { project, tracks, items, itemIds, duration } = convertApiProject(
          apiProject,
          videoUrl
        );

        // Restore persisted settings from videoSettings JSONB
        const savedVideoSettings = (apiProject as any).videoSettings;
        const savedLayoutSettings = savedVideoSettings?.layoutSettings;
        const savedLayoutPresetId = savedVideoSettings?.layoutPresetId;

        set((state) => {
          state.project = project;
          state.tracks = tracks;
          state.items = items;
          state.itemIds = itemIds;
          state.duration = duration;
          state.fps = project.fps;
          state.isLoading = false;
          state.currentTimeMs = 0;
          state.selectedIds = [];
          // Restore layout settings (merge with defaults for forward compat)
          if (savedLayoutSettings) {
            state.layoutSettings = {
              ...DEFAULT_LAYOUT_SETTINGS,
              ...savedLayoutSettings,
              pip: { ...DEFAULT_LAYOUT_SETTINGS.pip, ...savedLayoutSettings.pip },
              split: { ...DEFAULT_LAYOUT_SETTINGS.split, ...savedLayoutSettings.split },
            };
          }
          if (savedLayoutPresetId) {
            state.layoutPresetId = savedLayoutPresetId;
          }
          // Reset viewport
          state.viewport = {
            zoom: DEFAULT_ZOOM,
            scrollX: 0,
            scrollY: 0,
          };
          // Clear history on load
          state.history = [];
          state.historyIndex = -1;
        });

        // Push initial state to history
        get().pushHistory();
      } catch (err) {
        set((state) => {
          state.error = err instanceof Error ? err.message : 'Failed to load project';
          state.isLoading = false;
        });
      }
    },

    reloadVisuals: async (projectId: string) => {
      // Reload only visual items without resetting playback position or other state
      try {
        const apiProject = await api.getProject(projectId);

        // Use presigned URL from API
        const videoUrl = (apiProject as any).videoPresignedUrl
          || (apiProject.videoKey ? `${API_URL}/api/projects/${projectId}/video` : '');

        const { tracks: newTracks, items: newItems, itemIds: newItemIds } = convertApiProject(
          apiProject,
          videoUrl
        );

        set((state) => {
          // Only update visual-related data
          // Find existing non-visual items to preserve
          const existingNonVisualItemIds = state.itemIds.filter(id => {
            const item = state.items[id];
            return item && item.type !== 'visual';
          });

          // Find new visual items
          const newVisualItemIds = newItemIds.filter(id => {
            const item = newItems[id];
            return item && item.type === 'visual';
          });

          // Merge: keep existing non-visual items, add new visual items
          const mergedItemIds = [...existingNonVisualItemIds, ...newVisualItemIds];
          const mergedItems: Record<string, TimelineItem> = {};

          // Copy existing non-visual items
          for (const id of existingNonVisualItemIds) {
            mergedItems[id] = state.items[id];
          }

          // Add new visual items
          for (const id of newVisualItemIds) {
            mergedItems[id] = newItems[id];
          }

          // Check if we need to add a visual track
          const hasVisualTrack = state.tracks.some(t => t.type === 'visual');
          const needsVisualTrack = newVisualItemIds.length > 0 && !hasVisualTrack;

          if (needsVisualTrack) {
            const visualTrack = newTracks.find(t => t.type === 'visual');
            if (visualTrack) {
              state.tracks.push(visualTrack);
              state.tracks.sort((a, b) => a.position - b.position);
            }
          }

          state.items = mergedItems;
          state.itemIds = mergedItemIds;

          // Update outputKey so stale exports aren't served after edits
          if (state.project) {
            state.project.outputKey = (apiProject as any).outputKey || null;
          }

          // Don't reset playback position, selection, viewport, or history
        });
      } catch (err) {
        console.error('Failed to reload visuals:', err);
      }
    },

    saveProject: async () => {
      const { project, items, itemIds, layoutSettings, layoutPresetId } = get();
      if (!project) return;

      set((state) => {
        state.isSaving = true;
      });

      try {
        // Convert items back to API format
        const apiItems = itemIds
          .map((id) => items[id])
          .filter((item) => item.type === 'caption')
          .map((item) => {
            const data = item.data as CaptionItemData;
            return {
              id: item.id,
              startMs: item.startMs,
              endMs: item.endMs,
              data: {
                text: data.text,
                words: data.words.map((w) => ({
                  text: w.text,
                  startMs: w.startMs + item.startMs, // Convert back to absolute time
                  endMs: w.endMs + item.startMs,
                })),
                style: data.style,
              },
            };
          });

        // Persist layout settings inside videoSettings JSONB
        const videoSettingsPayload = {
          ...project.videoSettings,
          layoutSettings,
          layoutPresetId,
        };

        await api.updateProject(project.id, { items: apiItems, videoSettings: videoSettingsPayload });

        set((state) => {
          state.isSaving = false;
        });
      } catch (err) {
        set((state) => {
          state.error = err instanceof Error ? err.message : 'Failed to save project';
          state.isSaving = false;
        });
      }
    },

    setProject: (project) => {
      set((state) => {
        state.project = project;
      });
    },

    // ========================================
    // Video Settings Actions
    // ========================================

    updateVideoSettings: (settings: Partial<VideoSettings>) => {
      set((state) => {
        if (state.project) {
          state.project.videoSettings = {
            ...state.project.videoSettings,
            ...settings,
          };
        }
      });
      get().pushHistory();
    },

    // ========================================
    // Caption Style Actions
    // ========================================

    updateAllCaptionStyles: (styleUpdates: Partial<CaptionStyle>) => {
      set((state) => {
        // Update style on all caption items
        for (const itemId of state.itemIds) {
          const item = state.items[itemId];
          if (item?.type === 'caption') {
            const captionData = item.data as CaptionItemData;
            captionData.style = {
              ...captionData.style,
              ...styleUpdates,
            };
          }
        }
      });
      get().pushHistory();
      // Auto-save caption styles to database
      debouncedSave(() => get().saveProject());
    },

    updateSelectedCaptionStyles: (ids: string[], styleUpdates: Partial<CaptionStyle>) => {
      set((state) => {
        for (const id of ids) {
          const item = state.items[id];
          if (item?.type === 'caption') {
            const captionData = item.data as CaptionItemData;
            captionData.style = {
              ...captionData.style,
              ...styleUpdates,
            };
          }
        }
      });
      get().pushHistory();
      // Auto-save caption styles to database
      debouncedSave(() => get().saveProject());
    },

    updateWordStyleOverrides: (captionId: string, wordIndex: number, overrides: Partial<WordStyleOverrides> | null) => {
      set((state) => {
        const item = state.items[captionId];
        if (!item || item.type !== 'caption') return;

        const data = item.data as CaptionItemData;
        const word = data.words[wordIndex];
        if (!word) return;

        if (overrides === null) {
          // Clear all overrides
          word.styleOverrides = undefined;
        } else {
          // Merge overrides, removing undefined values
          const merged = { ...word.styleOverrides, ...overrides };
          // Clean out undefined values
          const cleaned: WordStyleOverrides = {};
          if (merged.color !== undefined) cleaned.color = merged.color;
          if (merged.fontWeight !== undefined) cleaned.fontWeight = merged.fontWeight;
          if (merged.scale !== undefined) cleaned.scale = merged.scale;
          if (merged.emphasisBg !== undefined) cleaned.emphasisBg = merged.emphasisBg;

          word.styleOverrides = Object.keys(cleaned).length > 0 ? cleaned : undefined;
        }
      });
      get().pushHistory();
    },

    setApplyStyleToAll: (value: boolean) => {
      set((state) => {
        state.applyStyleToAll = value;
      });
    },

    selectAllCaptionsOnTrack: (trackId: string) => {
      set((state) => {
        const captionIds = state.itemIds.filter((id) => {
          const item = state.items[id];
          return item?.type === 'caption' && item.trackId === trackId;
        });
        state.selectedIds = captionIds;
      });
    },

    // ========================================
    // Item Actions
    // ========================================

    addItem: (trackId, itemData) => {
      const id = itemData.id || nanoid(10);

      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (!track) return;

        const newItem: TimelineItem = {
          id,
          type: itemData.type || 'caption',
          trackId,
          startMs: itemData.startMs || 0,
          endMs: itemData.endMs || 1000,
          data: itemData.data || {},
        } as TimelineItem;

        state.items[id] = newItem;
        state.itemIds.push(id);
      });

      get().pushHistory();
      return id;
    },

    updateItem: (id, updates) => {
      set((state) => {
        const item = state.items[id];
        if (!item) return;

        Object.assign(item, updates);
      });

      get().pushHistory();
    },

    updateItemData: (id, dataUpdates) => {
      set((state) => {
        const item = state.items[id];
        if (!item) return;

        Object.assign(item.data, dataUpdates);
      });

      get().pushHistory();
    },

    deleteItems: async (ids) => {
      const { project, items } = get();

      // Check if any items are visual items - if so, we need to delete visuals from backend
      let hasVisualItems = false;
      for (const id of ids) {
        const item = items[id];
        if (item?.type === 'visual') {
          hasVisualItems = true;
          break;
        }
      }

      set((state) => {
        for (const id of ids) {
          // If deleting an audio item, unmute linked video
          const item = state.items[id];
          if (item?.type === 'audio') {
            const audioData = item.data as AudioItemData;
            if (audioData.sourceVideoItemId) {
              const videoItem = state.items[audioData.sourceVideoItemId];
              if (videoItem) {
                (videoItem.data as VideoItemData).muted = false;
                (videoItem.data as VideoItemData).separatedAudioItemId = undefined;
              }
            }
          }

          delete state.items[id];
          state.itemIds = state.itemIds.filter((itemId) => itemId !== id);
          state.selectedIds = state.selectedIds.filter((selectedId) => selectedId !== id);
        }
      });

      get().pushHistory();

      // If visual items were deleted, delete visuals from backend
      if (hasVisualItems && project) {
        try {
          await api.deleteVisuals(project.id);
        } catch (err) {
          console.error('Failed to delete visuals from backend:', err);
        }
      }

      // Persist the deletion to the backend
      await get().saveProject();
    },

    moveItem: (id, trackId, startMs) => {
      set((state) => {
        const item = state.items[id];
        if (!item) return;

        const duration = item.endMs - item.startMs;
        item.trackId = trackId;
        item.startMs = Math.max(0, startMs);
        item.endMs = item.startMs + duration;
      });

      get().pushHistory();
    },

    resizeItem: (id, startMs, endMs) => {
      set((state) => {
        const item = state.items[id];
        if (!item) return;

        item.startMs = Math.max(0, startMs);
        item.endMs = Math.max(item.startMs + 100, endMs); // Minimum 100ms duration
      });

      get().pushHistory();
    },

    // ========================================
    // Selection Actions
    // ========================================

    select: (ids, mode = 'replace') => {
      set((state) => {
        switch (mode) {
          case 'replace':
            state.selectedIds = ids;
            break;
          case 'add':
            state.selectedIds = [...new Set([...state.selectedIds, ...ids])];
            break;
          case 'toggle':
            for (const id of ids) {
              const index = state.selectedIds.indexOf(id);
              if (index === -1) {
                state.selectedIds.push(id);
              } else {
                state.selectedIds.splice(index, 1);
              }
            }
            break;
        }
      });
    },

    selectRange: (anchorId: string, targetId: string) => {
      set((state) => {
        // Find positions of both items within the same track
        const anchorItem = state.items[anchorId];
        const targetItem = state.items[targetId];
        if (!anchorItem || !targetItem) return;

        // Get all items on the same track, sorted by start time
        const trackId = anchorItem.trackId;
        const trackItems = state.itemIds
          .map((id) => state.items[id])
          .filter((item) => item && item.trackId === trackId)
          .sort((a, b) => a.startMs - b.startMs);

        const anchorIndex = trackItems.findIndex((item) => item.id === anchorId);
        const targetIndex = trackItems.findIndex((item) => item.id === targetId);
        if (anchorIndex === -1 || targetIndex === -1) return;

        const start = Math.min(anchorIndex, targetIndex);
        const end = Math.max(anchorIndex, targetIndex);

        state.selectedIds = trackItems.slice(start, end + 1).map((item) => item.id);
      });
    },

    selectAll: () => {
      set((state) => {
        state.selectedIds = [...state.itemIds];
      });
    },

    clearSelection: () => {
      set((state) => {
        state.selectedIds = [];
      });
    },

    setSelectionBox: (box) => {
      set((state) => {
        state.selectionBox = box;
      });
    },

    // ========================================
    // Playback Actions
    // ========================================

    play: () => {
      set((state) => {
        state.isPlaying = true;
      });
    },

    pause: () => {
      set((state) => {
        state.isPlaying = false;
      });
    },

    togglePlayback: () => {
      set((state) => {
        state.isPlaying = !state.isPlaying;
      });
    },

    seek: (timeMs) => {
      set((state) => {
        state.currentTimeMs = Math.max(0, Math.min(timeMs, state.duration));
      });
    },

    setCurrentTime: (timeMs) => {
      set((state) => {
        state.currentTimeMs = Math.max(0, Math.min(timeMs, state.duration));
      });
    },

    // ========================================
    // Viewport Actions
    // ========================================

    setZoom: (zoom) => {
      set((state) => {
        // Clamp zoom between 0.01 and 1 (1px/100ms to 1px/ms)
        state.viewport.zoom = Math.max(0.01, Math.min(1, zoom));
      });
    },

    setScrollX: (scrollX) => {
      set((state) => {
        state.viewport.scrollX = Math.max(0, scrollX);
      });
    },

    setScrollY: (scrollY) => {
      set((state) => {
        state.viewport.scrollY = Math.max(0, scrollY);
      });
    },

    zoomToFit: () => {
      set((state) => {
        // This would need canvas width - for now just set a reasonable zoom
        state.viewport.zoom = DEFAULT_ZOOM;
        state.viewport.scrollX = 0;
      });
    },

    // ========================================
    // Drag Actions
    // ========================================

    startDrag: (dragState) => {
      set((state) => {
        state.dragState = dragState;
      });
    },

    updateDrag: (x, y) => {
      set((state) => {
        if (state.dragState) {
          state.dragState.currentX = x;
          state.dragState.currentY = y;
        }
      });
    },

    endDrag: () => {
      set((state) => {
        state.dragState = null;
      });
    },

    // ========================================
    // History Actions
    // ========================================

    undo: () => {
      const { history, historyIndex } = get();
      if (historyIndex <= 0) return;

      const newIndex = historyIndex - 1;
      const entry = history[newIndex];

      set((state) => {
        state.tracks = entry.tracks;
        state.items = entry.items;
        state.itemIds = entry.itemIds;
        state.selectedIds = entry.selectedIds;
        state.historyIndex = newIndex;
      });
    },

    redo: () => {
      const { history, historyIndex } = get();
      if (historyIndex >= history.length - 1) return;

      const newIndex = historyIndex + 1;
      const entry = history[newIndex];

      set((state) => {
        state.tracks = entry.tracks;
        state.items = entry.items;
        state.itemIds = entry.itemIds;
        state.selectedIds = entry.selectedIds;
        state.historyIndex = newIndex;
      });
    },

    pushHistory: () => {
      const { tracks, items, itemIds, selectedIds, history, historyIndex } = get();

      // Create deep copy of current state
      const entry: HistoryEntry = {
        tracks: JSON.parse(JSON.stringify(tracks)),
        items: JSON.parse(JSON.stringify(items)),
        itemIds: [...itemIds],
        selectedIds: [...selectedIds],
      };

      set((state) => {
        // Remove any redo history
        state.history = history.slice(0, historyIndex + 1);
        state.history.push(entry);
        state.historyIndex = state.history.length - 1;

        // Limit history size
        if (state.history.length > 50) {
          state.history.shift();
          state.historyIndex--;
        }
      });
    },

    // ========================================
    // Track Actions
    // ========================================

    addTrack: (trackData) => {
      const id = trackData.id || nanoid(10);

      set((state) => {
        const newTrack: Track = {
          id,
          type: trackData.type || 'overlay',
          name: trackData.name || 'New Track',
          position: trackData.position ?? state.tracks.length,
          locked: trackData.locked ?? false,
          visible: trackData.visible ?? true,
          height: trackData.height ?? DEFAULT_TRACK_HEIGHT,
          collapsed: trackData.collapsed ?? false,
        };

        state.tracks.push(newTrack);
        state.tracks.sort((a, b) => a.position - b.position);
      });

      get().pushHistory();
      return id;
    },

    updateTrack: (id, updates) => {
      set((state) => {
        const track = state.tracks.find((t) => t.id === id);
        if (track) {
          Object.assign(track, updates);
        }
      });

      get().pushHistory();
    },

    deleteTrack: (id) => {
      set((state) => {
        // Find items on this track that might be linked audio
        const itemsOnTrack = state.itemIds
          .map((itemId) => state.items[itemId])
          .filter((item) => item?.trackId === id);

        // If any are audio items linked to video, unmute the video
        for (const item of itemsOnTrack) {
          if (item?.type === 'audio') {
            const audioData = item.data as AudioItemData;
            if (audioData.sourceVideoItemId) {
              const videoItem = state.items[audioData.sourceVideoItemId];
              if (videoItem) {
                (videoItem.data as VideoItemData).muted = false;
                (videoItem.data as VideoItemData).separatedAudioItemId = undefined;
              }
            }
          }
        }

        // Delete all items on this track
        const itemsToDelete = state.itemIds.filter(
          (itemId) => state.items[itemId]?.trackId === id
        );
        for (const itemId of itemsToDelete) {
          delete state.items[itemId];
          state.selectedIds = state.selectedIds.filter((sId) => sId !== itemId);
        }
        state.itemIds = state.itemIds.filter((itemId) => !itemsToDelete.includes(itemId));

        // Delete track
        state.tracks = state.tracks.filter((t) => t.id !== id);
      });

      get().pushHistory();
    },

    reorderTracks: (trackIds) => {
      set((state) => {
        const trackMap = new Map(state.tracks.map((t) => [t.id, t]));
        state.tracks = trackIds
          .map((id, index) => {
            const track = trackMap.get(id);
            if (track) {
              track.position = index;
              return track;
            }
            return null;
          })
          .filter((t): t is Track => t !== null);
      });

      get().pushHistory();
    },

    // ========================================
    // Audio Separation Actions
    // ========================================

    separateAudio: async (videoItemId: string) => {
      const { project, items } = get();
      if (!project) return;

      const videoItem = items[videoItemId];
      if (!videoItem || videoItem.type !== 'video') return;

      try {
        // Call API to start separation
        const response = await api.separateAudio(project.id, videoItemId);

        // Optimistically add audio track and item
        const audioTrackId = response.trackId;
        const audioItemId = response.itemId;

        set((state) => {
          // Add audio track
          const newTrack: Track = {
            id: audioTrackId,
            type: 'audio',
            name: 'Audio',
            position: state.tracks.length,
            locked: false,
            visible: true,
            height: TRACK_HEIGHTS.audio || DEFAULT_TRACK_HEIGHT,
            collapsed: false,
          };
          state.tracks.push(newTrack);
          state.tracks.sort((a, b) => a.position - b.position);

          // Add audio item (processing state)
          const audioItem: TimelineItem = {
            id: audioItemId,
            type: 'audio',
            trackId: audioTrackId,
            startMs: videoItem.startMs,
            endMs: videoItem.endMs,
            data: {
              src: '',
              originalSrc: '',
              isEnhanced: false,
              sourceVideoItemId: videoItemId,
              volume: 1,
              enhancementStatus: 'processing',
              enhancementProgress: 0,
            } as AudioItemData,
          };
          state.items[audioItemId] = audioItem;
          state.itemIds.push(audioItemId);

          // Mute the video item
          const vid = state.items[videoItemId];
          if (vid) {
            (vid.data as VideoItemData).muted = true;
            (vid.data as VideoItemData).separatedAudioItemId = audioItemId;
          }
        });

        get().pushHistory();
      } catch (err) {
        set((state) => {
          state.error = err instanceof Error ? err.message : 'Failed to separate audio';
        });
      }
    },

    toggleEnhancement: (audioItemId: string) => {
      set((state) => {
        const item = state.items[audioItemId];
        if (!item || item.type !== 'audio') return;

        const data = item.data as AudioItemData;
        if (!data.enhancedSrc || !data.originalSrc) return;

        // Toggle between enhanced and original
        data.isEnhanced = !data.isEnhanced;
        data.src = data.isEnhanced ? data.enhancedSrc : data.originalSrc;
      });

      get().pushHistory();
    },

    updateEnhancementStatus: (
      audioItemId: string,
      status: AudioItemData['enhancementStatus'],
      progress?: number,
      enhancedSrc?: string
    ) => {
      set((state) => {
        const item = state.items[audioItemId];
        if (!item || item.type !== 'audio') return;

        const data = item.data as AudioItemData;
        data.enhancementStatus = status;
        if (progress !== undefined) data.enhancementProgress = progress;
        if (enhancedSrc) {
          data.enhancedSrc = enhancedSrc;
          data.src = enhancedSrc;
          data.isEnhanced = true;
        }
      });
    },

    // ========================================
    // Split Actions
    // ========================================

    splitItem: (itemId: string, atMs: number) => {
      const item = get().items[itemId];
      if (!item) return;

      const splitRelativeMs = atMs - item.startMs;
      const duration = item.endMs - item.startMs;

      if (splitRelativeMs <= 100 || splitRelativeMs >= duration - 100) return;

      set((state) => {
        const original = state.items[itemId];
        if (!original) return;

        const leftId = nanoid(10);
        const rightId = nanoid(10);

        if (original.type === 'caption') {
          const data = original.data as CaptionItemData;
          const leftWords: CaptionWord[] = [];
          const rightWords: CaptionWord[] = [];

          for (const word of data.words) {
            if (word.endMs <= splitRelativeMs) {
              leftWords.push({ ...word });
            } else {
              rightWords.push({
                ...word,
                startMs: word.startMs - splitRelativeMs,
                endMs: word.endMs - splitRelativeMs,
              });
            }
          }

          const leftText = leftWords.map((w) => w.text).join(' ');
          const rightText = rightWords.map((w) => w.text).join(' ');

          const leftItem: TimelineItem = {
            id: leftId,
            type: 'caption',
            trackId: original.trackId,
            startMs: original.startMs,
            endMs: atMs,
            data: {
              text: leftText,
              words: leftWords,
              style: { ...data.style },
            } as CaptionItemData,
          };

          const rightItem: TimelineItem = {
            id: rightId,
            type: 'caption',
            trackId: original.trackId,
            startMs: atMs,
            endMs: original.endMs,
            data: {
              text: rightText,
              words: rightWords,
              style: { ...data.style },
            } as CaptionItemData,
          };

          state.items[leftId] = leftItem;
          state.items[rightId] = rightItem;
          state.itemIds.push(leftId, rightId);
        } else {
          const leftItem: TimelineItem = {
            id: leftId,
            type: original.type,
            trackId: original.trackId,
            startMs: original.startMs,
            endMs: atMs,
            data: JSON.parse(JSON.stringify(original.data)),
          };
          if (original.trim) {
            leftItem.trim = {
              startMs: original.trim.startMs,
              endMs: original.trim.startMs + splitRelativeMs,
            };
          }

          const rightItem: TimelineItem = {
            id: rightId,
            type: original.type,
            trackId: original.trackId,
            startMs: atMs,
            endMs: original.endMs,
            data: JSON.parse(JSON.stringify(original.data)),
          };
          if (original.trim) {
            rightItem.trim = {
              startMs: original.trim.startMs + splitRelativeMs,
              endMs: original.trim.endMs,
            };
          }

          state.items[leftId] = leftItem;
          state.items[rightId] = rightItem;
          state.itemIds.push(leftId, rightId);
        }

        delete state.items[itemId];
        state.itemIds = state.itemIds.filter((id) => id !== itemId);
        state.selectedIds = state.selectedIds.filter((id) => id !== itemId);
        state.selectedIds.push(rightId);
      });

      get().pushHistory();
    },

    setSplitMode: (active: boolean) => {
      set((state) => {
        state.splitMode = active;
      });
    },

    // ========================================
    // Clipboard Actions
    // ========================================

    copyItems: (ids: string[]) => {
      set((state) => {
        const itemsToCopy = ids
          .map((id) => state.items[id])
          .filter(Boolean);
        state.clipboard = JSON.parse(JSON.stringify(itemsToCopy));
      });
    },

    pasteItems: (atMs: number) => {
      const { clipboard } = get();
      if (!clipboard || clipboard.length === 0) return;

      set((state) => {
        const cloned: TimelineItem[] = JSON.parse(JSON.stringify(clipboard));
        const earliest = Math.min(...cloned.map((item) => item.startMs));
        const offset = atMs - earliest;

        const newIds: string[] = [];
        for (const item of cloned) {
          const newId = nanoid(10);
          item.id = newId;
          item.startMs += offset;
          item.endMs += offset;
          state.items[newId] = item;
          state.itemIds.push(newId);
          newIds.push(newId);
        }

        state.selectedIds = newIds;
      });

      get().pushHistory();
    },

    duplicateItems: (ids: string[]) => {
      set((state) => {
        const newIds: string[] = [];

        for (const id of ids) {
          const original = state.items[id];
          if (!original) continue;

          const cloned: TimelineItem = JSON.parse(JSON.stringify(original));
          const duration = original.endMs - original.startMs;
          const newId = nanoid(10);

          cloned.id = newId;
          cloned.startMs = original.endMs;
          cloned.endMs = original.endMs + duration;

          state.items[newId] = cloned;
          state.itemIds.push(newId);
          newIds.push(newId);
        }

        state.selectedIds = newIds;
      });

      get().pushHistory();
    },

    // ========================================
    // Nudge & Trim Actions
    // ========================================

    nudgeItems: (ids: string[], deltaMs: number) => {
      set((state) => {
        for (const id of ids) {
          const item = state.items[id];
          if (!item) continue;

          const duration = item.endMs - item.startMs;
          let newStartMs = item.startMs + deltaMs;

          if (newStartMs < 0) {
            newStartMs = 0;
          }

          item.startMs = newStartMs;
          item.endMs = newStartMs + duration;
        }
      });

      get().pushHistory();
    },

    trimItems: (ids: string[], edge: 'start' | 'end', deltaMs: number) => {
      set((state) => {
        for (const id of ids) {
          const item = state.items[id];
          if (!item) continue;

          if (edge === 'start') {
            const newStartMs = item.startMs + deltaMs;
            item.startMs = Math.min(newStartMs, item.endMs - 100);
          } else {
            const newEndMs = item.endMs + deltaMs;
            item.endMs = Math.max(newEndMs, item.startMs + 100);
          }
        }
      });

      get().pushHistory();
    },

    // ========================================
    // Subtitle-Specific Actions
    // ========================================

    splitCaption: (captionId: string, wordIndex: number) => {
      const item = get().items[captionId];
      if (!item || item.type !== 'caption') return;

      const data = item.data as CaptionItemData;
      if (wordIndex <= 0 || wordIndex >= data.words.length) return;

      set((state) => {
        const original = state.items[captionId];
        if (!original) return;

        const captionData = original.data as CaptionItemData;
        const leftWords = captionData.words.slice(0, wordIndex);
        const rightWords = captionData.words.slice(wordIndex);

        const leftEndMs = leftWords[leftWords.length - 1].endMs + original.startMs;
        const rightStartMs = rightWords[0].startMs + original.startMs;

        const adjustedRightWords: CaptionWord[] = rightWords.map((w) => ({
          ...w,
          startMs: w.startMs - rightWords[0].startMs,
          endMs: w.endMs - rightWords[0].startMs,
        }));

        const leftId = nanoid(10);
        const rightId = nanoid(10);

        const leftItem: TimelineItem = {
          id: leftId,
          type: 'caption',
          trackId: original.trackId,
          startMs: original.startMs,
          endMs: leftEndMs,
          data: {
            text: leftWords.map((w) => w.text).join(' '),
            words: leftWords.map((w) => ({ ...w })),
            style: { ...captionData.style },
          } as CaptionItemData,
        };

        const rightItem: TimelineItem = {
          id: rightId,
          type: 'caption',
          trackId: original.trackId,
          startMs: rightStartMs,
          endMs: original.endMs,
          data: {
            text: adjustedRightWords.map((w) => w.text).join(' '),
            words: adjustedRightWords,
            style: { ...captionData.style },
          } as CaptionItemData,
        };

        state.items[leftId] = leftItem;
        state.items[rightId] = rightItem;
        state.itemIds.push(leftId, rightId);

        delete state.items[captionId];
        state.itemIds = state.itemIds.filter((id) => id !== captionId);
        state.selectedIds = state.selectedIds.filter((id) => id !== captionId);
      });

      get().pushHistory();
    },

    mergeCaptions: (captionId1: string, captionId2: string) => {
      const items = get().items;
      const item1 = items[captionId1];
      const item2 = items[captionId2];

      if (!item1 || !item2) return;
      if (item1.type !== 'caption' || item2.type !== 'caption') return;
      if (item1.trackId !== item2.trackId) return;

      const [first, second] = item1.startMs <= item2.startMs
        ? [item1, item2]
        : [item2, item1];

      set((state) => {
        const firstData = (state.items[first.id]!.data as CaptionItemData);
        const secondData = (state.items[second.id]!.data as CaptionItemData);

        const offset = second.startMs - first.startMs;
        const adjustedSecondWords: CaptionWord[] = secondData.words.map((w) => ({
          ...w,
          startMs: w.startMs + offset,
          endMs: w.endMs + offset,
        }));

        const mergedWords = [...firstData.words, ...adjustedSecondWords];
        const mergedText = mergedWords.map((w) => w.text).join(' ');

        const mergedId = nanoid(10);
        const mergedItem: TimelineItem = {
          id: mergedId,
          type: 'caption',
          trackId: first.trackId,
          startMs: first.startMs,
          endMs: second.endMs,
          data: {
            text: mergedText,
            words: mergedWords,
            style: { ...firstData.style },
          } as CaptionItemData,
        };

        state.items[mergedId] = mergedItem;
        state.itemIds.push(mergedId);

        delete state.items[first.id];
        delete state.items[second.id];
        state.itemIds = state.itemIds.filter(
          (id) => id !== first.id && id !== second.id
        );
        state.selectedIds = state.selectedIds.filter(
          (id) => id !== first.id && id !== second.id
        );
      });

      get().pushHistory();
    },

    updateCaptionText: (captionId: string, newText: string) => {
      set((state) => {
        const item = state.items[captionId];
        if (!item || item.type !== 'caption') return;

        const data = item.data as CaptionItemData;
        data.text = newText;
      });

      get().pushHistory();
    },

    // ========================================
    // Layout Actions
    // ========================================

    updateLayoutSettings: (settings: Partial<LayoutSettings>) => {
      set((state) => {
        state.layoutSettings = {
          ...state.layoutSettings,
          ...settings,
        };
        state.layoutPresetId = 'custom';
      });
      debouncedSave(() => get().saveProject());
    },

    updatePiPSettings: (settings: Partial<PiPSettings>) => {
      set((state) => {
        state.layoutSettings.pip = {
          ...state.layoutSettings.pip,
          ...settings,
        };
        state.layoutPresetId = 'custom';
      });
      debouncedSave(() => get().saveProject());
    },

    updateSplitSettings: (settings: Partial<SplitSettings>) => {
      set((state) => {
        state.layoutSettings.split = {
          ...state.layoutSettings.split,
          ...settings,
        };
        state.layoutPresetId = 'custom';
      });
      debouncedSave(() => get().saveProject());
    },

    setLayoutPreset: (presetId: LayoutPresetId) => {
      const preset = LAYOUT_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;

      set((state) => {
        state.layoutPresetId = presetId;
        state.layoutSettings = JSON.parse(JSON.stringify(preset.settings));
      });
      debouncedSave(() => get().saveProject());
    },

    setLayoutMode: (mode: LayoutMode) => {
      set((state) => {
        state.layoutSettings.mode = mode;
        state.layoutPresetId = 'custom';
      });
      debouncedSave(() => get().saveProject());
    },

    // Scene selection for AI editing
    setSelectedScene: (sceneId: number | null) => {
      set((state) => {
        state.selectedSceneId = sceneId;
        // Clear time range when selecting a scene
        if (sceneId !== null) {
          state.selectedTimeRange = null;
        }
      });
    },

    setSelectedTimeRange: (range: { startMs: number; endMs: number } | null) => {
      set((state) => {
        state.selectedTimeRange = range;
        // Clear scene selection when selecting a time range
        if (range !== null) {
          state.selectedSceneId = null;
        }
      });
    },

    setSelectedElement: (element: { name: string; type: string; sceneId: number; description?: string } | null) => {
      set((state) => {
        state.selectedElement = element;
      });
    },

    setElementPickerEnabled: (enabled: boolean) => {
      set((state) => {
        state.elementPickerEnabled = enabled;
      });
    },

    // ========================================
    // AI Edit Request
    // ========================================

    requestAIEdit: (item) => {
      set((state) => {
        state.selectedTimeRange = { startMs: item.startMs, endMs: item.endMs };
        state.selectedSceneId = null;
        state.aiEditRequested = true;
      });
    },

    // ========================================
    // Safe Zone Actions
    // ========================================

    setSafeZonePlatform: (platform: string) => {
      set((state) => {
        state.safeZonePlatform = platform;
      });
    },

    setShowSafeZone: (show: boolean) => {
      set((state) => {
        state.showSafeZone = show;
      });
    },
  }))
);
