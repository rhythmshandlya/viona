/**
 * Editor V2 Zustand Store
 * Main state management with immer for immutable updates
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import { api, Project as ApiProject } from '@/lib/api';
import { wsClient } from '@/lib/ws';
import { loadFont, findFont } from '@/lib/font-registry';
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
  VisualDisplayMode,
  VideoSettings,
  CaptionStyle,
  AnimationConfig,
  WordStyleOverrides,
  LayoutSettings,
  LayoutPresetId,
  LayoutMode,
  PiPSettings,
  PiPCrop,
  SplitSettings,
  normalizeLayoutMode,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Debounce utility for auto-save
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
const debouncedSave = (saveFn: () => Promise<void>, delay = 1000) => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    console.log('[debouncedSave] firing save…');
    saveFn().then(() => console.log('[debouncedSave] save OK')).catch((err) => console.error('[debouncedSave] save FAILED:', err));
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

  // Caption visibility in player
  showCaptions: true,

  // Clipboard and split mode
  clipboard: null,
  splitMode: false,

  // Layout settings
  layoutSettings: DEFAULT_LAYOUT_SETTINGS,
  layoutPresetId: 'stacked-equal' as LayoutPresetId,

  // Scene selection for AI editing
  selectedSceneId: null,
  selectedTimeRange: null,
  selectedElement: null,

  // Element picker mode
  elementPickerEnabled: false,

  // Element inspect mode
  inspectModeEnabled: false,

  // AI edit request
  aiEditRequested: false,

  // Pending AI message
  pendingAIMessage: null,

  // Transition picker
  transitionPickerItemId: null,

  // Safe zone settings
  safeZonePlatform: 'none',
  showSafeZone: false,

  // Visual scene regeneration tracking
  regeneratingVisualItemIds: new Set<string>(),
  splitJobToItems: {},
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

  const projectType = (apiProject as any).projectType || 'video';
  const isAudioProject = projectType === 'audio';

  const project = {
    id: apiProject.id,
    title: (apiProject as any).title || null,
    status: apiProject.status,
    projectType: projectType as 'video' | 'audio',
    videoKey: apiProject.videoKey,
    audioKey: (apiProject as any).audioKey || null,
    videoUrl,
    audioUrl: (apiProject as any).audioPresignedUrl || null,
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

  // Ensure we have a video track (only for video projects)
  if (!isAudioProject) {
    const hasVideoTrack = tracks.some((t) => t.type === 'video');
    if (!hasVideoTrack) {
      tracks.push({
        id: crypto.randomUUID(),
        type: 'video',
        name: 'Video',
        position: 0,
        locked: false,
        visible: true,
        height: TRACK_HEIGHTS.video,
        collapsed: false,
      });
    }
  }

  // Ensure we have a caption track
  const hasCaptionTrack = tracks.some((t) => t.type === 'caption');
  if (!hasCaptionTrack) {
    tracks.push({
      id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
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

  // Add video items: prefer DB items (from splits), fall back to synthetic full-duration item
  const dbVideoItems = apiProject.items?.filter((i: { type: string }) => i.type === 'video') || [];
  if (!isAudioProject && project.videoKey && project.videoUrl) {
    const videoTrack = tracks.find((t) => t.type === 'video');
    if (videoTrack) {
      if (dbVideoItems.length > 0) {
        // Use saved video items (split state persisted)
        for (const item of dbVideoItems) {
          const raw = item.data as Record<string, unknown>;
          const videoItem: TimelineItem = {
            id: item.id,
            type: 'video',
            trackId: videoTrack.id,
            startMs: item.startMs,
            endMs: item.endMs,
            data: {
              src: project.videoUrl,
              width: (raw.width as number) || project.sourceWidth,
              height: (raw.height as number) || project.sourceHeight,
              volume: (raw.volume as number) ?? 1,
              playbackRate: (raw.playbackRate as number) ?? 1,
              muted: (raw.muted as boolean) ?? false,
              separatedAudioItemId: (raw.separatedAudioItemId as string) || undefined,
              previewUrl: project.videoUrl,
            } as VideoItemData,
          };
          if (item.startMs != null && item.endMs != null) {
            videoItem.trim = {
              startMs: (raw.trimStartMs as number) ?? item.startMs,
              endMs: (raw.trimEndMs as number) ?? item.endMs,
            };
          }
          items[item.id] = videoItem;
          itemIds.push(item.id);
        }
      } else {
        // No saved video items — create synthetic full-duration item
        const videoId = crypto.randomUUID();
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
  }

  // Convert subtitle items to captions
  const captionTrack = tracks.find((t) => t.type === 'caption');
  for (const item of apiProject.items) {
    if (item.type === 'subtitle' && captionTrack) {
      const data = item.data as {
        text?: string;
        words?: Array<{ text: string; startMs: number; endMs: number; styleOverrides?: WordStyleOverrides }>;
        style?: Record<string, unknown>;
        styleOverrides?: Partial<CaptionStyle>;
        aiWordOverrides?: Record<number, WordStyleOverrides>;
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
            ...(w.styleOverrides ? { styleOverrides: w.styleOverrides } : {}),
          })),
          style: captionStyle,
          ...(data.styleOverrides ? { styleOverrides: data.styleOverrides } : {}),
          ...(data.aiWordOverrides ? { aiWordOverrides: data.aiWordOverrides } : {}),
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

        // For audio/video projects, the src is already a direct API path (e.g. /api/projects/:id/audio)
        // Use presigned URL when available (avoids cross-origin auth issues with <Audio> element)
        const rawSrc = raw.src as string | undefined;
        const isDirectUrl = rawSrc?.startsWith('/api/');
        const isVideoAudio = rawSrc?.includes('/video');
        const directSrc = isDirectUrl
          ? (isVideoAudio ? project.videoUrl : project.audioUrl) || `${API_URL}${rawSrc}`
          : '';

        const audioItem: TimelineItem = {
          id: item.id,
          type: 'audio',
          trackId: audioTrack.id,
          startMs: item.startMs,
          endMs: item.endMs,
          data: {
            src: isDirectUrl ? directSrc : (isComplete ? resolveUrl(enhancedKey) : resolveUrl(originalKey)),
            originalSrc: isDirectUrl ? directSrc : resolveUrl(originalKey),
            enhancedSrc: isDirectUrl ? undefined : resolveUrl(enhancedKey),
            isEnhanced: isDirectUrl ? false : isComplete,
            sourceVideoItemId: (raw.sourceVideoItemId as string) || '',
            volume: (raw.volume as number) ?? 1,
            enhancementStatus: isDirectUrl ? 'idle' : ((raw.enhancementStatus as AudioItemData['enhancementStatus']) || 'idle'),
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
            sourceSceneId: (raw.sourceSceneId as number) || undefined,
            displayMode: (raw.displayMode as VisualDisplayMode) || undefined,
            transition: (raw.transition as VisualItemData['transition']) || undefined,
            overlayOpacity: (raw.overlayOpacity as number) ?? undefined,
            speakerBbox: (raw.speakerBbox as VisualItemData['speakerBbox']) ?? undefined,
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
 * Split a single item at the given absolute time within an immer draft.
 * Removes the original item, creates left + right halves, and selects the right half.
 * Returns the [leftId, rightId] or null if the split was invalid.
 */
function splitItemInDraft(
  state: EditorState,
  itemId: string,
  atMs: number
): [string, string] | null {
  const original = state.items[itemId];
  if (!original) return null;

  atMs = Math.round(atMs);
  const splitRelativeMs = atMs - original.startMs;
  const duration = original.endMs - original.startMs;

  if (splitRelativeMs <= 0 || splitRelativeMs >= duration) return null;

  const leftId = crypto.randomUUID();
  const rightId = crypto.randomUUID();

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
          startMs: Math.max(0, word.startMs - splitRelativeMs),
          endMs: word.endMs - splitRelativeMs,
        });
      }
    }

    const leftText = leftWords.map((w) => w.text).join(' ');
    const rightText = rightWords.map((w) => w.text).join(' ');

    state.items[leftId] = {
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

    state.items[rightId] = {
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
  }

  state.itemIds.push(leftId, rightId);
  delete state.items[itemId];
  state.itemIds = state.itemIds.filter((id) => id !== itemId);
  state.selectedIds = state.selectedIds.filter((id) => id !== itemId);
  state.selectedIds.push(rightId);

  return [leftId, rightId];
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
              // Normalize legacy layout mode values (split-horizontal → stacked)
              mode: normalizeLayoutMode(savedLayoutSettings.mode || 'stacked'),
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

        // Auto-load caption fonts used in the project
        const captionFonts = new Set<string>();
        for (const id of itemIds) {
          const item = items[id];
          if (item?.type === 'caption') {
            const fontFamily = (item.data as CaptionItemData).style?.fontFamily;
            if (fontFamily) captionFonts.add(fontFamily.split(',')[0].trim());
          }
        }
        for (const family of captionFonts) {
          const entry = findFont(family);
          if (entry) loadFont(entry);
        }
      } catch (err) {
        set((state) => {
          state.error = err instanceof Error ? err.message : 'Failed to load project';
          state.isLoading = false;
        });
      }
    },

    reloadVisuals: async (projectId: string) => {
      // Reload only visual items without resetting playback position or other state
      // Retry once on 401 — Stytch JWT may have expired and the SDK refreshes it in the background
      const fetchProject = async (retry = true): ReturnType<typeof api.getProject> => {
        try {
          return await api.getProject(projectId);
        } catch (err) {
          if (retry && err instanceof Error && err.message.includes('Unauthorized')) {
            await new Promise(r => setTimeout(r, 2000)); // wait for Stytch SDK to refresh JWT
            return fetchProject(false);
          }
          throw err;
        }
      };
      try {
        const apiProject = await fetchProject();

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

          // Sync visual track: add if visuals appeared, remove if visuals gone
          const hasVisualTrack = state.tracks.some(t => t.type === 'visual');

          if (newVisualItemIds.length > 0 && !hasVisualTrack) {
            // Visuals appeared — add the visual track
            const visualTrack = newTracks.find(t => t.type === 'visual');
            if (visualTrack) {
              state.tracks.push(visualTrack);
              state.tracks.sort((a, b) => a.position - b.position);
            }
          } else if (newVisualItemIds.length === 0 && hasVisualTrack) {
            // Visuals gone (e.g. after "start over") — remove visual track
            state.tracks = state.tracks.filter(t => t.type !== 'visual');
          }

          state.items = mergedItems;
          state.itemIds = mergedItemIds;

          // Sync project status and outputKey from API
          if (state.project) {
            state.project.outputKey = (apiProject as any).outputKey || null;
            state.project.status = apiProject.status;
          }

          // Reload layout settings in case generation persisted a new layoutMode
          const savedVideoSettings = (apiProject as any).videoSettings;
          const savedLayoutSettings = savedVideoSettings?.layoutSettings;
          if (savedLayoutSettings) {
            state.layoutSettings = {
              ...DEFAULT_LAYOUT_SETTINGS,
              ...savedLayoutSettings,
              // Normalize legacy layout mode values (split-horizontal → stacked)
              mode: normalizeLayoutMode(savedLayoutSettings.mode || 'stacked'),
              pip: { ...DEFAULT_LAYOUT_SETTINGS.pip, ...savedLayoutSettings.pip },
              split: { ...DEFAULT_LAYOUT_SETTINGS.split, ...savedLayoutSettings.split },
            };
          }

          // Don't reset playback position, selection, viewport, or history
        });
      } catch (err) {
        console.error('Failed to reload visuals:', err);
      }
    },

    refreshMediaUrls: async (projectId: string) => {
      // Lightweight refresh: only update presigned video/audio URLs without
      // touching tracks, items, layout, or playback state. Prevents videos
      // from vanishing when presigned URLs expire during long editing sessions.
      try {
        const apiProject = await api.getProject(projectId);
        const videoUrl = (apiProject as any).videoPresignedUrl
          || (apiProject.videoKey ? `${API_URL}/api/projects/${projectId}/video` : '');
        const audioUrl = (apiProject as any).audioPresignedUrl
          || (apiProject.audioKey ? `${API_URL}/api/projects/${projectId}/audio` : '');

        set((state) => {
          if (state.project) {
            state.project.videoUrl = videoUrl;
            state.project.audioUrl = audioUrl;
          }
          // Update src on video and audio items so <Video>/<Audio> elements pick up fresh URLs
          for (const id of state.itemIds) {
            const item = state.items[id];
            if (!item) continue;
            if (item.type === 'video' && videoUrl) {
              (item.data as any).src = videoUrl;
            } else if (item.type === 'audio') {
              const audioData = item.data as any;
              // Only refresh items that use the project video/audio as source
              if (audioData.src?.includes('/api/projects/') || audioData.src?.includes('X-Amz-')) {
                audioData.src = audioData.src.includes('/video') ? videoUrl : audioUrl;
                if (audioData.originalSrc?.includes('/api/projects/') || audioData.originalSrc?.includes('X-Amz-')) {
                  audioData.originalSrc = audioData.originalSrc.includes('/video') ? videoUrl : audioUrl;
                }
              }
            }
          }
        });
      } catch (err) {
        console.warn('Failed to refresh media URLs:', err);
      }
    },

    saveProject: async () => {
      const { project, items, itemIds, layoutSettings, layoutPresetId } = get();
      if (!project) return;

      set((state) => {
        state.isSaving = true;
      });

      try {
        // Convert items back to API format — include trackId and type for new items (split/merge)
        const apiItems = itemIds
          .map((id) => items[id])
          .filter((item): item is TimelineItem => !!item && item.type === 'caption')
          .map((item) => {
            const data = item.data as CaptionItemData;
            return {
              id: item.id,
              trackId: item.trackId,
              type: 'subtitle' as const, // DB type is 'subtitle' (editor uses 'caption' internally)
              startMs: item.startMs,
              endMs: item.endMs,
              data: {
                text: data.text,
                words: data.words.map((w) => ({
                  text: w.text,
                  startMs: Math.round(w.startMs + item.startMs), // Convert back to absolute time
                  endMs: Math.round(w.endMs + item.startMs),
                  ...(w.styleOverrides ? { styleOverrides: w.styleOverrides } : {}),
                })),
                style: data.style,
                ...(data.styleOverrides ? { styleOverrides: data.styleOverrides } : {}),
                ...(data.aiWordOverrides ? { aiWordOverrides: data.aiWordOverrides } : {}),
              },
            };
          });

        // Also save visual items (displayMode, transition, timing changes)
        const visualItems = itemIds
          .map((id) => items[id])
          .filter((item): item is TimelineItem => !!item && item.type === 'visual')
          .map((item) => ({
            id: item.id,
            trackId: item.trackId,
            type: 'visual' as const,
            startMs: item.startMs,
            endMs: item.endMs,
            data: item.data as unknown as Record<string, unknown>,
          }));

        // Save video items (persists splits across reload)
        // Exclude src/previewUrl — those are regenerated from project.videoUrl on load
        const videoItems = itemIds
          .map((id) => items[id])
          .filter((item): item is TimelineItem => !!item && item.type === 'video')
          .map((item) => {
            const d = item.data as VideoItemData;
            return {
              id: item.id,
              trackId: item.trackId,
              type: 'video' as const,
              startMs: item.startMs,
              endMs: item.endMs,
              data: {
                width: d.width,
                height: d.height,
                volume: d.volume,
                playbackRate: d.playbackRate,
                muted: d.muted ?? false,
                separatedAudioItemId: d.separatedAudioItemId,
                ...(item.trim ? { trimStartMs: item.trim.startMs, trimEndMs: item.trim.endMs } : {}),
              },
            };
          });

        // Save audio items (persists splits across reload)
        // Exclude resolved URLs — those are regenerated from keys on load
        const audioItems = itemIds
          .map((id) => items[id])
          .filter((item): item is TimelineItem => !!item && item.type === 'audio')
          .map((item) => {
            const d = item.data as AudioItemData;
            return {
              id: item.id,
              trackId: item.trackId,
              type: 'audio' as const,
              startMs: item.startMs,
              endMs: item.endMs,
              data: {
                sourceVideoItemId: d.sourceVideoItemId,
                volume: d.volume,
                isEnhanced: d.isEnhanced,
                enhancementStatus: d.enhancementStatus,
                enhancementProgress: d.enhancementProgress,
              },
            };
          });

        // Round all timestamps to integers (DB uses integer columns)
        const allItems = [...apiItems, ...visualItems, ...videoItems, ...audioItems].map((item) => ({
          ...item,
          startMs: Math.round(item.startMs),
          endMs: Math.round(item.endMs),
        }));

        // Collect IDs per type — the API deletes DB items NOT in these lists
        const captionItemIds = apiItems.map((item) => item.id);
        const visualItemIds = visualItems.map((item) => item.id);
        const videoItemIds = videoItems.map((item) => item.id);
        const audioItemIds = audioItems.map((item) => item.id);

        // Persist layout settings inside videoSettings JSONB
        const videoSettingsPayload = {
          ...project.videoSettings,
          layoutSettings,
          layoutPresetId,
        };

        await api.updateProject(project.id, {
          items: allItems,
          captionItemIds,
          visualItemIds,
          videoItemIds,
          audioItemIds,
          videoSettings: videoSettingsPayload,
        });

        set((state) => {
          state.isSaving = false;
        });
      } catch (err) {
        console.error('[saveProject] Failed:', err);
        set((state) => {
          state.error = err instanceof Error ? err.message : 'Failed to save project';
          state.isSaving = false;
        });
        throw err; // Re-throw so callers (e.g., ExportModal) can detect save failures
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
          // Clean out undefined values — keep all WordStyleOverrides properties
          const cleaned: WordStyleOverrides = {};
          if (merged.color !== undefined) cleaned.color = merged.color;
          if (merged.activeColor !== undefined) cleaned.activeColor = merged.activeColor;
          if (merged.fontWeight !== undefined) cleaned.fontWeight = merged.fontWeight;
          if (merged.fontFamily !== undefined) cleaned.fontFamily = merged.fontFamily;
          if (merged.fontSize !== undefined) cleaned.fontSize = merged.fontSize;
          if (merged.scale !== undefined) cleaned.scale = merged.scale;
          if (merged.letterSpacing !== undefined) cleaned.letterSpacing = merged.letterSpacing;
          if (merged.textTransform !== undefined) cleaned.textTransform = merged.textTransform;
          if (merged.emphasisBg !== undefined) cleaned.emphasisBg = merged.emphasisBg;

          word.styleOverrides = Object.keys(cleaned).length > 0 ? cleaned : undefined;
        }
      });
      get().pushHistory();
      debouncedSave(() => get().saveProject());
    },

    setApplyStyleToAll: (value: boolean) => {
      set((state) => {
        state.applyStyleToAll = value;
      });
    },

    setShowCaptions: (value: boolean) => {
      set((state) => {
        state.showCaptions = value;
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
      const id = itemData.id || crypto.randomUUID();

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

      // Collect deleted ranges per track for ripple (gap closing)
      const deletedPerTrack = new Map<string, { startMs: number; endMs: number }[]>();
      for (const id of ids) {
        const item = items[id];
        if (!item) continue;
        const ranges = deletedPerTrack.get(item.trackId) || [];
        ranges.push({ startMs: item.startMs, endMs: item.endMs });
        deletedPerTrack.set(item.trackId, ranges);
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

        // Ripple: close gaps by shifting remaining items left on affected tracks
        for (const [trackId, ranges] of deletedPerTrack) {
          // Sort deleted ranges by startMs and merge overlapping
          ranges.sort((a, b) => a.startMs - b.startMs);
          const merged: { startMs: number; endMs: number }[] = [];
          for (const r of ranges) {
            const last = merged[merged.length - 1];
            if (last && r.startMs <= last.endMs) {
              last.endMs = Math.max(last.endMs, r.endMs);
            } else {
              merged.push({ ...r });
            }
          }

          // For each remaining item in this track, compute cumulative shift
          for (const itemId of state.itemIds) {
            const item = state.items[itemId];
            if (!item || item.trackId !== trackId) continue;

            let shift = 0;
            for (const gap of merged) {
              if (item.startMs >= gap.endMs) {
                shift += gap.endMs - gap.startMs;
              }
            }

            if (shift > 0) {
              item.startMs -= shift;
              item.endMs -= shift;
            }
          }
        }

        // Recalculate duration
        let maxEnd = 0;
        for (const itemId of state.itemIds) {
          const item = state.items[itemId];
          if (item && item.endMs > maxEnd) maxEnd = item.endMs;
        }
        state.duration = Math.max(maxEnd, 1000);
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

          // Add audio item with video source as audio
          const audioItem: TimelineItem = {
            id: audioItemId,
            type: 'audio',
            trackId: audioTrackId,
            startMs: videoItem.startMs,
            endMs: videoItem.endMs,
            data: {
              src: response.src,
              originalSrc: response.src,
              isEnhanced: false,
              sourceVideoItemId: videoItemId,
              volume: 1,
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

      // Capture pre-split info for visual items
      const isVisual = item.type === 'visual';
      const visualData = isVisual ? (item.data as VisualItemData) : null;

      let splitResult: [string, string] | null = null as [string, string] | null;

      set((state) => {
        const result = splitItemInDraft(state, itemId, atMs);
        if (result) {
          splitResult = result;
          if (isVisual) {
            state.regeneratingVisualItemIds.add(result[0]);
            state.regeneratingVisualItemIds.add(result[1]);
          }
        }
      });

      get().pushHistory();
      debouncedSave(() => get().saveProject());

      // Trigger AI regeneration for visual splits
      if (isVisual && splitResult && visualData?.sourceSceneId) {
        const [leftId, rightId] = splitResult;
        const projectId = get().project?.id;
        if (projectId) {
          api.splitVisualScene(projectId, {
            compositionId: visualData.compositionId,
            sourceSceneId: visualData.sourceSceneId,
            splitAtMs: atMs,
            leftItemId: leftId,
            rightItemId: rightId,
          }).then(({ jobId }) => {
            wsClient.subscribeToJob(jobId);
            set((state) => {
              state.splitJobToItems[jobId] = [leftId, rightId];
            });
          }).catch((err) => {
            console.error('[splitItem] Failed to trigger scene split:', err);
            set((state) => {
              state.regeneratingVisualItemIds.delete(leftId);
              state.regeneratingVisualItemIds.delete(rightId);
            });
          });
        }
      }
    },

    splitAllAtPlayhead: () => {
      const { currentTimeMs, items, itemIds } = get();

      // Find all items spanning the playhead with >100ms margin from edges
      const splittableIds: string[] = [];
      for (const id of itemIds) {
        const item = items[id];
        if (!item) continue;
        const relMs = currentTimeMs - item.startMs;
        const dur = item.endMs - item.startMs;
        if (relMs > 100 && relMs < dur - 100) {
          splittableIds.push(id);
        }
      }

      set((state) => {
        // Clear existing selection
        state.selectedIds = [];

        // Split all spanning items (splitItemInDraft selects right halves)
        for (const id of splittableIds) {
          splitItemInDraft(state, id, currentTimeMs);
        }

        // Also select any items that start at the playhead but weren't split
        // (e.g. items from a previous split that already start here)
        for (const id of state.itemIds) {
          const item = state.items[id];
          if (!item) continue;
          if (Math.abs(item.startMs - currentTimeMs) < 1 && !state.selectedIds.includes(id)) {
            state.selectedIds.push(id);
          }
        }
      });

      if (get().selectedIds.length > 0) {
        get().pushHistory();
        debouncedSave(() => get().saveProject());
      }
    },

    deleteTimeRange: async (startMs: number, endMs: number, ripple?: boolean) => {
      const { items, itemIds, project } = get();

      // Collect items to split at boundaries and items to delete
      const splitAtStart: string[] = [];
      const splitAtEnd: string[] = [];

      for (const id of itemIds) {
        const item = items[id];
        if (!item) continue;

        // Item spans the start boundary (starts before, ends after startMs)
        const relStart = startMs - item.startMs;
        const dur = item.endMs - item.startMs;
        if (relStart > 100 && relStart < dur - 100) {
          splitAtStart.push(id);
        }

        // Item spans the end boundary (starts before endMs, ends after)
        const relEnd = endMs - item.startMs;
        if (relEnd > 100 && relEnd < dur - 100) {
          splitAtEnd.push(id);
        }
      }

      let hasVisualItems = false;

      set((state) => {
        // 1. Split items at start boundary
        for (const id of splitAtStart) {
          if (state.items[id]) {
            splitItemInDraft(state, id, startMs);
          }
        }

        // 2. Split items at end boundary
        // After splitting at start, the original IDs are gone — scan for items spanning endMs
        const idsAfterStartSplit = [...state.itemIds];
        for (const id of idsAfterStartSplit) {
          const item = state.items[id];
          if (!item) continue;
          const rel = endMs - item.startMs;
          const dur = item.endMs - item.startMs;
          if (rel > 100 && rel < dur - 100) {
            splitItemInDraft(state, id, endMs);
          }
        }

        // 3. Delete all items fully within [startMs, endMs]
        const toDelete: string[] = [];
        for (const id of [...state.itemIds]) {
          const item = state.items[id];
          if (!item) continue;
          if (item.startMs >= startMs && item.endMs <= endMs) {
            toDelete.push(id);
          }
        }

        for (const id of toDelete) {
          const item = state.items[id];
          if (item?.type === 'visual') hasVisualItems = true;

          // Unlink audio↔video
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
          state.itemIds = state.itemIds.filter((iid) => iid !== id);
          state.selectedIds = state.selectedIds.filter((sid) => sid !== id);
        }

        // 4. Ripple: shift items starting at endMs+ left by gap duration
        if (ripple) {
          const gap = endMs - startMs;
          for (const id of state.itemIds) {
            const item = state.items[id];
            if (!item) continue;
            if (item.startMs >= endMs) {
              item.startMs -= gap;
              item.endMs -= gap;
            }
          }
        }

        // 5. Clear selected time range
        state.selectedTimeRange = null;
      });

      get().pushHistory();

      // Delete visuals from backend if needed
      if (hasVisualItems && project) {
        try {
          await api.deleteVisuals(project.id);
        } catch (err) {
          console.error('Failed to delete visuals from backend:', err);
        }
      }

      await get().saveProject();
    },

    setSplitMode: (active: boolean) => {
      set((state) => {
        state.splitMode = active;
      });
    },

    clearRegeneratingItems: (itemIds: string[]) => {
      set((state) => {
        for (const id of itemIds) {
          state.regeneratingVisualItemIds.delete(id);
        }
      });
    },

    removeSplitJob: (jobId: string) => {
      set((state) => {
        delete state.splitJobToItems[jobId];
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
          const newId = crypto.randomUUID();
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
          const newId = crypto.randomUUID();

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

        const leftId = crypto.randomUUID();
        const rightId = crypto.randomUUID();

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
      debouncedSave(() => get().saveProject());
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

        const mergedId = crypto.randomUUID();
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
      debouncedSave(() => get().saveProject());
    },

    updateCaptionText: (captionId: string, newText: string) => {
      set((state) => {
        const item = state.items[captionId];
        if (!item || item.type !== 'caption') return;

        const data = item.data as CaptionItemData;
        const oldWords = data.words;
        data.text = newText;

        // Rebuild words array so preview reflects the edit
        const newTokens = newText.split(/\s+/).filter(Boolean);
        if (newTokens.length === 0) {
          data.words = [];
          return;
        }

        if (newTokens.length === oldWords.length) {
          // Same word count: keep timings and overrides, just update text
          for (let i = 0; i < newTokens.length; i++) {
            oldWords[i].text = newTokens[i];
          }
        } else {
          // Word count changed: redistribute timing evenly
          const totalDuration =
            oldWords.length > 0
              ? oldWords[oldWords.length - 1].endMs
              : item.endMs - item.startMs;
          const perWord = totalDuration / newTokens.length;
          data.words = newTokens.map((token, i) => ({
            text: token,
            startMs: Math.round(i * perWord),
            endMs: Math.round((i + 1) * perWord),
          }));
        }
      });

      get().pushHistory();
      debouncedSave(() => get().saveProject());
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

    updatePiPCrop: (crop: Partial<PiPCrop>) => {
      set((state) => {
        state.layoutSettings.pip.crop = {
          ...state.layoutSettings.pip.crop,
          ...crop,
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

    setInspectModeEnabled: (enabled: boolean) => {
      set((state) => {
        state.inspectModeEnabled = enabled;
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

    setPendingAIMessage: (message: string | null) => {
      set((state) => {
        state.pendingAIMessage = message;
      });
    },

    changeDisplayModeWithAI: (itemId: string, newDisplayMode: VisualDisplayMode) => {
      const state = get();
      const item = state.items[itemId];
      if (!item || item.type !== 'visual') return;

      const data = item.data as VisualItemData;
      const oldDisplayMode = data.displayMode || 'default';
      if (oldDisplayMode === newDisplayMode) return;

      const canvasWidth = state.project?.videoSettings.canvasWidth || 1080;
      const canvasHeight = state.project?.videoSettings.canvasHeight || 1920;
      const layoutMode = state.layoutSettings.mode;
      const splitRatio = state.layoutSettings.split.ratio;
      const splitGap = state.layoutSettings.split.gap;

      // Compute effective dimensions for a given display mode
      const getEffectiveDims = (dm: VisualDisplayMode) => {
        if (dm === 'fullscreen' || dm === 'overlay') {
          return { w: canvasWidth, h: canvasHeight };
        }
        // 'default' mode depends on layout
        if (layoutMode === 'pip') {
          return { w: canvasWidth, h: canvasHeight };
        }
        // stacked mode
        const visualH = Math.max(1, Math.round(canvasHeight * splitRatio / 100 - splitGap / 2));
        return { w: canvasWidth, h: visualH };
      };

      const oldDims = getEffectiveDims(oldDisplayMode);
      const newDims = getEffectiveDims(newDisplayMode);

      // Capture timing before mutating state
      const { startMs, endMs } = item;

      // Apply the display mode change immediately
      get().updateVisualDisplayMode(itemId, newDisplayMode);

      // Build human-readable mode labels
      const modeLabel = (dm: VisualDisplayMode): string => {
        if (dm === 'default') {
          return layoutMode === 'pip' ? 'Standard (PiP)' : 'Standard (stacked)';
        }
        return dm === 'fullscreen' ? 'Fullscreen' : 'Overlay';
      };

      // Build mode-specific guidance suffix
      let suffix = '';
      if (newDisplayMode === 'fullscreen') {
        suffix = 'Since this is now fullscreen mode, the visual takes up the entire canvas with no speaker video visible.';
      } else if (newDisplayMode === 'overlay') {
        suffix = "Since this is now overlay mode, the visual will be composited over the speaker video with reduced opacity \u2014 position elements to avoid the center where the speaker's face is.";
      } else {
        suffix = `Since this is now standard mode, the visual occupies ${newDims.w}\u00d7${newDims.h} alongside the speaker video in ${layoutMode} layout.`;
      }

      const prompt = `The display mode for this scene was changed from "${modeLabel(oldDisplayMode)}" to "${modeLabel(newDisplayMode)}". The effective viewport changed from ${oldDims.w}\u00d7${oldDims.h} to ${newDims.w}\u00d7${newDims.h}. Please adapt the scene's layout, sizing, and positioning to properly fill the new ${newDims.w}\u00d7${newDims.h} viewport. ${suffix}`;

      // Scope the AI edit to this item's time range
      // Note: pendingAIMessage uses last-write-wins — if the user triggers another
      // adapt while streaming, the latest one supersedes the previous (intentional UX).
      set((state) => {
        state.selectedTimeRange = { startMs, endMs };
        state.selectedSceneId = null;
        state.pendingAIMessage = prompt;
      });
    },

    // ========================================
    // Visual Display Mode Actions
    // ========================================

    updateVisualDisplayMode: (itemId: string, displayMode: VisualDisplayMode) => {
      set((state) => {
        const item = state.items[itemId];
        if (item?.type === 'visual') {
          (item.data as VisualItemData).displayMode = displayMode;
        }
      });
      get().pushHistory();
      debouncedSave(() => get().saveProject());
    },

    updateOverlayOpacity: (itemId: string, opacity: number) => {
      set((state) => {
        const item = state.items[itemId];
        if (item?.type === 'visual') {
          (item.data as VisualItemData).overlayOpacity = opacity;
        }
      });
      get().pushHistory();
      debouncedSave(() => get().saveProject());
    },

    updateVisualTransition: (itemId: string, transition: VisualItemData['transition']) => {
      set((state) => {
        const item = state.items[itemId];
        if (item?.type === 'visual') {
          (item.data as VisualItemData).transition = transition;
        }
      });
      get().pushHistory();
      debouncedSave(() => get().saveProject());
    },

    openTransitionPicker: (itemId: string) => {
      set((state) => { state.transitionPickerItemId = itemId; });
    },

    closeTransitionPicker: () => {
      set((state) => { state.transitionPickerItemId = null; });
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
