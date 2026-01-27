/**
 * Editor V2 Main Component
 * Minimal, Linear/Figma-inspired video editor
 */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

import { Header } from './components/Header';
import { PlaybackBar } from './components/PlaybackBar';
import { RightPanel, type RightPanelTab } from './components/RightPanel';
import { CommandPalette, useCommandPalette } from './components/CommandPalette';
import { Scene } from './scene/Scene';
import { SceneToolbar } from './scene/SceneToolbar';
import { type SocialPlatform, type OverlayMode } from './scene/social-platforms';
import { Timeline } from './timeline/Timeline';
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';
import {
  useProject,
  useIsLoading,
  useError,
  useEditorActions,
  useSelectedIds,
} from './store/use-editor-store';
import { wsClient, WSMessage, JobProgressPayload, JobCompletePayload } from '@/lib/ws';
import { api } from '@/lib/api';

interface EditorProps {
  projectId: string;
}

export function Editor({ projectId }: EditorProps) {
  // Right panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<RightPanelTab>('properties');
  const userRequestedTabRef = useRef<RightPanelTab | null>(null);

  const [timelineHeight, setTimelineHeight] = useState(220);
  const resizeRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Command palette
  const commandPalette = useCommandPalette();

  // Social preview state
  const [activePlatform, setActivePlatform] = useState<SocialPlatform | null>(null);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('mockup');
  const lastPlatformRef = useRef<SocialPlatform>('instagram');

  const handlePlatformChange = useCallback((platform: SocialPlatform | null) => {
    if (platform) lastPlatformRef.current = platform;
    setActivePlatform(platform);
  }, []);

  // Keyboard shortcut: P toggles overlay
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.code === 'KeyP' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setActivePlatform((prev) => (prev ? null : lastPlatformRef.current));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // State
  const project = useProject();
  const isLoading = useIsLoading();
  const error = useError();
  const selectedIds = useSelectedIds();

  // Actions
  const { loadProject, clearSelection, updateEnhancementStatus } = useEditorActions();

  // Toggle transcript panel
  const handleToggleTranscript = useCallback(() => {
    if (panelOpen && activeTab === 'transcript') {
      // Already showing transcript — close panel
      setPanelOpen(false);
      userRequestedTabRef.current = null;
    } else {
      // Open to transcript tab
      setPanelOpen(true);
      setActiveTab('transcript');
      userRequestedTabRef.current = 'transcript';
    }
  }, [panelOpen, activeTab]);

  // Handle tab change from panel header
  const handleTabChange = useCallback((tab: RightPanelTab) => {
    setActiveTab(tab);
    if (tab === 'transcript') {
      userRequestedTabRef.current = 'transcript';
    }
  }, []);

  // Handle closing the panel
  const handleClosePanel = useCallback(() => {
    setPanelOpen(false);
    userRequestedTabRef.current = null;
    if (activeTab === 'properties') {
      clearSelection();
    }
  }, [activeTab, clearSelection]);

  // Initialize keyboard shortcuts
  useKeyboardShortcuts({
    onToggleTranscript: handleToggleTranscript,
    onClosePanel: handleClosePanel,
  });

  // Load project on mount
  useEffect(() => {
    loadProject(projectId);
  }, [projectId, loadProject]);

  // WebSocket: listen for enhancement job progress
  useEffect(() => {
    if (!project?.id) return;

    wsClient.connect(project.id);

    const removeHandler = wsClient.addHandler((message: WSMessage) => {
      if (message.type === 'job:progress') {
        const payload = message.payload as JobProgressPayload & { audioItemId?: string };
        if (payload.audioItemId) {
          updateEnhancementStatus(
            payload.audioItemId,
            'processing',
            payload.progress,
          );
        }
      } else if (message.type === 'job:complete') {
        const payload = message.payload as JobCompletePayload & {
          audioItemId?: string;
          enhancedSrc?: string;
        };
        if (payload.audioItemId) {
          updateEnhancementStatus(
            payload.audioItemId,
            'complete',
            100,
            payload.enhancedSrc,
          );
        }
      } else if (message.type === 'job:error') {
        const payload = message.payload as { audioItemId?: string };
        if (payload.audioItemId) {
          updateEnhancementStatus(payload.audioItemId, 'error');
        }
      }
    });

    return () => {
      removeHandler();
    };
  }, [project?.id, updateEnhancementStatus]);

  // Auto-open properties when item is selected; restore transcript or close on deselect
  useEffect(() => {
    if (selectedIds.length > 0) {
      setPanelOpen(true);
      setActiveTab('properties');
    } else {
      // Deselected — restore transcript if user had it open, otherwise close
      if (userRequestedTabRef.current === 'transcript') {
        setActiveTab('transcript');
      } else {
        setPanelOpen(false);
      }
    }
  }, [selectedIds]);

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
  const handleExport = async () => {
    if (!project) return;
    try {
      const { jobId } = await api.renderProject(project.id);
      // Show notification or progress indicator
      console.log('Render started:', jobId);
    } catch (err) {
      console.error('Export failed:', err);
    }
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
        onToggleTranscript={handleToggleTranscript}
        isTranscriptActive={panelOpen && activeTab === 'transcript'}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Scene/Preview with collapsible right panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Scene */}
          <div className="flex-1 relative min-w-0">
            <Scene className="w-full h-full" activePlatform={activePlatform} overlayMode={overlayMode} />
          </div>

          {/* Right Panel */}
          <RightPanel
            isOpen={panelOpen}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onClose={handleClosePanel}
          />
        </div>

        {/* Playback Bar */}
        <PlaybackBar />

        {/* Resize handle + toolbar above timeline */}
        <div
          ref={resizeRef}
          onMouseDown={handleResizeStart}
          className="h-1 bg-[var(--editor-border-subtle)] hover:bg-[var(--editor-accent)]
                     cursor-ns-resize transition-colors"
        />
        <div className="flex-shrink-0 flex items-center px-2 py-1 border-b border-[var(--editor-border-subtle)] bg-[var(--editor-bg-surface)]">
          <SceneToolbar
            activePlatform={activePlatform}
            overlayMode={overlayMode}
            onPlatformChange={handlePlatformChange}
            onModeChange={setOverlayMode}
          />
        </div>

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
