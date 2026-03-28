/**
 * CommandPalette Component
 * Keyboard-first command palette for quick actions (⌘K)
 */

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search } from 'lucide-react';
import { usePlaybackActions, useHistoryActions, useProjectActions, useTimelineActions } from '../store/use-editor-store';

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  category: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { togglePlayback, seek } = usePlaybackActions();
  const { undo, redo } = useHistoryActions();
  const { saveProject } = useProjectActions();
  const { deleteItems } = useTimelineActions();

  // Define commands
  const commands: Command[] = useMemo(() => [
    // Playback
    { id: 'play', label: 'Play / Pause', shortcut: 'Space', category: 'Playback', action: togglePlayback },
    { id: 'start', label: 'Go to start', shortcut: 'Home', category: 'Playback', action: () => seek(0) },

    // Edit
    { id: 'undo', label: 'Undo', shortcut: '⌘Z', category: 'Edit', action: undo },
    { id: 'redo', label: 'Redo', shortcut: '⌘⇧Z', category: 'Edit', action: redo },
    { id: 'delete', label: 'Delete selected', shortcut: '⌫', category: 'Edit', action: () => deleteItems([]) },

    // Project
    { id: 'save', label: 'Save project', shortcut: '⌘S', category: 'Project', action: saveProject },
  ], [togglePlayback, seek, undo, redo, deleteItems, saveProject]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;

    const lowerQuery = query.toLowerCase();
    return commands.filter((cmd) =>
      cmd.label.toLowerCase().includes(lowerQuery) ||
      cmd.category.toLowerCase().includes(lowerQuery)
    );
  }, [commands, query]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    for (const cmd of filteredCommands) {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    }
    return groups;
  }, [filteredCommands]);

  // Flat list for keyboard navigation
  const flatCommands = useMemo(() => filteredCommands, [filteredCommands]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (flatCommands[selectedIndex]) {
          flatCommands[selectedIndex].action();
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [flatCommands, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedEl = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 editor-command-backdrop" />

      {/* Palette */}
      <div
        className="relative w-full max-w-lg bg-[var(--editor-bg-surface)] rounded-xl
                   border border-[var(--editor-border-default)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--editor-border-subtle)]">
          <Search className="w-4 h-4 text-[var(--editor-text-muted)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-[var(--editor-text-primary)] text-sm
                       placeholder:text-[var(--editor-text-muted)] focus:outline-none"
          />
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {Object.entries(groupedCommands).map(([category, cmds]) => (
            <div key={category}>
              <div className="px-4 py-1.5 text-xs font-normal text-[var(--editor-text-muted)] uppercase tracking-wide">
                {category}
              </div>
              {cmds.map((cmd) => {
                const globalIndex = flatCommands.indexOf(cmd);
                const isSelected = globalIndex === selectedIndex;

                return (
                  <button
                    key={cmd.id}
                    data-index={globalIndex}
                    onClick={() => {
                      cmd.action();
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                    className={`w-full flex items-center justify-between px-4 py-2 text-left transition-colors ${
                      isSelected
                        ? 'bg-[var(--editor-accent-muted)] text-[var(--editor-text-primary)]'
                        : 'text-[var(--editor-text-secondary)] hover:bg-[var(--editor-bg-hover)]'
                    }`}
                  >
                    <span className="text-sm">{cmd.label}</span>
                    {cmd.shortcut && (
                      <kbd className="text-xs text-[var(--editor-text-muted)] bg-[var(--editor-bg-elevated)]
                                      px-1.5 py-0.5 rounded border border-[var(--editor-border-subtle)]">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {flatCommands.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-[var(--editor-text-muted)]">
              No commands found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Hook to manage command palette state
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K or Ctrl+K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}
