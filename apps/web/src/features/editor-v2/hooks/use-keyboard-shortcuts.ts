/**
 * Keyboard Shortcuts Hook
 * Handles global keyboard shortcuts for the editor
 */

'use client';

import { useEffect, useCallback } from 'react';
import { useEditorActions, useSelectedIds, useCanUndo, useCanRedo } from '../store/use-editor-store';

export function useKeyboardShortcuts() {
  const {
    togglePlayback,
    deleteItems,
    selectAll,
    clearSelection,
    undo,
    redo,
    seek,
  } = useEditorActions();

  const selectedIds = useSelectedIds();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();

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

      // Space: Play/Pause
      if (e.code === 'Space' && !cmdOrCtrl && !e.shiftKey) {
        e.preventDefault();
        togglePlayback();
        return;
      }

      // Delete/Backspace: Delete selected items
      if ((e.code === 'Delete' || e.code === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        deleteItems(selectedIds);
        return;
      }

      // Cmd/Ctrl + A: Select all
      if (cmdOrCtrl && e.code === 'KeyA') {
        e.preventDefault();
        selectAll();
        return;
      }

      // Escape: Clear selection
      if (e.code === 'Escape') {
        e.preventDefault();
        clearSelection();
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

      // Home: Go to start
      if (e.code === 'Home') {
        e.preventDefault();
        seek(0);
        return;
      }

      // Arrow keys for frame-by-frame navigation
      if (e.code === 'ArrowLeft' && !cmdOrCtrl) {
        e.preventDefault();
        // Move back 1 frame (assuming 30fps = ~33ms)
        // This would need current time from store
        return;
      }

      if (e.code === 'ArrowRight' && !cmdOrCtrl) {
        e.preventDefault();
        // Move forward 1 frame
        return;
      }
    },
    [
      togglePlayback,
      deleteItems,
      selectAll,
      clearSelection,
      undo,
      redo,
      seek,
      selectedIds,
      canUndo,
      canRedo,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
