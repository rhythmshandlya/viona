/**
 * Editor Header Component
 * Minimal header with back, title, command palette hint, export, and menu
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MoreHorizontal, Terminal, Undo2, Redo2, Download } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProject, useEditorActions, useIsSaving } from '../store/use-editor-store';
import { api } from '@/lib/api';
import { CanvasFormatSelector } from './CanvasFormatSelector';

interface HeaderProps {
  onOpenCommandPalette?: () => void;
  onExport?: () => void;
  onToggleTranscript?: () => void;
  isTranscriptActive?: boolean;
  layout?: 'stacked' | 'side-by-side';
  onToggleLayout?: () => void;
  onToggleLogs?: () => void;
  isLogsActive?: boolean;
  hasActiveJob?: boolean;
}

export function Header({ onOpenCommandPalette, onExport, onToggleTranscript, isTranscriptActive, layout, onToggleLayout, onToggleLogs, isLogsActive, hasActiveJob }: HeaderProps) {
  const router = useRouter();
  const project = useProject();
  const { saveProject } = useEditorActions();
  const isSaving = useIsSaving();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState('Untitled Project');
  const inputRef = useRef<HTMLInputElement>(null);
  const savedRef = useRef(false);

  // Sync title with project data
  useEffect(() => {
    if (project?.title) {
      setTitle(project.title);
    }
  }, [project?.title]);

  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      savedRef.current = false;
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleClick = () => {
    setIsEditingTitle(true);
  };

  const saveTitle = () => {
    if (savedRef.current) return;
    savedRef.current = true;
    if (project && title.trim()) {
      api.updateProject(project.id, { title: title.trim() }).catch(() => {
        // Silently fail — title is cosmetic
      });
    }
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    saveTitle();
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveTitle();
      setIsEditingTitle(false);
    }
    if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  const handleBack = () => {
    router.push('/');
  };

  return (
    <header className="h-12 grid grid-cols-[auto_1fr_auto] items-center px-4 border-b border-[var(--editor-border-subtle)] bg-[var(--editor-bg-surface)]">
      {/* Left section: Back */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--editor-bg-hover)] active:scale-[0.97] transition-all text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)]"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Projects</span>
        </button>

        <div className="w-px h-5 bg-[var(--editor-border-subtle)]" />

        <CanvasFormatSelector />
      </div>

      {/* Center section: Title */}
      <div className="flex items-center justify-center gap-2 min-w-0">
        {isEditingTitle ? (
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            className="bg-[var(--editor-bg-elevated)] text-[var(--editor-text-primary)] text-sm font-medium
                       border border-[var(--editor-border-default)] rounded-md px-3 py-1
                       focus:outline-none focus:border-[var(--editor-border-focus)] focus:ring-2 focus:ring-[var(--editor-accent-soft)]"
          />
        ) : (
          <button
            onClick={handleTitleClick}
            className="text-[var(--editor-text-primary)] text-sm font-medium px-3 py-1
                       rounded-md hover:bg-[var(--editor-bg-hover)] transition-colors truncate max-w-[300px]"
          >
            {title}
          </button>
        )}

        {isSaving && (
          <span className="text-xs text-[var(--editor-text-muted)]">Saving...</span>
        )}
      </div>

      {/* Right section: Undo/Redo + Preview + Export */}
      <div className="flex items-center gap-2">
        {/* Undo/Redo buttons */}
        <div className="flex items-center gap-1">
          <button
            className="p-2 rounded-md hover:bg-[var(--editor-bg-hover)] active:scale-[0.97] transition-all text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)] disabled:opacity-40"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            className="p-2 rounded-md hover:bg-[var(--editor-bg-hover)] active:scale-[0.97] transition-all text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)] disabled:opacity-40"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Logs toggle - only show when there's an active job or logs are open */}
        {(hasActiveJob || isLogsActive) && (
          <button
            onClick={() => onToggleLogs?.()}
            title="Toggle Agent Logs"
            className={`relative p-2 rounded-md transition-colors ${
              isLogsActive
                ? 'bg-[var(--editor-accent-muted)] text-[var(--editor-accent)]'
                : 'hover:bg-[var(--editor-bg-hover)] text-[var(--editor-text-secondary)]'
            }`}
          >
            <Terminal className="w-4 h-4" />
            {hasActiveJob && !isLogsActive && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            )}
          </button>
        )}

        {/* Export button */}
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium
                     bg-[var(--editor-accent)] text-white shadow-sm
                     hover:bg-[var(--editor-accent-hover)] active:scale-[0.97] transition-all"
        >
          <Download className="w-4 h-4" />
          <span>Export</span>
        </button>

        {/* Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-2 rounded-md hover:bg-[var(--editor-bg-hover)] transition-colors"
              aria-label="Menu"
            >
              <MoreHorizontal className="w-4 h-4 text-[var(--editor-text-secondary)]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 bg-[var(--editor-bg-surface)] border border-[var(--editor-border-default)] shadow-lg"
          >
            <DropdownMenuItem
              onClick={saveProject}
              className="text-[var(--editor-text-primary)] focus:bg-[var(--editor-bg-hover)]"
            >
              Save project
              <span className="ml-auto text-xs text-[var(--editor-text-muted)]">⌘S</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[var(--editor-border-subtle)]" />
            <DropdownMenuItem className="text-[var(--editor-text-primary)] focus:bg-[var(--editor-bg-hover)]">
              Keyboard shortcuts
              <span className="ml-auto text-xs text-[var(--editor-text-muted)]">?</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="text-[var(--editor-text-primary)] focus:bg-[var(--editor-bg-hover)]">
              Help & feedback
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
