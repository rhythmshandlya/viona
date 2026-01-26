/**
 * Editor V2 Main Component
 * Minimal, Linear/Figma-inspired video editor
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

import { Header } from './components/Header';
import { PlaybackBar } from './components/PlaybackBar';
import { ContextPanel } from './components/ContextPanel';
import { CommandPalette, useCommandPalette } from './components/CommandPalette';
import { Scene } from './scene/Scene';
import { Timeline } from './timeline/Timeline';
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';
import {
  useProject,
  useIsLoading,
  useError,
  useEditorActions,
  useSelectedIds,
} from './store/use-editor-store';

interface EditorProps {
  projectId: string;
}

export function Editor({ projectId }: EditorProps) {
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [timelineHeight, setTimelineHeight] = useState(120);
  const resizeRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Command palette
  const commandPalette = useCommandPalette();

  // State
  const project = useProject();
  const isLoading = useIsLoading();
  const error = useError();
  const selectedIds = useSelectedIds();

  // Actions
  const { loadProject, clearSelection } = useEditorActions();

  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  // Load project on mount
  useEffect(() => {
    loadProject(projectId);
  }, [projectId, loadProject]);

  // Show context panel when item is selected
  useEffect(() => {
    if (selectedIds.length > 0) {
      setShowContextPanel(true);
    }
  }, [selectedIds]);

  // Handle closing context panel
  const handleCloseContextPanel = () => {
    setShowContextPanel(false);
    clearSelection();
  };

  // Handle timeline resize
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;

    const startY = e.clientY;
    const startHeight = timelineHeight;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaY = startY - e.clientY;
      const newHeight = Math.max(80, Math.min(400, startHeight + deltaY));
      setTimelineHeight(newHeight);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle export
  const handleExport = () => {
    // TODO: Implement export
    console.log('Export clicked');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="editor-theme min-h-screen flex items-center justify-center bg-[var(--editor-bg-base)]">
        <div className="flex items-center gap-3 text-[var(--editor-text-primary)]">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--editor-accent)]" />
          <span className="text-sm">Loading project...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="editor-theme min-h-screen flex items-center justify-center bg-[var(--editor-bg-base)]">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-sm">{error}</p>
          <Link
            href="/upload"
            className="text-[var(--editor-accent)] text-sm hover:underline"
          >
            Upload a new video
          </Link>
        </div>
      </div>
    );
  }

  // No project state
  if (!project) {
    return (
      <div className="editor-theme min-h-screen flex items-center justify-center bg-[var(--editor-bg-base)]">
        <div className="flex items-center gap-3 text-[var(--editor-text-primary)]">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--editor-accent)]" />
          <span className="text-sm">Preparing editor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-theme flex h-screen w-screen flex-col bg-[var(--editor-bg-base)] overflow-hidden">
      {/* Header */}
      <Header
        onOpenCommandPalette={commandPalette.open}
        onExport={handleExport}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Scene/Preview - takes all available space */}
        <div className="flex-1 relative">
          <Scene className="w-full h-full" />

          {/* Context Panel - slides in from right */}
          {showContextPanel && selectedIds.length > 0 && (
            <ContextPanel onClose={handleCloseContextPanel} />
          )}
        </div>

        {/* Playback Bar */}
        <PlaybackBar />

        {/* Resize handle */}
        <div
          ref={resizeRef}
          onMouseDown={handleResizeStart}
          className="h-1 bg-[var(--editor-border-subtle)] hover:bg-[var(--editor-accent)]
                     cursor-ns-resize transition-colors"
        />

        {/* Timeline */}
        <div style={{ height: timelineHeight }} className="flex-shrink-0">
          <Timeline className="h-full" />
        </div>
      </div>

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPalette.isOpen}
        onClose={commandPalette.close}
      />
    </div>
  );
}
