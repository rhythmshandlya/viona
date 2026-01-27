/**
 * ContextMenu Component
 * Right-click context menu for the timeline canvas.
 * Renders as a React portal positioned at the click coordinates.
 */

'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ContextMenuState, ContextMenuTarget } from './useContextMenu';
import {
  useEditorActions,
  useSelectedIds,
  useItems,
  useTracks,
  useCurrentTimeMs,
  useClipboard,
} from '../../store/use-editor-store';

// ============================================
// Types
// ============================================

interface ContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
}

interface MenuItemDef {
  label: string;
  shortcut?: string;
  action: () => void;
  disabled?: boolean;
}

interface SeparatorDef {
  type: 'separator';
}

type MenuEntry = MenuItemDef | SeparatorDef;

function isSeparator(entry: MenuEntry): entry is SeparatorDef {
  return 'type' in entry && entry.type === 'separator';
}

// ============================================
// Component
// ============================================

export function ContextMenu({ state, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedIds = useSelectedIds();
  const items = useItems();
  const tracks = useTracks();
  const currentTimeMs = useCurrentTimeMs();
  const clipboard = useClipboard();

  const {
    splitItem,
    copyItems,
    duplicateItems,
    deleteItems,
    pasteItems,
    updateTrack,
    select,
  } = useEditorActions();

  // Close on outside click
  useEffect(() => {
    if (!state.isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Use requestAnimationFrame to avoid closing immediately on the same click
    const rafId = requestAnimationFrame(() => {
      document.addEventListener('pointerdown', handlePointerDown);
    });

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [state.isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!state.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.isOpen, onClose]);

  // Adjust position to keep menu within viewport
  useEffect(() => {
    if (!state.isOpen || !menuRef.current) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = state.x;
    let adjustedY = state.y;

    if (rect.right > viewportWidth) {
      adjustedX = viewportWidth - rect.width - 4;
    }
    if (rect.bottom > viewportHeight) {
      adjustedY = viewportHeight - rect.height - 4;
    }

    if (adjustedX !== state.x || adjustedY !== state.y) {
      menu.style.left = `${adjustedX}px`;
      menu.style.top = `${adjustedY}px`;
    }
  }, [state.isOpen, state.x, state.y]);

  const handleAction = useCallback(
    (action: () => void) => {
      action();
      onClose();
    },
    [onClose]
  );

  // Build menu entries based on target type
  const buildMenuEntries = useCallback(
    (target: ContextMenuTarget): MenuEntry[] => {
      if (target.type === 'item' && target.itemId) {
        const itemId = target.itemId;
        const isAlreadySelected = selectedIds.includes(itemId);
        const idsForAction = isAlreadySelected ? selectedIds : [itemId];
        const item = items[itemId];
        const track = item ? tracks.find((t) => t.id === item.trackId) : undefined;
        const isLocked = track?.locked ?? false;

        // Helper that ensures item is selected before performing action
        const withSelection = (action: () => void) => () => {
          if (!isAlreadySelected) {
            select([itemId], 'replace');
          }
          action();
        };

        return [
          {
            label: 'Split Here',
            shortcut: 'S',
            action: withSelection(() => splitItem(itemId, currentTimeMs)),
          },
          { type: 'separator' as const },
          {
            label: 'Copy',
            shortcut: 'Ctrl+C',
            action: withSelection(() => copyItems(idsForAction)),
          },
          {
            label: 'Duplicate',
            shortcut: 'Ctrl+D',
            action: withSelection(() => duplicateItems(idsForAction)),
          },
          {
            label: 'Delete',
            shortcut: 'Del',
            action: withSelection(() => deleteItems(idsForAction)),
          },
          { type: 'separator' as const },
          {
            label: isLocked ? 'Unlock Track' : 'Lock Track',
            action: () => {
              if (track) {
                updateTrack(track.id, { locked: !isLocked });
              }
            },
            disabled: !track,
          },
        ];
      }

      if (target.type === 'track' && target.trackId) {
        return [
          {
            label: 'Paste',
            shortcut: 'Ctrl+V',
            action: () => pasteItems(target.timeMs),
            disabled: !clipboard || clipboard.length === 0,
          },
        ];
      }

      // Empty area
      return [
        {
          label: 'Paste',
          shortcut: 'Ctrl+V',
          action: () => pasteItems(target.timeMs),
          disabled: !clipboard || clipboard.length === 0,
        },
      ];
    },
    [
      selectedIds,
      items,
      tracks,
      currentTimeMs,
      clipboard,
      select,
      splitItem,
      copyItems,
      duplicateItems,
      deleteItems,
      pasteItems,
      updateTrack,
    ]
  );

  if (!state.isOpen || !state.target) return null;

  const entries = buildMenuEntries(state.target);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: 'fixed',
        left: state.x,
        top: state.y,
        zIndex: 9999,
        minWidth: 160,
        maxWidth: 200,
        background: 'var(--editor-bg-elevated, #1e1e2e)',
        border: '1px solid var(--editor-border-subtle, #333)',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        padding: '4px 0',
        userSelect: 'none',
      }}
    >
      {entries.map((entry, index) => {
        if (isSeparator(entry)) {
          return (
            <div
              key={`sep-${index}`}
              style={{
                height: 1,
                background: 'var(--editor-border-subtle, #333)',
                margin: '4px 0',
              }}
            />
          );
        }

        return (
          <button
            key={entry.label}
            role="menuitem"
            disabled={entry.disabled}
            onClick={() => handleAction(entry.action)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '6px 12px',
              background: 'transparent',
              border: 'none',
              color: entry.disabled
                ? 'var(--editor-text-disabled, #555)'
                : 'var(--editor-text-primary, #e0e0e0)',
              fontSize: 13,
              lineHeight: '20px',
              cursor: entry.disabled ? 'default' : 'pointer',
              textAlign: 'left',
              outline: 'none',
              opacity: entry.disabled ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!entry.disabled) {
                (e.currentTarget as HTMLButtonElement).style.background =
                  'var(--editor-bg-hover, rgba(255, 255, 255, 0.08))';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            <span>{entry.label}</span>
            {entry.shortcut && (
              <span
                style={{
                  color: 'var(--editor-text-secondary, #888)',
                  fontSize: 11,
                  marginLeft: 16,
                }}
              >
                {entry.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>,
    document.body
  );
}
