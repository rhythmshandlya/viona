'use client';

/**
 * Editor V2 Store Hooks and Selectors
 * Provides optimized selectors for components to subscribe to specific state slices
 */

import { useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from './editor-store';
import { TimelineItem, Track, VideoItemData, VideoSettings, CaptionStyle, CaptionItemData, LayoutSettings, LayoutPresetId, LayoutMode, SelectedElement, AIEditingContext, VisualItemData, SegmentationData } from './types';
import { migrateDisplayModeToZone } from '../utils/overlay-zones';

/**
 * Like useShallow but uses JSON.stringify for deep comparison.
 * Needed for selectors that create nested objects (where useShallow's
 * shallow comparison would always see new references).
 */
function useDeepSelector<S, U>(selector: (state: S) => U): (state: S) => U {
  const prev = useRef<U>(undefined as U);
  const prevJson = useRef<string>(undefined as unknown as string);
  return (state) => {
    const next = selector(state);
    const nextJson = JSON.stringify(next);
    if (nextJson === prevJson.current) {
      return prev.current as U;
    }
    prevJson.current = nextJson;
    prev.current = next;
    return next;
  };
}

// ============================================
// Direct Store Access
// ============================================

export { useEditorStore };

// ============================================
// Project Selectors
// ============================================

export function useProject() {
  return useEditorStore((state) => state.project);
}

export function useProjectId() {
  return useEditorStore((state) => state.project?.id);
}

export function useProjectType(): 'video' | 'audio' {
  return useEditorStore((state) => state.project?.projectType || 'video');
}

export function useIsAudioProject(): boolean {
  return useEditorStore((state) => state.project?.projectType === 'audio');
}

export function useIsLoading() {
  return useEditorStore((state) => state.isLoading);
}

export function useError() {
  return useEditorStore((state) => state.error);
}

export function useIsSaving() {
  return useEditorStore((state) => state.isSaving);
}

export function useIsDirty() {
  return useEditorStore((state) => state.isDirty);
}

// ============================================
// Video Settings Selectors
// ============================================

export function useVideoSettings(): VideoSettings | null {
  return useEditorStore((state) => state.project?.videoSettings ?? null);
}

export function useSourceDimensions(): { width: number; height: number } | null {
  const project = useEditorStore((state) => state.project);
  if (!project) return null;
  return { width: project.sourceWidth, height: project.sourceHeight };
}

// ============================================
// Caption Style Selectors
// ============================================

export function useFirstCaptionStyle(): CaptionStyle | null {
  return useEditorStore(
    useShallow((state) => {
      const captionId = state.itemIds.find((id) => state.items[id]?.type === 'caption');
      if (!captionId) return null;
      const caption = state.items[captionId];
      return (caption?.data as CaptionItemData)?.style || null;
    })
  );
}

// ============================================
// Timeline Selectors
// ============================================

export function useTracks() {
  return useEditorStore((state) => state.tracks);
}

export function useTrack(trackId: string): Track | undefined {
  return useEditorStore((state) => state.tracks.find((t) => t.id === trackId));
}

export function useItems() {
  return useEditorStore((state) => state.items);
}

export function useItemIds() {
  return useEditorStore((state) => state.itemIds);
}

export function useItem(itemId: string): TimelineItem | undefined {
  return useEditorStore((state) => state.items[itemId]);
}

export function useItemsOnTrack(trackId: string): TimelineItem[] {
  return useEditorStore(
    useShallow((state) =>
      state.itemIds
        .map((id) => state.items[id])
        .filter((item) => item && item.trackId === trackId)
    )
  );
}

export function useDuration() {
  return useEditorStore((state) => state.duration);
}

export function useFps() {
  return useEditorStore((state) => state.fps);
}

// ============================================
// Selection Selectors
// ============================================

export function useSelectedIds() {
  return useEditorStore((state) => state.selectedIds);
}

export function useIsSelected(itemId: string): boolean {
  return useEditorStore((state) => state.selectedIds.includes(itemId));
}

export function useSelectedItems(): TimelineItem[] {
  return useEditorStore(
    useShallow((state) =>
      state.selectedIds.map((id) => state.items[id]).filter(Boolean)
    )
  );
}

export function useSingleSelectedItem(): TimelineItem | null {
  return useEditorStore((state) => {
    if (state.selectedIds.length !== 1) return null;
    return state.items[state.selectedIds[0]] || null;
  });
}

export function useSelectionBox() {
  return useEditorStore((state) => state.selectionBox);
}

// ============================================
// Playback Selectors
// ============================================

export function useCurrentTimeMs() {
  return useEditorStore((state) => state.currentTimeMs);
}

export function useIsPlaying() {
  return useEditorStore((state) => state.isPlaying);
}

export function usePlaybackState() {
  return useEditorStore(
    useShallow((state) => ({
      currentTimeMs: state.currentTimeMs,
      isPlaying: state.isPlaying,
      duration: state.duration,
      fps: state.fps,
    }))
  );
}

// ============================================
// Viewport Selectors
// ============================================

export function useViewport() {
  return useEditorStore((state) => state.viewport);
}

export function useZoom() {
  return useEditorStore((state) => state.viewport.zoom);
}

export function useScrollX() {
  return useEditorStore((state) => state.viewport.scrollX);
}

export function useScrollY() {
  return useEditorStore((state) => state.viewport.scrollY);
}

// ============================================
// Drag State Selectors
// ============================================

export function useDragState() {
  return useEditorStore((state) => state.dragState);
}

export function useIsDragging() {
  return useEditorStore((state) => state.dragState !== null);
}

// ============================================
// History Selectors
// ============================================

export function useCanUndo() {
  return useEditorStore((state) => state.historyIndex > 0);
}

export function useCanRedo() {
  return useEditorStore((state) => state.historyIndex < state.history.length - 1);
}

// ============================================
// Clipboard & Split Mode Selectors
// ============================================

export const useClipboard = () => useEditorStore((s) => s.clipboard);
export const useSplitMode = () => useEditorStore((s) => s.splitMode);
export const useApplyStyleToAll = () => useEditorStore((s) => s.applyStyleToAll);
export const useShowCaptions = () => useEditorStore((s) => s.showCaptions);

// ============================================
// Layout Selectors
// ============================================

export function useLayoutSettings(): LayoutSettings {
  return useEditorStore((state) => state.layoutSettings);
}

export function useLayoutPresetId(): LayoutPresetId {
  return useEditorStore((state) => state.layoutPresetId);
}

export function useLayoutMode(): LayoutMode {
  return useEditorStore((state) => state.layoutSettings.mode);
}


export function useLayoutActions() {
  return useEditorStore(
    useShallow((state) => ({
      updateLayoutSettings: state.updateLayoutSettings,
      updatePiPSettings: state.updatePiPSettings,
      updatePiPCrop: state.updatePiPCrop,
      updateSplitSettings: state.updateSplitSettings,
      setLayoutPreset: state.setLayoutPreset,
      setLayoutMode: state.setLayoutMode,
    }))
  );
}

/**
 * Get the caption style for the first selected caption item.
 * Falls back to the first caption in the project if nothing is selected.
 */
export function useActiveCaptionStyle(): CaptionStyle | null {
  return useEditorStore(
    useShallow((state) => {
      // Try selected items first
      for (const id of state.selectedIds) {
        const item = state.items[id];
        if (item?.type === 'caption') {
          return (item.data as CaptionItemData)?.style || null;
        }
      }
      // Fall back to first caption in project
      const captionId = state.itemIds.find((id) => state.items[id]?.type === 'caption');
      if (!captionId) return null;
      const caption = state.items[captionId];
      return (caption?.data as CaptionItemData)?.style || null;
    })
  );
}

// ============================================
// Scene Selection Selectors
// ============================================

export function useSelectedSceneId() {
  return useEditorStore((state) => state.selectedSceneId);
}

export function useSelectedTimeRange() {
  return useEditorStore((state) => state.selectedTimeRange);
}

export function useSelectedElement() {
  return useEditorStore((state) => state.selectedElement);
}

export function useElementPickerEnabled() {
  return useEditorStore((state) => state.elementPickerEnabled);
}

export function useInspectModeEnabled() {
  return useEditorStore((state) => state.inspectModeEnabled);
}

// ============================================
// AI Edit Request Selectors
// ============================================

export function useAIEditRequested() {
  return useEditorStore((state) => state.aiEditRequested);
}

export function usePendingAIMessage() {
  return useEditorStore((state) => state.pendingAIMessage);
}

export function useTransitionPickerItemId() {
  return useEditorStore((state) => state.transitionPickerItemId);
}

// ============================================
// AI Editing Context Selector
// ============================================

export function useAIEditingContext(): AIEditingContext | null {
  const selectedElement = useEditorStore((s) => s.selectedElement);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const items = useEditorStore((s) => s.items);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);

  return useMemo(() => {
    // Priority 1: Selected element from overlay picker
    if (selectedElement) {
      return {
        type: 'element',
        element: selectedElement,
        sceneId: selectedElement.sceneId,
        displayName: selectedElement.name,
        displayDescription: selectedElement.description,
      } as AIEditingContext;
    }

    // Priority 2: Single selected timeline item (visual or caption)
    if (selectedIds.length === 1) {
      const item = items[selectedIds[0]];
      if (item && (item.type === 'visual' || item.type === 'caption')) {
        const data = item.data;
        const name = item.type === 'visual'
          ? (data as VisualItemData).description || 'Visual'
          : `"${(data as CaptionItemData).text.slice(0, 25)}${(data as CaptionItemData).text.length > 25 ? '...' : ''}"`;

        return {
          type: 'item',
          item: {
            id: item.id,
            type: item.type,
            name,
            description: item.type === 'visual' ? (data as VisualItemData).type : undefined,
          },
          displayName: item.type === 'visual' ? 'Visual' : 'Caption',
          displayDescription: name,
        } as AIEditingContext;
      }
    }

    // Priority 3: Multiple items selected
    if (selectedIds.length > 1) {
      return {
        type: 'scene',
        displayName: `${selectedIds.length} items`,
        displayDescription: 'Edits apply to containing scene',
      } as AIEditingContext;
    }

    // Priority 4: Selected scene
    if (selectedSceneId !== null) {
      return {
        type: 'scene',
        sceneId: selectedSceneId,
        displayName: `Scene ${selectedSceneId}`,
      } as AIEditingContext;
    }

    return null;
  }, [selectedElement, selectedIds, items, selectedSceneId]);
}

// ============================================
// Safe Zone Selectors
// ============================================

export function useSafeZonePlatform() {
  return useEditorStore((state) => state.safeZonePlatform);
}

export function useShowSafeZone() {
  return useEditorStore((state) => state.showSafeZone);
}

// ============================================
// Overlay Zone Selectors
// ============================================

export const useVisualOverlayZone = (itemId: string) =>
  useEditorStore((state) => {
    const item = state.items[itemId];
    if (!item || item.type !== 'visual') return 'none';
    const data = item.data as VisualItemData;
    return data.overlayZone ?? migrateDisplayModeToZone(data.displayMode);
  });

export const useVideoSegmentation = (videoItemId: string): SegmentationData | undefined =>
  useEditorStore((state) => {
    const item = state.items[videoItemId];
    if (!item || item.type !== 'video') return undefined;
    return (item.data as VideoItemData).segmentation;
  });

// ============================================
// Action Hooks
// ============================================

export function useEditorActions() {
  return useEditorStore(
    useShallow((state) => ({
      // Project
      loadProject: state.loadProject,
      reloadVisuals: state.reloadVisuals,
      refreshMediaUrls: state.refreshMediaUrls,
      saveProject: state.saveProject,
      setProject: state.setProject,

      // Video Settings
      updateVideoSettings: state.updateVideoSettings,

      // Caption Styles
      updateAllCaptionStyles: state.updateAllCaptionStyles,
      updateSelectedCaptionStyles: state.updateSelectedCaptionStyles,
      updateWordStyleOverrides: state.updateWordStyleOverrides,
      setApplyStyleToAll: state.setApplyStyleToAll,
      selectAllCaptionsOnTrack: state.selectAllCaptionsOnTrack,

      // Items
      addItem: state.addItem,
      updateItem: state.updateItem,
      updateItemData: state.updateItemData,
      deleteItems: state.deleteItems,
      moveItem: state.moveItem,
      resizeItem: state.resizeItem,

      // Selection
      select: state.select,
      selectRange: state.selectRange,
      selectAll: state.selectAll,
      clearSelection: state.clearSelection,
      setSelectionBox: state.setSelectionBox,

      // Playback
      play: state.play,
      pause: state.pause,
      togglePlayback: state.togglePlayback,
      seek: state.seek,
      setCurrentTime: state.setCurrentTime,

      // Viewport
      setZoom: state.setZoom,
      setScrollX: state.setScrollX,
      setScrollY: state.setScrollY,
      zoomToFit: state.zoomToFit,

      // Drag
      startDrag: state.startDrag,
      updateDrag: state.updateDrag,
      endDrag: state.endDrag,

      // History
      undo: state.undo,
      redo: state.redo,
      pushHistory: state.pushHistory,

      // Tracks
      addTrack: state.addTrack,
      updateTrack: state.updateTrack,
      deleteTrack: state.deleteTrack,
      reorderTracks: state.reorderTracks,

      // Audio Separation
      separateAudio: state.separateAudio,
      toggleEnhancement: state.toggleEnhancement,
      updateEnhancementStatus: state.updateEnhancementStatus,

      // Split
      splitItem: state.splitItem,
      splitAllAtPlayhead: state.splitAllAtPlayhead,
      setSplitMode: state.setSplitMode,

      // Range delete
      deleteTimeRange: state.deleteTimeRange,

      // Clipboard
      copyItems: state.copyItems,
      pasteItems: state.pasteItems,
      duplicateItems: state.duplicateItems,

      // Nudge & Trim
      nudgeItems: state.nudgeItems,
      trimItems: state.trimItems,

      // Subtitle-specific
      splitCaption: state.splitCaption,
      mergeCaptions: state.mergeCaptions,
      updateCaptionText: state.updateCaptionText,

      // Layout
      updateLayoutSettings: state.updateLayoutSettings,
      updatePiPSettings: state.updatePiPSettings,
      updateSplitSettings: state.updateSplitSettings,
      setLayoutPreset: state.setLayoutPreset,
      setLayoutMode: state.setLayoutMode,

      // Scene selection
      setSelectedScene: state.setSelectedScene,
      setSelectedTimeRange: state.setSelectedTimeRange,
      setSelectedElement: state.setSelectedElement,

      // Element picker
      setElementPickerEnabled: state.setElementPickerEnabled,

      // Element inspect mode
      setInspectModeEnabled: state.setInspectModeEnabled,

      // AI edit request
      requestAIEdit: state.requestAIEdit,

      // Pending AI message
      setPendingAIMessage: state.setPendingAIMessage,
      changeDisplayModeWithAI: state.changeDisplayModeWithAI,

      // Visual display mode
      updateVisualDisplayMode: state.updateVisualDisplayMode,
      updateVisualTransition: state.updateVisualTransition,
      openTransitionPicker: state.openTransitionPicker,
      closeTransitionPicker: state.closeTransitionPicker,

      // Captions
      setShowCaptions: state.setShowCaptions,

      // Safe zone
      setSafeZonePlatform: state.setSafeZonePlatform,
      setShowSafeZone: state.setShowSafeZone,

      // Overlay zones
      updateVisualOverlayZone: state.updateVisualOverlayZone,
      getVideoSegmentation: state.getVideoSegmentation,
    }))
  );
}

// ============================================
// Computed Values
// ============================================

/**
 * Get all items visible at a specific time
 */
export function useItemsAtTime(timeMs: number): TimelineItem[] {
  return useEditorStore(
    useShallow((state) =>
      state.itemIds
        .map((id) => state.items[id])
        .filter((item) => item && item.startMs <= timeMs && item.endMs > timeMs)
    )
  );
}

/**
 * Get video item (usually just one)
 */
export function useVideoItem(): TimelineItem | null {
  return useEditorStore((state) => {
    const videoId = state.itemIds.find((id) => state.items[id]?.type === 'video');
    return videoId ? state.items[videoId] : null;
  });
}

/**
 * Get video source URL
 */
export function useVideoUrl(): string | null {
  return useEditorStore((state) => {
    const videoId = state.itemIds.find((id) => state.items[id]?.type === 'video');
    if (!videoId) return null;
    const video = state.items[videoId];
    return (video?.data as VideoItemData)?.src || null;
  });
}

/**
 * Get all caption items sorted by start time
 */
export function useCaptionItems(): TimelineItem[] {
  return useEditorStore(
    useShallow((state) =>
      state.itemIds
        .map((id) => state.items[id])
        .filter((item) => item?.type === 'caption')
        .sort((a, b) => a.startMs - b.startMs)
    )
  );
}

/**
 * Get caption at current time
 */
export function useCurrentCaption(): TimelineItem | null {
  return useEditorStore((state) => {
    const time = state.currentTimeMs;
    const caption = state.itemIds
      .map((id) => state.items[id])
      .find(
        (item) =>
          item?.type === 'caption' && item.startMs <= time && item.endMs > time
      );
    return caption || null;
  });
}

/**
 * Convert time to x position on canvas
 */
export function useTimeToX(): (timeMs: number) => number {
  const zoom = useZoom();
  const scrollX = useScrollX();
  return (timeMs: number) => timeMs * zoom - scrollX;
}

/**
 * Convert x position to time
 */
export function useXToTime(): (x: number) => number {
  const zoom = useZoom();
  const scrollX = useScrollX();
  return (x: number) => (x + scrollX) / zoom;
}

/**
 * Get track Y position
 */
export function useTrackY(): (trackId: string) => number {
  const tracks = useTracks();
  const scrollY = useScrollY();

  return (trackId: string) => {
    let y = 0;
    for (const track of tracks) {
      if (track.id === trackId) {
        return y - scrollY;
      }
      y += track.height;
    }
    return 0;
  };
}

// ============================================
// Workspace Selectors (Plan 3)
// ============================================

/** Workspace lifecycle status */
export function useWorkspaceStatus() {
  return useEditorStore((s) => s.workspaceStatus);
}

/** Whether workspace is active (ready for manifest ops) */
export function useIsWorkspaceActive() {
  return useEditorStore((s) => s.workspaceStatus === 'active');
}

/** Current workspace bundle URL */
export function useWorkspaceBundleUrl() {
  return useEditorStore((s) => s.workspaceBundleUrl);
}

/** Bundle version — changes trigger visual reload */
export function useWorkspaceBundleVersion() {
  return useEditorStore((s) => s.workspaceBundleVersion);
}

/** Who holds the workspace lock (null if unlocked) */
export function useWorkspaceLockHolder() {
  return useEditorStore((s) => s.workspaceLockHolder);
}

/** Bundle error message (null if no error) */
export function useWorkspaceBundleError() {
  return useEditorStore((s) => s.workspaceBundleError);
}

/** Raw workspace manifest JSON */
export function useWorkspaceManifest() {
  return useEditorStore((s) => s.workspaceManifest);
}

/** Error from last failed manifest operation dispatch */
export const useManifestSyncError = () => useEditorStore((s) => s.manifestSyncError);
