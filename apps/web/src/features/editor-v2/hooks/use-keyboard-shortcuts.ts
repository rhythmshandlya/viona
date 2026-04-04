/**
 * Keyboard Shortcuts Hook
 * Handles global keyboard shortcuts for the editor
 *
 * Shortcuts:
 *   Space          – Play / Pause
 *   Delete/Backsp  – Delete selected items / delete time range
 *   Shift+Delete   – Ripple delete time range
 *   Ctrl+A         – Select all
 *   Ctrl+Z         – Undo
 *   Ctrl+Shift+Z/Y – Redo
 *   Ctrl+C         – Copy selected items
 *   Ctrl+V         – Paste at playhead
 *   Ctrl+D         – Duplicate selected items
 *   Home           – Seek to start (0 ms)
 *   End            – Seek to duration end
 *   I              – Toggle element inspect mode
 *   S              – Toggle split mode
 *   T              – Toggle transcript/captions panel
 *   1 / 2 / 3      – Switch caption display mode
 *   ArrowLeft      – (selection) Nudge left -100 ms; (shift) -1 frame; (none) frame-step back
 *   ArrowRight     – (selection) Nudge right +100 ms; (shift) +1 frame; (none) frame-step forward
 *   [              – Trim selected items start inward by 100 ms
 *   ]              – Trim selected items end outward by 100 ms
 *   Escape         – Exit inspect mode / deselect element / exit split mode / close panel
 */

'use client';

import { useEffect, useCallback } from 'react';
import {
  usePlaybackActions,
  useTimelineActions,
  useHistoryActions,
  useCaptionActions,
  useEditorStore,
  useSelectedIds,
  useCanUndo,
  useCanRedo,
  useDuration,
  useFps,
  useSplitMode,
  useClipboard,
  useInspectModeEnabled,
  useSelectedElement,
} from '../store/use-editor-store';
import type { CaptionDisplayMode } from '../store/types';

export interface KeyboardShortcutOptions {
  /** Callback invoked when the T key is pressed to toggle the transcript panel. */
  onToggleTranscript?: () => void;
  /** Callback invoked when Escape is pressed (after split mode check) to close the right panel. */
  onClosePanel?: () => void;
  /** Callback invoked when the I key is pressed to toggle element inspect mode. */
  onToggleInspectMode?: () => void;
}

export function useKeyboardShortcuts(options: KeyboardShortcutOptions = {}) {
  const { onToggleTranscript, onClosePanel, onToggleInspectMode } = options;

  const { togglePlayback, seek } = usePlaybackActions();
  const {
    deleteItems,
    deleteTimeRange,
    selectAll,
    clearSelection,
    setSplitMode,
    copyItems,
    pasteItems,
    duplicateItems,
    nudgeItems,
    trimItems,
  } = useTimelineActions();
  const { undo, redo } = useHistoryActions();
  const { updateCaptionPreset } = useCaptionActions();

  const selectedIds = useSelectedIds();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const duration = useDuration();
  const fps = useFps();
  const splitMode = useSplitMode();
  const clipboard = useClipboard();
  const inspectModeEnabled = useInspectModeEnabled();
  const selectedElement = useSelectedElement();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      const frameDurationMs = fps > 0 ? 1000 / fps : 33.333;

      // Space: Play/Pause
      if (e.code === 'Space' && !cmdOrCtrl && !e.shiftKey) {
        e.preventDefault();
        togglePlayback();
        return;
      }

      // Delete/Backspace: Delete selected items or time range
      if (e.code === 'Delete' || e.code === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          deleteItems(selectedIds);
          return;
        }
        const timeRange = useEditorStore.getState().selectedTimeRange;
        if (timeRange) {
          e.preventDefault();
          deleteTimeRange(timeRange.startMs, timeRange.endMs, e.shiftKey);
          return;
        }
      }

      // Cmd/Ctrl + A: Select all
      if (cmdOrCtrl && e.code === 'KeyA') {
        e.preventDefault();
        selectAll();
        return;
      }

      // Escape: Exit inspect mode / deselect element / exit split mode / close panel
      if (e.code === 'Escape') {
        e.preventDefault();
        if (inspectModeEnabled) {
          // In inspect mode: if element selected, deselect it; otherwise exit inspect mode
          if (selectedElement) {
            useEditorStore.setState({
              selectedElement: null,
              elementPickerEnabled: false,
            });
          } else {
            useEditorStore.setState({ inspectModeEnabled: false });
          }
        } else if (selectedElement) {
          // Element selected from spotlight — clear it
          useEditorStore.setState({
            selectedElement: null,
            elementPickerEnabled: false,
          });
        } else if (splitMode) {
          setSplitMode(false);
        } else {
          onClosePanel?.();
        }
        return;
      }

      // Cmd/Ctrl + Z: Undo
      if (cmdOrCtrl && !e.shiftKey && e.code === 'KeyZ') {
        e.preventDefault();
        if (canUndo) {
          undo();
        }
        return;
      }

      // Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y: Redo
      if (
        (cmdOrCtrl && e.shiftKey && e.code === 'KeyZ') ||
        (cmdOrCtrl && e.code === 'KeyY')
      ) {
        e.preventDefault();
        if (canRedo) {
          redo();
        }
        return;
      }

      // Cmd/Ctrl + C: Copy selected items (only intercept when items are selected)
      if (cmdOrCtrl && e.code === 'KeyC' && selectedIds.length > 0) {
        e.preventDefault();
        copyItems(selectedIds);
        return;
      }

      // Cmd/Ctrl + V: Paste at playhead (only intercept when clipboard has items)
      if (cmdOrCtrl && e.code === 'KeyV' && clipboard && clipboard.length > 0) {
        e.preventDefault();
        pasteItems(useEditorStore.getState().currentTimeMs);
        return;
      }

      // Cmd/Ctrl + D: Duplicate selected items
      if (cmdOrCtrl && e.code === 'KeyD') {
        e.preventDefault();
        if (selectedIds.length > 0) {
          duplicateItems(selectedIds);
        }
        return;
      }

      // Home: Go to start
      if (e.code === 'Home') {
        e.preventDefault();
        seek(0);
        return;
      }

      // End: Go to duration end
      if (e.code === 'End') {
        e.preventDefault();
        seek(duration);
        return;
      }

      // I: Toggle element inspect mode
      if (e.code === 'KeyI' && !cmdOrCtrl && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        onToggleInspectMode?.();
        return;
      }

      // S: Toggle split mode
      if (e.code === 'KeyS' && !cmdOrCtrl && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        setSplitMode(!splitMode);
        return;
      }

      // T: Toggle transcript panel
      if (e.code === 'KeyT' && !cmdOrCtrl && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        onToggleTranscript?.();
        return;
      }

      // 1 / 2 / 3: Switch caption display mode
      if (!cmdOrCtrl && !e.shiftKey && !e.altKey) {
        const displayModeMap: Record<string, CaptionDisplayMode> = {
          Digit1: 'word-by-word',
          Digit2: 'phrase',
          Digit3: 'karaoke',
        };
        const displayMode = displayModeMap[e.code];
        if (displayMode) {
          e.preventDefault();
          updateCaptionPreset({ displayMode });
          return;
        }
      }

      // Arrow keys: nudge (with selection) or frame-step (without selection)
      if (e.code === 'ArrowLeft' && !cmdOrCtrl) {
        e.preventDefault();
        if (selectedIds.length > 0) {
          // Nudge selected items left: Shift = 1 frame, otherwise 100 ms
          const delta = e.shiftKey ? -frameDurationMs : -100;
          nudgeItems(selectedIds, delta);
        } else {
          // Frame-step backward
          const newTime = Math.max(0, useEditorStore.getState().currentTimeMs - frameDurationMs);
          seek(newTime);
        }
        return;
      }

      if (e.code === 'ArrowRight' && !cmdOrCtrl) {
        e.preventDefault();
        if (selectedIds.length > 0) {
          // Nudge selected items right: Shift = 1 frame, otherwise 100 ms
          const delta = e.shiftKey ? frameDurationMs : 100;
          nudgeItems(selectedIds, delta);
        } else {
          // Frame-step forward
          const newTime = Math.min(duration, useEditorStore.getState().currentTimeMs + frameDurationMs);
          seek(newTime);
        }
        return;
      }

      // [: Trim start inward by 100 ms
      if (e.code === 'BracketLeft' && !cmdOrCtrl && selectedIds.length > 0) {
        e.preventDefault();
        trimItems(selectedIds, 'start', 100);
        return;
      }

      // ]: Trim end outward by 100 ms
      if (e.code === 'BracketRight' && !cmdOrCtrl && selectedIds.length > 0) {
        e.preventDefault();
        trimItems(selectedIds, 'end', 100);
        return;
      }
    },
    [
      togglePlayback,
      deleteItems,
      deleteTimeRange,
      selectAll,
      clearSelection,
      undo,
      redo,
      seek,
      selectedIds,
      canUndo,
      canRedo,
      duration,
      fps,
      splitMode,
      clipboard,
      setSplitMode,
      copyItems,
      pasteItems,
      duplicateItems,
      nudgeItems,
      trimItems,
      updateCaptionPreset,
      onToggleTranscript,
      onClosePanel,
      onToggleInspectMode,
      inspectModeEnabled,
      selectedElement,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
