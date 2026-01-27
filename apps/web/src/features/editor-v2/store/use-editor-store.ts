/**
 * Editor V2 Store Hooks and Selectors
 * Provides optimized selectors for components to subscribe to specific state slices
 */

import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from './editor-store';
import { TimelineItem, Track, VideoItemData, VideoSettings, CaptionStyle, CaptionItemData } from './types';

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

export function useIsLoading() {
  return useEditorStore((state) => state.isLoading);
}

export function useError() {
  return useEditorStore((state) => state.error);
}

export function useIsSaving() {
  return useEditorStore((state) => state.isSaving);
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

// ============================================
// Action Hooks
// ============================================

export function useEditorActions() {
  return useEditorStore(
    useShallow((state) => ({
      // Project
      loadProject: state.loadProject,
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
      setSplitMode: state.setSplitMode,

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
