/**
 * ContextMenu Component
 * Right-click context menu for the timeline canvas.
 * Renders as a React portal positioned at the click coordinates.
 */

'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Scissors,
  Copy,
  CopyPlus,
  Trash2,
  Lock,
  Unlock,
  SlidersHorizontal,
  Diamond,
  RotateCcw,
  Blend,
  Sparkles,
  ArrowRightLeft,
  ClipboardPaste,
  Timer,
  Layers,
  type LucideIcon,
} from 'lucide-react';
import { ContextMenuState, ContextMenuTarget } from './useContextMenu';
import {
  useTimelineActions,
  useTrackActions,
  useAIActions,
  useSafeZoneActions,
  useTransformActions,
  useSelectedIds,
  useItems,
  useTracks,
  useClipboard,
  useSelectedTimeRange,
  useEditorStore,
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
  icon?: LucideIcon;
  action: () => void;
  disabled?: boolean;
  checked?: boolean;
}

interface SeparatorDef {
  type: 'separator';
}

interface SubMenuDef {
  type: 'submenu';
  label: string;
  items: MenuItemDef[];
}

type MenuEntry = MenuItemDef | SeparatorDef | SubMenuDef;

function isSeparator(entry: MenuEntry): entry is SeparatorDef {
  return 'type' in entry && entry.type === 'separator';
}

function isSubMenu(entry: MenuEntry): entry is SubMenuDef {
  return 'type' in entry && entry.type === 'submenu';
}

// ============================================
// Component
// ============================================

export function ContextMenu({ state, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedIds = useSelectedIds();
  const items = useItems();
  const tracks = useTracks();
  const clipboard = useClipboard();
  const selectedTimeRange = useSelectedTimeRange();

  const {
    splitItem,
    copyItems,
    duplicateItems,
    deleteItems,
    deleteTimeRange,
    pasteItems,
    select,
  } = useTimelineActions();
  const { updateTrack } = useTrackActions();
  const { requestAIEdit } = useAIActions();
  const { openTransitionPicker } = useSafeZoneActions();
  const { updateTransform, updateFilters, updateKeyframes, addKeyframeAtTime } = useTransformActions();

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
            icon: Scissors,
            action: withSelection(() => splitItem(itemId, useEditorStore.getState().currentTimeMs)),
          },
          { type: 'separator' as const },
          {
            label: 'Copy',
            shortcut: '⌘C',
            icon: Copy,
            action: withSelection(() => copyItems(idsForAction)),
          },
          {
            label: 'Duplicate',
            shortcut: '⌘D',
            icon: CopyPlus,
            action: withSelection(() => duplicateItems(idsForAction)),
          },
          {
            label: 'Delete',
            shortcut: '⌫',
            icon: Trash2,
            action: withSelection(() => deleteItems(idsForAction)),
          },
          { type: 'separator' as const },
          {
            label: isLocked ? 'Unlock Track' : 'Lock Track',
            icon: isLocked ? Unlock : Lock,
            action: () => {
              if (track) {
                updateTrack(track.id, { locked: !isLocked });
              }
            },
            disabled: !track,
          },
          { type: 'separator' as const },
          {
            label: 'Edit Properties',
            icon: SlidersHorizontal,
            action: withSelection(() => {
              select([itemId], 'replace');
            }),
          },
          {
            label: 'Add Keyframe',
            icon: Diamond,
            action: withSelection(() => {
              const currentItem = items[itemId];
              if (!currentItem) return;
              const relativeTime = useEditorStore.getState().currentTimeMs - currentItem.startMs;
              const currentTransform = currentItem.transform || {
                x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1,
              };
              addKeyframeAtTime(itemId, relativeTime, currentTransform);
            }),
          },
          { type: 'separator' as const },
          {
            label: 'Clear Keyframes',
            icon: Diamond,
            action: withSelection(() => updateKeyframes(itemId, [])),
            disabled: !item?.keyframes || item.keyframes.length === 0,
          },
          {
            label: 'Reset Transform',
            icon: RotateCcw,
            action: withSelection(() =>
              updateTransform(itemId, { x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1 })
            ),
          },
          {
            label: 'Reset Filters',
            icon: Blend,
            action: withSelection(() =>
              updateFilters(itemId, { brightness: 1, contrast: 1, saturation: 1, blur: 0, hue: 0, grayscale: 0, sepia: 0 })
            ),
          },
          // "Change Transition" and "Edit with AI" for visual items
          ...(item?.type === 'visual'
            ? [
                { type: 'separator' as const },
                {
                  label: 'Change Transition\u2026',
                  icon: ArrowRightLeft,
                  action: withSelection(() => openTransitionPicker(itemId)),
                },
                {
                  label: 'Edit with AI',
                  shortcut: 'E',
                  icon: Sparkles,
                  action: withSelection(() => requestAIEdit(item)),
                },
              ]
            : []),
        ];
      }

      // Range entries shown when a time range is selected (from ruler Alt+drag)
      const rangeEditEntries: MenuEntry[] = selectedTimeRange
        ? [
            { type: 'separator' as const },
            {
              label: 'Delete Range',
              shortcut: '⌫',
              icon: Trash2,
              action: () => deleteTimeRange(selectedTimeRange.startMs, selectedTimeRange.endMs, false),
            },
            {
              label: 'Ripple Delete Range',
              shortcut: '⇧⌫',
              icon: Timer,
              action: () => deleteTimeRange(selectedTimeRange.startMs, selectedTimeRange.endMs, true),
            },
            {
              label: 'Edit with AI',
              shortcut: 'E',
              icon: Sparkles,
              action: () => useEditorStore.setState({ aiEditRequested: true }),
            },
          ]
        : [];

      if (target.type === 'track' && target.trackId) {
        return [
          {
            label: 'Paste',
            shortcut: '⌘V',
            icon: ClipboardPaste,
            action: () => pasteItems(target.timeMs),
            disabled: !clipboard || clipboard.length === 0,
          },
          ...rangeEditEntries,
        ];
      }

      // Empty area
      return [
        {
          label: 'Paste',
          shortcut: '⌘V',
          icon: ClipboardPaste,
          action: () => pasteItems(target.timeMs),
          disabled: !clipboard || clipboard.length === 0,
        },
        ...rangeEditEntries,
      ];
    },
    [
      selectedIds,
      items,
      tracks,
      clipboard,
      selectedTimeRange,
      select,
      splitItem,
      copyItems,
      duplicateItems,
      deleteItems,
      pasteItems,
      updateTrack,
      requestAIEdit,
      openTransitionPicker,
      updateTransform,
      updateFilters,
      updateKeyframes,
      addKeyframeAtTime,
    ]
  );

  if (!state.isOpen || !state.target) return null;

  const entries = buildMenuEntries(state.target);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="context-menu-glass"
      style={{
        position: 'fixed',
        left: state.x,
        top: state.y,
        zIndex: 9999,
      }}
    >
      {entries.map((entry, index) => {
        if (isSeparator(entry)) {
          return (
            <div
              key={`sep-${index}`}
              className="h-px bg-white/[0.06] mx-2 my-1"
            />
          );
        }

        if (isSubMenu(entry)) {
          return (
            <div key={entry.label}>
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-white/30 uppercase tracking-widest">
                {entry.label}
              </div>
              {entry.items.map((subItem) => {
                const Icon = subItem.icon;
                return (
                  <button
                    key={subItem.label}
                    role="menuitem"
                    disabled={subItem.disabled}
                    onClick={() => handleAction(subItem.action)}
                    className={`context-menu-item ${subItem.disabled ? 'opacity-40 cursor-default' : 'cursor-pointer'}`}
                  >
                    <span className="flex items-center gap-2.5">
                      {Icon && <Icon className="w-[15px] h-[15px] text-white/40 flex-shrink-0" />}
                      <span>{subItem.label}</span>
                    </span>
                    {subItem.shortcut && (
                      <span className="text-[11px] text-white/25 ml-4 font-mono">
                        {subItem.shortcut}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        }

        const Icon = entry.icon;
        return (
          <button
            key={entry.label}
            role="menuitem"
            disabled={entry.disabled}
            onClick={() => handleAction(entry.action)}
            className={`context-menu-item ${entry.disabled ? 'opacity-40 cursor-default' : 'cursor-pointer'}`}
          >
            <span className="flex items-center gap-2.5">
              {Icon && <Icon className="w-[15px] h-[15px] text-white/40 flex-shrink-0" />}
              <span>{entry.label}</span>
            </span>
            {entry.shortcut && (
              <span className="text-[11px] text-white/25 ml-4 font-mono">
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
