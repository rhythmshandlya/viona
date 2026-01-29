/**
 * Editor Header Component
 * Minimal header with back, title, command palette hint, export, and menu
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Columns2, Command, MessageSquare, MoreHorizontal, Sparkles, Terminal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProject, useEditorActions, useIsSaving } from '../store/use-editor-store';
import { api } from '@/lib/api';

interface HeaderProps {
  onOpenCommandPalette?: () => void;
  onExport?: () => void;
  onToggleTranscript?: () => void;
  isTranscriptActive?: boolean;
  layout?: 'stacked' | 'side-by-side';
  onToggleLayout?: () => void;
  onGenerateVisuals?: () => void;
  isGeneratingVisuals?: boolean;
  hasTranscript?: boolean;
  onToggleLogs?: () => void;
  isLogsActive?: boolean;
  hasActiveJob?: boolean;
}

export function Header({ onOpenCommandPalette, onExport, onToggleTranscript, isTranscriptActive, layout, onToggleLayout, onGenerateVisuals, isGeneratingVisuals, hasTranscript, onToggleLogs, isLogsActive, hasActiveJob }: HeaderProps) {
  const router = useRouter();
  const project = useProject();
  const { saveProject } = useEditorActions();
  const isSaving = useIsSaving();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState('Untitled Project');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleClick = () => {
    setIsEditingTitle(true);
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (project && title.trim()) {
      api.updateProject(project.id, { title: title.trim() }).catch(() => {
        // Silently fail — title is cosmetic
      });
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
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
    <header className="h-12 flex items-center justify-between px-3 border-b border-[var(--editor-border-subtle)] bg-[var(--editor-bg-base)]">
      {/* Left section: Back + Title */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleBack}
          className="editor-btn-ghost p-2 rounded-md hover:bg-[var(--editor-bg-hover)] transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4 text-[var(--editor-text-secondary)]" />
        </button>

        {isEditingTitle ? (
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            className="bg-transparent text-[var(--editor-text-primary)] text-sm font-medium
                       border border-[var(--editor-border-default)] rounded px-2 py-1
                       focus:outline-none focus:border-[var(--editor-border-focus)]"
          />
        ) : (
          <button
            onClick={handleTitleClick}
            className="text-[var(--editor-text-primary)] text-sm font-medium px-2 py-1
                       rounded hover:bg-[var(--editor-bg-hover)] transition-colors
                       border border-transparent hover:border-[var(--editor-border-default)]"
          >
            {title}
          </button>
        )}

        {isSaving && (
          <span className="text-xs text-[var(--editor-text-muted)]">Saving...</span>
        )}
      </div>

      {/* Right section: Transcript toggle + Command palette hint + Export + Menu */}
      <div className="flex items-center gap-2">
        {/* Transcript toggle */}
        <button
          onClick={() => onToggleTranscript?.()}
          className={`p-2 rounded-md transition-colors ${
            isTranscriptActive
              ? 'bg-[var(--editor-accent-muted)] text-[var(--editor-accent)]'
              : 'hover:bg-[var(--editor-bg-hover)]'
          }`}
          title="Toggle Transcript (T)"
        >
          <MessageSquare className={`w-4 h-4 ${
            isTranscriptActive
              ? 'text-[var(--editor-accent)]'
              : 'text-[var(--editor-text-secondary)]'
          }`} />
        </button>

        {/* Layout toggle */}
        <button
          onClick={() => onToggleLayout?.()}
          title="Toggle side-by-side layout (L)"
          className={`p-2 rounded-md transition-colors ${
            layout === 'side-by-side'
              ? 'bg-[var(--editor-accent-muted)] text-[var(--editor-accent)]'
              : 'hover:bg-[var(--editor-bg-hover)]'
          }`}
        >
          <Columns2 className={`w-4 h-4 ${
            layout === 'side-by-side'
              ? 'text-[var(--editor-accent)]'
              : 'text-[var(--editor-text-secondary)]'
          }`} />
        </button>

        {/* Logs toggle - only show when there's an active job or logs are open */}
        {(hasActiveJob || isLogsActive) && (
          <button
            onClick={() => onToggleLogs?.()}
            title="Toggle Agent Logs"
            className={`relative p-2 rounded-md transition-colors ${
              isLogsActive
                ? 'bg-[var(--editor-accent-muted)] text-[var(--editor-accent)]'
                : 'hover:bg-[var(--editor-bg-hover)]'
            }`}
          >
            <Terminal className={`w-4 h-4 ${
              isLogsActive
                ? 'text-[var(--editor-accent)]'
                : 'text-[var(--editor-text-secondary)]'
            }`} />
            {hasActiveJob && !isLogsActive && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            )}
          </button>
        )}

        {/* Command palette hint */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md
                     text-[var(--editor-text-muted)] text-xs
                     hover:bg-[var(--editor-bg-hover)] hover:text-[var(--editor-text-secondary)]
                     transition-colors"
        >
          <Command className="w-3 h-3" />
          <span>K</span>
        </button>

        {/* Generate Visuals button - only show when transcript exists */}
        {hasTranscript && (
          <button
            onClick={onGenerateVisuals}
            disabled={isGeneratingVisuals}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
                       bg-gradient-to-r from-purple-500 to-cyan-500 text-white
                       hover:from-purple-600 hover:to-cyan-600 transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
            title="Generate AI Visuals"
          >
            {isGeneratingVisuals ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>AI Visuals</span>
              </>
            )}
          </button>
        )}

        {/* Export button */}
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
                     bg-[var(--editor-accent)] text-[var(--editor-bg-base)]
                     hover:bg-[var(--editor-accent-hover)] transition-colors"
        >
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
            className="w-48 bg-[var(--editor-bg-elevated)] border-[var(--editor-border-default)]"
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
