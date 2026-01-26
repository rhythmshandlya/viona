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
  CaptionItemData,
  VideoItemData,
  VideoSettings,
  CaptionStyle,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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
    status: apiProject.status,
    videoKey: apiProject.videoKey,
    videoUrl,
    durationMs: apiProject.durationMs || 0,
    fps: apiProject.fps || DEFAULT_FPS,
    sourceWidth: (apiProject as any).sourceWidth || apiProject.width || 1920,
    sourceHeight: (apiProject as any).sourceHeight || apiProject.height || 1080,
    videoSettings,
  };

  // Convert tracks
  const tracks: Track[] = apiProject.tracks.map((t) => ({
    id: t.id,
    type: t.type as Track['type'],
    name: t.name,
    position: t.position,
    locked: t.locked,
    visible: t.visible,
    height: DEFAULT_TRACK_HEIGHT,
    collapsed: false,
  }));

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
      height: DEFAULT_TRACK_HEIGHT,
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
      height: DEFAULT_TRACK_HEIGHT,
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

        // Construct video URL
        const videoUrl = apiProject.videoKey
          ? `${API_URL}/api/projects/${projectId}/video`
          : '';

        const { project, tracks, items, itemIds, duration } = convertApiProject(
          apiProject,
          videoUrl
        );

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

    saveProject: async () => {
      const { project, items, itemIds } = get();
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

        await api.updateProject(project.id, { items: apiItems });

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

    deleteItems: (ids) => {
      set((state) => {
        for (const id of ids) {
          delete state.items[id];
          state.itemIds = state.itemIds.filter((itemId) => itemId !== id);
          state.selectedIds = state.selectedIds.filter((selectedId) => selectedId !== id);
        }
      });

      get().pushHistory();
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
  }))
);
