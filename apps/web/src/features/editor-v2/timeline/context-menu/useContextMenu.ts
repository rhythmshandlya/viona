/**
 * useContextMenu Hook
 * Manages context menu state for the timeline canvas right-click menu.
 */

import React, { useState, useCallback } from 'react';

export interface ContextMenuTarget {
  type: 'item' | 'track' | 'empty';
  itemId?: string;
  trackId?: string;
  timeMs: number;
}

export interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  target: ContextMenuTarget | null;
}

const INITIAL_STATE: ContextMenuState = {
  isOpen: false,
  x: 0,
  y: 0,
  target: null,
};

export function useContextMenu() {
  const [state, setState] = useState<ContextMenuState>(INITIAL_STATE);

  const open = useCallback(
    (e: React.MouseEvent | MouseEvent, target: ContextMenuTarget) => {
      e.preventDefault();
      e.stopPropagation();
      setState({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
        target,
      });
    },
    []
  );

  const close = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return { state, open, close };
}
