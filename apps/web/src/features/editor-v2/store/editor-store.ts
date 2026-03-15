/**
 * Editor V2 Zustand Store
 * Main state management with immer for immutable updates
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { api, Project as ApiProject } from '@/lib/api';
import { wsClient } from '@/lib/ws';
import { loadFont, findFont } from '@/lib/font-registry';
import { manifestToStore, storeToManifest, StoreManifestOp } from './manifest-bridge';
import { dispatchToSandbox, type SandboxOp } from './manifest-dispatch';
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
  CaptionWord,
  VideoItemData,
  AudioItemData,
  VisualItemData,
  VisualDisplayMode,
  VideoSettings,
  CaptionStyle,
  AnimationConfig,
  WordStyleOverrides,
  OverlayZone,
  Transform,
  Keyframe,
  Filters,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Debounce utility for auto-save
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
const debouncedSave = (saveFn: () => Promise<void>, delay = 1000) => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    saveFn().catch((err) => console.error('[debouncedSave] save FAILED:', err));
    saveTimeout = null;
  }, delay);
};
const cancelDebouncedSave = () => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
};

/** Dispatch a manifest operation to the workspace if active, otherwise no-op (legacy save handles it) */
const dispatchManifestOp = async (op: StoreManifestOp): Promise<void> => {
  const state = useEditorStore.getState();
  if (state.workspaceStatus !== 'active' || !state.project) {
    return;
  }

  try {
    await api.applyManifestOp(state.project.id, op as any);
    // Clear any previous sync error on success
    if (useEditorStore.getState().manifestSyncError) {
      useEditorStore.setState({ manifestSyncError: null });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to sync edit';
    console.error('Failed to apply manifest op:', err);
    useEditorStore.setState({ manifestSyncError: message });
  }
};

/** Fire-and-forget dispatch of sandbox ops (POST /ops). No-op if sandbox not active. */
const dispatchOps = (ops: SandboxOp[]) => {
  const state = useEditorStore.getState();
  if (state.workspaceStatus !== 'active' || !state.project) return;
  dispatchToSandbox(state.project.id, ops);
};

/**
 * Rebuild workspaceManifest from current store state so the Remotion player
 * reflects local edits (shape props, transforms, filters, added/removed items).
 */
const syncWorkspaceManifest = () => {
  const state = useEditorStore.getState();
  if (!state.project) return;

  // Extract caption style from first caption item, or use default
  const firstCaption = state.itemIds
    .map((id) => state.items[id])
    .find((item) => item?.type === 'caption');
  const captionStyle = firstCaption
    ? (firstCaption.data as CaptionItemData).style ?? DEFAULT_CAPTION_STYLE
    : DEFAULT_CAPTION_STYLE;

  const manifest = storeToManifest(
    {
      tracks: state.tracks,
      items: state.items,
      itemIds: state.itemIds,
      duration: state.duration,
      fps: state.fps,
      videoSettings: state.project.videoSettings,
      assets: state.assets,
    },
    captionStyle,
  );

  useEditorStore.setState({ workspaceManifest: manifest });
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
  assets: {},

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
  isDirty: false,

  // Workspace state (Plan 3)
  workspaceStatus: 'inactive' as const,
  workspaceBundleUrl: null,
  workspaceBundleVersion: 0,
  workspaceLockHolder: null,
  workspaceBundleError: null,
  workspaceManifest: null,
  manifestSyncError: null,

  // Caption style toggle
  applyStyleToAll: false,

  // Caption visibility in player
  showCaptions: true,

  // Clipboard and split mode
  clipboard: null,
  splitMode: false,

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

  // Sandbox state
  sandboxStatus: 'inactive' as const,
  sandboxPreviewUrl: null,
  sandboxBundleVersion: 0,

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
  video: 80,
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
  console.log('[convertApiProject] Video loading debug:', {
    isAudioProject,
    hasVideoKey: !!project.videoKey,
    hasVideoUrl: !!project.videoUrl,
    durationMs: project.durationMs,
    dbVideoItemCount: dbVideoItems.length,
    dbVideoItems: dbVideoItems.map((i: any) => ({
      id: i.id,
      startMs: i.startMs,
      endMs: i.endMs,
      trimStartMs: (i.data as any)?.trimStartMs,
      trimEndMs: (i.data as any)?.trimEndMs,
    })),
  });
  if (!isAudioProject && project.videoKey && project.videoUrl) {
    const videoTrack = tracks.find((t) => t.type === 'video');
    if (videoTrack) {
      // Fix stale DB video items: if all video items have zero duration but the
      // project now has a valid durationMs, discard the stale DB items and fall
      // through to the synthetic path.  This happens when the editor saved before
      // the transcription worker had set durationMs.
      const allZeroDuration = dbVideoItems.length > 0 &&
        dbVideoItems.every((i: any) => i.endMs <= i.startMs);
      const useDbItems = dbVideoItems.length > 0 && !(allZeroDuration && project.durationMs > 0);
      if (allZeroDuration && project.durationMs > 0) {
        console.warn('[convertApiProject] Discarding stale zero-duration DB video items, using synthetic item with durationMs:', project.durationMs);
      }

      if (useDbItems) {
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
              thumbnailSrc: `/media-proxy/projects/${apiProject.id}/video`,
            } as VideoItemData,
          };
          // Only set trim if explicit trim data was saved — avoid defaulting to
          // timeline position which can produce {0,0} if item was saved before
          // durationMs was available
          if (raw.trimStartMs != null || raw.trimEndMs != null) {
            videoItem.trim = {
              startMs: (raw.trimStartMs as number) ?? item.startMs,
              endMs: (raw.trimEndMs as number) ?? item.endMs,
            };
          }
          console.log('[convertApiProject] DB video item:', {
            id: item.id,
            startMs: item.startMs,
            endMs: item.endMs,
            rawTrimStart: raw.trimStartMs,
            rawTrimEnd: raw.trimEndMs,
            resultTrim: videoItem.trim,
          });
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
            thumbnailSrc: `/media-proxy/projects/${apiProject.id}/video`,
          } as VideoItemData,
        };
        console.log('[convertApiProject] Synthetic video item:', {
          id: videoId,
          startMs: 0,
          endMs: project.durationMs,
        });
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

        // --- Sandbox path (replaces workspace) ---
        const loadFromSandbox = async (): Promise<any> => {
          // Ensure sandbox is running first (idempotent — returns immediately if active)
          const sandboxResult = await api.createSandbox(projectId);

          if (sandboxResult.status !== 'ready') {
            // Poll until ready
            for (let i = 0; i < 60; i++) {
              await new Promise(r => setTimeout(r, 2000));
              const status = await api.getSandboxStatus(projectId);
              if (status.status === 'ready') break;
              if (i === 59) throw new Error('Sandbox failed to start');
            }
          }

          return await api.readSandboxManifest(projectId);
        };

        const manifest = await loadFromSandbox();
        const bundleBaseUrl = api.getSandboxBundleUrl(projectId);

        const bridgeResult = manifestToStore(manifest, {
          videoUrl,
          bundleUrl: bundleBaseUrl,
          compositionId: (apiProject as any).compositionId ?? '',
          visualMeta: (apiProject as any).visualMeta,
        });

        // Set same-origin thumbnailSrc on video items for timeline thumbnail extraction
        for (const itemId of bridgeResult.itemIds) {
          const item = bridgeResult.items[itemId];
          if (item?.type === 'video') {
            (item.data as VideoItemData).thumbnailSrc = `/media-proxy/projects/${projectId}/video`;
          }
        }

        const project = {
          id: apiProject.id,
          title: apiProject.title,
          status: apiProject.status,
          projectType: apiProject.projectType,
          videoKey: apiProject.videoKey,
          audioKey: (apiProject as any).audioKey,
          videoUrl,
          audioUrl: (apiProject as any).audioPresignedUrl || null,
          outputKey: apiProject.outputKey,
          durationMs: bridgeResult.duration,
          fps: bridgeResult.fps,
          sourceWidth: apiProject.width,
          sourceHeight: apiProject.height,
          videoSettings: bridgeResult.videoSettings,
        };

        set((state) => {
          state.project = project;
          state.tracks = bridgeResult.tracks;
          state.items = bridgeResult.items;
          state.itemIds = bridgeResult.itemIds;
          state.duration = bridgeResult.duration;
          state.fps = bridgeResult.fps;
          state.isLoading = false;
          state.currentTimeMs = 0;
          state.selectedIds = [];
          state.sandboxStatus = 'ready';
          state.sandboxPreviewUrl = `${bundleBaseUrl}/player-composition.cjs.js`;
          state.sandboxBundleVersion = 1;
          // Set workspace fields too — existing components (Player, useWorkspaceComposition) read these
          state.workspaceStatus = 'active';
          state.workspaceBundleUrl = bundleBaseUrl;
          state.workspaceBundleVersion = 1;
          state.workspaceBundleError = null;
          state.workspaceManifest = manifest as Record<string, unknown>;
          state.workspaceLockHolder = null;
          state.viewport = { zoom: DEFAULT_ZOOM, scrollX: 0, scrollY: 0 };
          state.history = [];
          state.historyIndex = -1;
          state.isDirty = false;
        });

        get().pushHistory();
        cancelDebouncedSave();
        set((state) => { state.isDirty = false; });

        // Poll for bundle readiness (handles race where bundle:ready WS event fires
        // before the frontend WebSocket connects)
        {
          const pollBundle = async () => {
            for (let i = 0; i < 30; i++) {
              await new Promise(r => setTimeout(r, 2000));
              if (get().workspaceBundleVersion > 1) return; // WS event arrived
              try {
                const res = await fetch(`${API_URL}${bundleBaseUrl}/player-composition.cjs.js`, {
                  method: 'HEAD',
                  credentials: 'include',
                });
                if (res.ok) {
                  set((state) => { state.workspaceBundleVersion = 2; });
                  return;
                }
              } catch { /* retry */ }
            }
          };
          pollBundle();
        }

        // Auto-load caption fonts
        const captionFonts = new Set<string>();
        for (const id of bridgeResult.itemIds) {
          const item = bridgeResult.items[id];
          if (item?.type === 'caption') {
            const fontFamily = (item.data as CaptionItemData).style?.fontFamily;
            if (fontFamily) captionFonts.add(fontFamily.split(',')[0].trim());
          }
        }
        for (const family of captionFonts) {
          const entry = findFont(family);
          if (entry) loadFont(entry);
        }
        // --- End sandbox path ---
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
              (item.data as any).thumbnailSrc = `/media-proxy/projects/${projectId}/video`;
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
      const { project, items, itemIds } = get();
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
              ...(item.transform ? { transform: item.transform } : {}),
              ...(item.filters ? { filters: item.filters } : {}),
              ...(item.keyframes?.length ? { keyframes: item.keyframes } : {}),
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
            ...(item.transform ? { transform: item.transform } : {}),
            ...(item.filters ? { filters: item.filters } : {}),
            ...(item.keyframes?.length ? { keyframes: item.keyframes } : {}),
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
              ...(item.transform ? { transform: item.transform } : {}),
              ...(item.filters ? { filters: item.filters } : {}),
              ...(item.keyframes?.length ? { keyframes: item.keyframes } : {}),
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
              ...(item.transform ? { transform: item.transform } : {}),
              ...(item.filters ? { filters: item.filters } : {}),
              ...(item.keyframes?.length ? { keyframes: item.keyframes } : {}),
            };
          });

        // Save shape, text, and image items
        const overlayItems = itemIds
          .map((id) => items[id])
          .filter((item): item is TimelineItem => !!item && ['shape', 'text', 'image'].includes(item.type))
          .map((item) => ({
            id: item.id,
            trackId: item.trackId,
            type: item.type,
            startMs: item.startMs,
            endMs: item.endMs,
            data: item.data as unknown as Record<string, unknown>,
            ...(item.transform ? { transform: item.transform } : {}),
            ...(item.filters ? { filters: item.filters } : {}),
            ...(item.keyframes?.length ? { keyframes: item.keyframes } : {}),
          }));

        // Round all timestamps to integers (DB uses integer columns)
        const allItems = [...apiItems, ...visualItems, ...videoItems, ...audioItems, ...overlayItems].map((item) => ({
          ...item,
          startMs: Math.round(item.startMs),
          endMs: Math.round(item.endMs),
        }));

        // Collect IDs per type — the API deletes DB items NOT in these lists
        const captionItemIds = apiItems.map((item) => item.id);
        const visualItemIds = visualItems.map((item) => item.id);
        const videoItemIds = videoItems.map((item) => item.id);
        const audioItemIds = audioItems.map((item) => item.id);
        const videoSettingsPayload = {
          ...project.videoSettings,
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
          state.isDirty = false;
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
      dispatchManifestOp({ op: 'update_video_settings', updates: { ...settings } });
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
      dispatchManifestOp({ op: 'update_caption_style', updates: { ...styleUpdates } });
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
      // Dispatch updateItem for each caption with updated data
      const state = get();
      const ops: SandboxOp[] = [];
      for (const id of ids) {
        const item = state.items[id];
        if (item?.type === 'caption') {
          ops.push({ tool: 'updateItem', input: { itemId: id, data: item.data } });
        }
      }
      if (ops.length > 0) dispatchOps(ops);
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
      const updatedItem = get().items[captionId];
      if (updatedItem) {
        dispatchOps([{ tool: 'updateItem', input: { itemId: captionId, data: updatedItem.data } }]);
      }
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
          ...(itemData.transform ? { transform: itemData.transform } : {}),
          ...(itemData.keyframes ? { keyframes: itemData.keyframes } : {}),
          ...(itemData.filters ? { filters: itemData.filters } : {}),
        } as TimelineItem;

        state.items[id] = newItem;
        state.itemIds.push(id);
      });

      get().pushHistory();

      const addedItem = get().items[id];
      if (addedItem) {
        const input: Record<string, unknown> = { id, trackId, type: addedItem.type, startMs: addedItem.startMs, endMs: addedItem.endMs, data: addedItem.data };
        if (addedItem.transform) input.transform = addedItem.transform;
        if (addedItem.keyframes) input.keyframes = addedItem.keyframes;
        if (addedItem.filters) input.filters = addedItem.filters;
        dispatchOps([{ tool: 'addItem', input }]);
      }

      syncWorkspaceManifest();
      return id;
    },

    updateItem: (id, updates) => {
      set((state) => {
        const item = state.items[id];
        if (!item) return;

        Object.assign(item, updates);
      });

      get().pushHistory();

      // Build sandbox update payload from relevant keys
      const sandboxUpdates: Record<string, unknown> = { itemId: id };
      if (updates.startMs !== undefined) sandboxUpdates.startMs = updates.startMs;
      if (updates.endMs !== undefined) sandboxUpdates.endMs = updates.endMs;
      if (updates.trackId !== undefined) sandboxUpdates.trackId = updates.trackId;
      if (updates.transform !== undefined) sandboxUpdates.transform = updates.transform;
      if (updates.filters !== undefined) sandboxUpdates.filters = updates.filters;
      if (updates.keyframes !== undefined) sandboxUpdates.keyframes = updates.keyframes;
      if (updates.data !== undefined) sandboxUpdates.data = updates.data;
      if (Object.keys(sandboxUpdates).length > 1) {
        dispatchOps([{ tool: 'updateItem', input: sandboxUpdates }]);
      }
      syncWorkspaceManifest();
    },

    updateItemData: (id, dataUpdates) => {
      set((state) => {
        const item = state.items[id];
        if (!item) return;

        Object.assign(item.data, dataUpdates);
      });

      get().pushHistory();
      dispatchOps([{ tool: 'updateItem', input: { itemId: id, data: dataUpdates } }]);
      syncWorkspaceManifest();
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
      // Cancel the debounced save from pushHistory — we save immediately below
      cancelDebouncedSave();

      dispatchOps(ids.map(id => ({ tool: 'removeItem' as const, input: { itemId: id } })));
      syncWorkspaceManifest();

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
      const item = get().items[id];
      const duration = item ? item.endMs - item.startMs : 0;

      set((state) => {
        const stateItem = state.items[id];
        if (!stateItem) return;

        stateItem.trackId = trackId;
        stateItem.startMs = Math.max(0, startMs);
        stateItem.endMs = stateItem.startMs + (stateItem.endMs - stateItem.startMs > 0 ? duration : 0);
      });

      get().pushHistory();
      const movedItem = get().items[id];
      if (movedItem) {
        dispatchOps([{ tool: 'updateItem', input: { itemId: id, trackId, startMs: movedItem.startMs, endMs: movedItem.endMs } }]);
      }
      syncWorkspaceManifest();
    },

    resizeItem: (id, startMs, endMs) => {
      set((state) => {
        const item = state.items[id];
        if (!item) return;

        item.startMs = Math.max(0, startMs);
        item.endMs = Math.max(item.startMs + 100, endMs); // Minimum 100ms duration
      });

      get().pushHistory();
      const resizedItem = get().items[id];
      if (resizedItem) {
        dispatchOps([{ tool: 'updateItem', input: { itemId: id, startMs: resizedItem.startMs, endMs: resizedItem.endMs } }]);
      }
      syncWorkspaceManifest();
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
        state.isDirty = true;
      });

      debouncedSave(() => get().saveProject());
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
        state.isDirty = true;
      });

      debouncedSave(() => get().saveProject());
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

        state.isDirty = true;
      });

      debouncedSave(() => get().saveProject());
    },

    // ========================================
    // Track Actions
    // ========================================

    addTrack: (trackData) => {
      const id = trackData.id || crypto.randomUUID();

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
      dispatchOps([{ tool: 'addTrack', input: { type: trackData.type || 'overlay', name: trackData.name || 'New Track' } }]);
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
      dispatchOps([{ tool: 'updateTrack', input: { trackId: id, ...updates } }]);
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
      dispatchOps([{ tool: 'removeTrack', input: { trackId: id } }]);
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
      dispatchOps(trackIds.map((id, i) => ({ tool: 'updateTrack' as const, input: { trackId: id, position: i } })));
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

      if (splitResult) {
        if (item.type === 'video') {
          // Video items: use splitVideo tool
          dispatchOps([{ tool: 'splitVideo', input: { itemId, atMs } }]);
        } else {
          // Non-video: remove original + add left/right
          const [leftId, rightId] = splitResult;
          const leftItem = get().items[leftId];
          const rightItem = get().items[rightId];
          const ops: SandboxOp[] = [{ tool: 'removeItem', input: { itemId } }];
          if (leftItem) {
            ops.push({ tool: 'addItem', input: { id: leftId, trackId: leftItem.trackId, type: leftItem.type, startMs: leftItem.startMs, endMs: leftItem.endMs, data: leftItem.data } });
          }
          if (rightItem) {
            ops.push({ tool: 'addItem', input: { id: rightId, trackId: rightItem.trackId, type: rightItem.type, startMs: rightItem.startMs, endMs: rightItem.endMs, data: rightItem.data } });
          }
          dispatchOps(ops);
        }
      }

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
      // Cancel the debounced save from pushHistory — we save immediately below
      cancelDebouncedSave();

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
      // Dispatch addItem for each pasted item
      const pasteOps: SandboxOp[] = [];
      for (const newId of get().selectedIds) {
        const item = get().items[newId];
        if (item) {
          pasteOps.push({ tool: 'addItem', input: { id: newId, trackId: item.trackId, type: item.type, startMs: item.startMs, endMs: item.endMs, data: item.data } });
        }
      }
      if (pasteOps.length > 0) dispatchOps(pasteOps);
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
      // Dispatch addItem for each duplicated item
      const dupOps: SandboxOp[] = [];
      for (const newId of get().selectedIds) {
        const item = get().items[newId];
        if (item) {
          dupOps.push({ tool: 'addItem', input: { id: newId, trackId: item.trackId, type: item.type, startMs: item.startMs, endMs: item.endMs, data: item.data } });
        }
      }
      if (dupOps.length > 0) dispatchOps(dupOps);
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
      const nudgeOps: SandboxOp[] = [];
      for (const id of ids) {
        const item = get().items[id];
        if (item) {
          nudgeOps.push({ tool: 'updateItem', input: { itemId: id, startMs: item.startMs, endMs: item.endMs } });
        }
      }
      if (nudgeOps.length > 0) dispatchOps(nudgeOps);
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
      const trimOps: SandboxOp[] = [];
      for (const id of ids) {
        const item = get().items[id];
        if (item) {
          trimOps.push({ tool: 'updateItem', input: { itemId: id, startMs: item.startMs, endMs: item.endMs } });
        }
      }
      if (trimOps.length > 0) dispatchOps(trimOps);
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
      // Dispatch removeItem + 2x addItem for the split caption
      const splitOps: SandboxOp[] = [{ tool: 'removeItem', input: { itemId: captionId } }];
      // Find the two new caption items (most recently added to itemIds)
      const currentState = get();
      for (const id of currentState.itemIds) {
        const itm = currentState.items[id];
        if (itm && itm.type === 'caption' && itm.trackId === item.trackId) {
          // Check if this is one of the new items (not the original)
          if (id !== captionId && itm.startMs >= item.startMs && itm.endMs <= item.endMs) {
            splitOps.push({ tool: 'addItem', input: { id, trackId: itm.trackId, type: itm.type, startMs: itm.startMs, endMs: itm.endMs, data: itm.data } });
          }
        }
      }
      dispatchOps(splitOps);
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
      // Find the merged item (most recently added)
      const mergeOps: SandboxOp[] = [
        { tool: 'removeItem', input: { itemId: first.id } },
        { tool: 'removeItem', input: { itemId: second.id } },
      ];
      // The merged item is the last added to itemIds
      const mergeState = get();
      const lastId = mergeState.itemIds[mergeState.itemIds.length - 1];
      const mergedItem = mergeState.items[lastId];
      if (mergedItem) {
        mergeOps.push({ tool: 'addItem', input: { id: lastId, trackId: mergedItem.trackId, type: mergedItem.type, startMs: mergedItem.startMs, endMs: mergedItem.endMs, data: mergedItem.data } });
      }
      dispatchOps(mergeOps);
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
      const captionItem = get().items[captionId];
      if (captionItem) {
        dispatchOps([{ tool: 'updateItem', input: { itemId: captionId, data: captionItem.data } }]);
      }
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

      const canvasW = state.project?.videoSettings?.canvasWidth || 1080;
      const canvasH = state.project?.videoSettings?.canvasHeight || 1920;
      const newDims = { w: canvasW, h: canvasH };
      const oldDims = { w: canvasW, h: canvasH };

      // Capture timing before mutating state
      const { startMs, endMs } = item;

      // Apply the display mode change immediately (inline — updateVisualDisplayMode removed in v2)
      set((state) => {
        const stateItem = state.items[itemId];
        if (stateItem?.type === 'visual') {
          (stateItem.data as VisualItemData).displayMode = newDisplayMode;
        }
      });
      get().pushHistory();

      // Build human-readable mode labels
      const modeLabel = (dm: VisualDisplayMode): string => {
        if (dm === 'default') return 'Standard';
        return dm === 'fullscreen' ? 'Fullscreen' : 'Overlay';
      };

      // Build mode-specific guidance suffix
      let suffix = '';
      if (newDisplayMode === 'fullscreen') {
        suffix = 'Since this is now fullscreen mode, the visual takes up the entire canvas with no speaker video visible.';
      } else if (newDisplayMode === 'overlay') {
        suffix = "Since this is now overlay mode, the visual will be composited over the speaker video with reduced opacity \u2014 position elements to avoid the center where the speaker's face is.";
      } else {
        suffix = `Since this is now standard mode, the visual occupies ${newDims.w}\u00d7${newDims.h} alongside the speaker video.`;
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

    // V2: updateVisualDisplayMode, updateVisualTransition removed — display mode and transitions are in AI-generated Composition.tsx

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

    // ========================================
    // Overlay Zone Actions
    // ========================================

    updateVisualOverlayZone: (itemId: string, zone: OverlayZone) => {
      set((state) => {
        const item = state.items[itemId];
        if (!item || item.type !== 'visual') return state;

        const data = item.data as VisualItemData;
        state.items[itemId] = {
          ...item,
          data: {
            ...data,
            overlayZone: zone,
            // Clear deprecated displayMode when zone is set
            displayMode: zone === 'none' ? data.displayMode : undefined,
          },
        };
        state.isDirty = true;
      });
      get().pushHistory();
    },

    getVideoSegmentation: (videoItemId: string) => {
      const item = get().items[videoItemId];
      if (!item || item.type !== 'video') return undefined;
      return (item.data as VideoItemData).segmentation;
    },

    // ========================================
    // Workspace Actions (Plan 3)
    // ========================================

    setWorkspaceStatus: (status) => set((state) => { state.workspaceStatus = status; }),
    setWorkspaceBundleUrl: (url) => set((state) => { state.workspaceBundleUrl = url; }),
    incrementBundleVersion: () => set((state) => { state.workspaceBundleVersion += 1; }),
    setWorkspaceLockHolder: (holder) => set((state) => { state.workspaceLockHolder = holder; }),
    setWorkspaceBundleError: (error) => set((state) => { state.workspaceBundleError = error; }),

    applyRemoteManifestUpdate: async (manifest) => {
      const state = get();
      if (!state.project) return;

      // Preserve existing visual metadata from current store items
      const existingVideoItem = state.itemIds
        .map(id => state.items[id])
        .find(item => item?.type === 'video');
      const existingVisualItem = state.itemIds
        .map(id => state.items[id])
        .find(item => item?.type === 'visual');
      const existingVisualData = existingVisualItem?.data as VisualItemData | undefined;

      const bridgeResult = manifestToStore(manifest, {
        videoUrl: (existingVideoItem?.data as VideoItemData)?.src ?? '',
        bundleUrl: state.workspaceBundleUrl ?? '',
        compositionId: existingVisualData?.compositionId ?? '',
        visualMeta: undefined,
      });

      set((s) => {
        s.tracks = bridgeResult.tracks;
        s.items = bridgeResult.items;
        s.itemIds = bridgeResult.itemIds;
        s.duration = bridgeResult.duration;
      });

      // Also store the raw manifest
      set((state) => { state.workspaceManifest = manifest as Record<string, unknown>; });
    },

    // ========================================
    // Transform / Filters / Keyframes Actions (V2)
    // ========================================

    updateTransform: (itemId: string, transform: Partial<Transform>) => {
      set((draft) => {
        const item = draft.items[itemId];
        if (!item) return;
        item.transform = { ...(item.transform ?? { x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1 }), ...transform };
      });
      get().pushHistory();
      dispatchOps([{ tool: 'updateItem', input: { itemId, transform } }]);
      syncWorkspaceManifest();
    },

    updateFilters: (itemId: string, filters: Partial<Filters>) => {
      set((draft) => {
        const item = draft.items[itemId];
        if (!item) return;
        item.filters = { ...(item.filters ?? {}), ...filters };
      });
      get().pushHistory();
      dispatchOps([{ tool: 'updateItem', input: { itemId, filters } }]);
      syncWorkspaceManifest();
    },

    updateKeyframes: (itemId: string, keyframes: Keyframe[]) => {
      set((draft) => {
        const item = draft.items[itemId];
        if (!item) return;
        item.keyframes = keyframes;
      });
      get().pushHistory();
      dispatchOps([{ tool: 'updateItem', input: { itemId, keyframes } }]);
      syncWorkspaceManifest();
    },

    addKeyframeAtTime: (itemId: string, timeMs: number, props: Partial<Transform>, easing?: string) => {
      set((draft) => {
        const item = draft.items[itemId];
        if (!item) return;
        const kf: Keyframe = { timeMs, props, easing: (easing ?? 'linear') as Keyframe['easing'] };
        item.keyframes = [...(item.keyframes ?? []), kf].sort((a, b) => a.timeMs - b.timeMs);
      });
      get().pushHistory();
      const item = get().items[itemId];
      if (item) dispatchOps([{ tool: 'updateItem', input: { itemId, keyframes: item.keyframes } }]);
      syncWorkspaceManifest();
    },

    deleteKeyframe: (itemId: string, index: number) => {
      set((draft) => {
        const item = draft.items[itemId];
        if (!item?.keyframes) return;
        item.keyframes.splice(index, 1);
      });
      get().pushHistory();
      const item = get().items[itemId];
      if (item) dispatchOps([{ tool: 'updateItem', input: { itemId, keyframes: item.keyframes ?? [] } }]);
      syncWorkspaceManifest();
    },

    updateKeyframeEasing: (itemId: string, index: number, easing: string) => {
      set((draft) => {
        const item = draft.items[itemId];
        if (!item?.keyframes?.[index]) return;
        item.keyframes[index].easing = easing as Keyframe['easing'];
      });
      get().pushHistory();
      const item = get().items[itemId];
      if (item) dispatchOps([{ tool: 'updateItem', input: { itemId, keyframes: item.keyframes } }]);
    },

    // ========================================
    // Sandbox Actions
    // ========================================

    createSandbox: async (projectId: string) => {
      set({ sandboxStatus: 'creating' });
      try {
        const res = await fetch(`/api/projects/${projectId}/sandbox`, {
          method: 'POST',
          credentials: 'include',
        });
        const data = await res.json();
        if (data.status === 'ready') {
          set({
            sandboxStatus: 'ready',
            sandboxPreviewUrl: `/api/projects/${projectId}/sandbox/bundle/player-composition.cjs.js`,
          });
        }
      } catch (err) {
        console.error('Failed to create sandbox:', err);
        set({ sandboxStatus: 'inactive' });
      }
    },

    setSandboxStatus: (status) => {
      set({ sandboxStatus: status });
    },

    setSandboxBundleVersion: (version) => {
      set({ sandboxBundleVersion: version });
    },
  }))
);
