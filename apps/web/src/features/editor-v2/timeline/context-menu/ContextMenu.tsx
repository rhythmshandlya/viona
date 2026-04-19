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
  Type,
  CornerLeftUp,
  CornerLeftDown,
  type LucideIcon,
} from 'lucide-react';
import { ContextMenuState, ContextMenuTarget } from './useContextMenu';
import {
  useTimelineActions,
  useTrackActions,
  useAIActions,
  useSafeZoneActions,
  useTransformActions,
  useCaptionActions,
  useSelectedIds,
  useItems,
  useTracks,
  useClipboard,
  useSelectedTimeRange,
  useEditorStore,
} from '../../store/use-editor-store';
import type { CaptionItemData } from '../../store/types';

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
  const { splitCaption, mergeCaptions } = useCaptionActions();

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

        // ────────────────────────────────────────────
        // Caption items — transcript-centric actions.
        // The generic Split-at-playhead / Add-keyframe / Reset-transform
        // options don't apply: captions are a transcript-driven primitive,
        // not a transformable clip. Mirror the Captions tab row actions so
        // the user has parity across entry points.
        // ────────────────────────────────────────────
        if (item?.type === 'caption') {
          const data = item.data as CaptionItemData;
          const captionList = Object.values(items)
            .filter((i) => i.type === 'caption' && i.trackId === item.trackId)
            .sort((a, b) => a.startMs - b.startMs);
          const idx = captionList.findIndex((c) => c.id === itemId);
          const prev = idx > 0 ? captionList[idx - 1] : null;
          const next = idx >= 0 && idx < captionList.length - 1 ? captionList[idx + 1] : null;

          // Pick a word index to split at: prefer the word playing at the
          // current playhead; else midpoint.
          const splitAtPlayheadWordIndex = (): number => {
            const t = useEditorStore.getState().currentTimeMs;
            const rel = t - item.startMs;
            const wi = (data.words ?? []).findIndex((w) => rel >= w.startMs && rel < w.endMs);
            if (wi > 0) return wi;
            return Math.floor((data.words?.length ?? 0) / 2);
          };

          return [
            {
              label: 'Edit Caption',
              shortcut: 'Enter',
              icon: Type,
              action: withSelection(() => {
                window.dispatchEvent(new CustomEvent('viona:caption-edit-text', { detail: { captionId: itemId } }));
              }),
            },
            { type: 'separator' as const },
            {
              label: 'Split at Playhead',
              shortcut: 'S',
              icon: Scissors,
              action: withSelection(() => {
                const wi = splitAtPlayheadWordIndex();
                if (wi > 0 && wi < (data.words?.length ?? 0)) splitCaption(itemId, wi);
              }),
              disabled: !data.words || data.words.length < 2,
            },
            {
              label: 'Merge with Previous',
              icon: CornerLeftUp,
              action: withSelection(() => {
                if (prev) mergeCaptions(prev.id, itemId);
              }),
              disabled: !prev,
            },
            {
              label: 'Merge with Next',
              icon: CornerLeftDown,
              action: withSelection(() => {
                if (next) mergeCaptions(itemId, next.id);
              }),
              disabled: !next,
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
                if (track) updateTrack(track.id, { locked: !isLocked });
              },
              disabled: !track,
            },
          ];
        }

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
      splitCaption,
      mergeCaptions,
    ]
  );

  if (!state.isOpen || !state.target) return null;

  const entries = buildMenuEntries(state.target);

  const itemClass =
    'w-full flex items-center justify-between gap-4 px-3 py-1.5 text-[12px] text-white/85 ' +
    'rounded-md transition-colors duration-75 ' +
    'enabled:hover:bg-white/10 enabled:hover:text-white ' +
    'disabled:opacity-35 disabled:cursor-not-allowed';

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="editor-theme"
      style={{
        position: 'fixed',
        left: state.x,
        top: state.y,
        zIndex: 9999,
        minWidth: '13.75rem',
        padding: 4,
        borderRadius: 10,
        background: 'rgba(20, 20, 28, 0.92)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow:
          '0 10px 30px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        backdropFilter: 'blur(24px) saturate(160%)',
        color: 'rgba(255, 255, 255, 0.85)',
      }}
    >
      {entries.map((entry, index) => {
        if (isSeparator(entry)) {
          return (
            <div
              key={`sep-${index}`}
              className="h-px bg-white/[0.08] mx-1 my-1"
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
                    className={itemClass}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      {Icon && <Icon className="w-[14px] h-[14px] text-white/50 flex-shrink-0" />}
                      <span className="truncate">{subItem.label}</span>
                    </span>
                    {subItem.shortcut && (
                      <span className="text-[10.5px] text-white/35 font-mono tabular-nums flex-shrink-0">
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
            className={itemClass}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              {Icon && <Icon className="w-[14px] h-[14px] text-white/50 flex-shrink-0" />}
              <span className="truncate">{entry.label}</span>
            </span>
            {entry.shortcut && (
              <span className="text-[10.5px] text-white/35 font-mono tabular-nums flex-shrink-0">
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
