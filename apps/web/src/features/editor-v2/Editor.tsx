/**
 * Editor V2 Main Component
 * Minimal, Linear/Figma-inspired video editor
 */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, MessageSquareText, Captions, Paintbrush, PanelsTopLeft, FolderOpen, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Header } from './components/Header';
import { PlaybackBar } from './components/PlaybackBar';
import { RightPanel, type RightPanelTab } from './components/RightPanel';
import { StylePanel } from './panels/StylePanel';
import { CommandPalette, useCommandPalette } from './components/CommandPalette';
import { JobLogsPanel } from './components/JobLogsPanel';
import { ExportModal } from './components/ExportModal';
import { TransitionPickerModal } from './components/TransitionPickerModal';
import { AIAssistantPanel } from './components/AIAssistantPanel';
import { Scene } from './scene/Scene';
import { SceneToolbar } from './scene/SceneToolbar';
import { type SocialPlatform, type OverlayMode } from './scene/social-platforms';
import { Timeline } from './timeline/Timeline';
import { AssetsPanel } from './panels/AssetsPanel';
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';
import { useJobWebSocket } from './hooks/use-job-websocket';
import { useWorkspaceWS } from './hooks/use-workspace-ws';
import {
  useProject,
  useIsLoading,
  useError,
  useEditorActions,
  useSelectedIds,
  useCaptionItems,
  useAIEditRequested,
  useEditorStore,
  useIsDirty,
} from './store/use-editor-store';
import { wsClient, WSMessage, JobProgressPayload, JobCompletePayload } from '@/lib/ws';
import { api } from '@/lib/api';
import { clearCompositionCache } from './player/useWorkspaceComposition';

interface EditorProps {
  projectId: string;
}

export function Editor({ projectId }: EditorProps) {
  // Layout state - simplified unified layout
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [leftSidebarTab, setLeftSidebarTab] = useState<'captions' | 'style' | 'layout' | 'assets' | 'agent'>('agent');

  // Right panel state (settings/properties)
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<RightPanelTab>('properties');
  const userRequestedTabRef = useRef<RightPanelTab | null>(null);

  // AI Assistant panel
  // AI panel is now a left sidebar tab ('agent')

  const [timelineHeight, setTimelineHeight] = useState(250);
  const resizeRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Main content area ref
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Command palette
  const commandPalette = useCommandPalette();

  // Social preview state
  const [activePlatform, setActivePlatform] = useState<SocialPlatform | null>(null);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('mockup');
  const lastPlatformRef = useRef<SocialPlatform>('instagram');

  // Job logs panel state
  const [showLogsPanel, setShowLogsPanel] = useState(false);

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);

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
  const captionItems = useCaptionItems();

  // Workspace state
  const workspaceLockHolder = useEditorStore((s) => s.workspaceLockHolder);
  const workspaceBundleError = useEditorStore((s) => s.workspaceBundleError);

  // Actions
  const { loadProject, reloadVisuals, refreshMediaUrls, clearSelection, updateEnhancementStatus, setInspectModeEnabled, pause } = useEditorActions();

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
    onClosePanel: handleClosePanel,
    onToggleInspectMode: useCallback(() => {
      const state = useEditorStore.getState();
      const next = !state.inspectModeEnabled;
      setInspectModeEnabled(next);
      if (next && state.isPlaying) pause();
    }, [setInspectModeEnabled, pause]),
  });

  // Warn before navigating away with unsaved changes
  const isDirty = useIsDirty();
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Load project on mount
  useEffect(() => {
    loadProject(projectId);
  }, [projectId, loadProject]);

  // Periodically refresh presigned media URLs before they expire (TTL = 8h, refresh every 3h)
  useEffect(() => {
    const REFRESH_INTERVAL = 3 * 60 * 60 * 1000; // 3 hours
    const timer = setInterval(() => {
      refreshMediaUrls(projectId);
    }, REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [projectId, refreshMediaUrls]);

  // Open AI sidebar when "Edit with AI" is requested from context menu
  const aiEditRequested = useAIEditRequested();
  useEffect(() => {
    if (aiEditRequested) {
      setLeftSidebarOpen(true);
      setLeftSidebarTab('agent');
    }
  }, [aiEditRequested]);

  // Workspace WebSocket events (Plan 3)
  useWorkspaceWS(projectId, {
    onWorkspaceReady: (data) => {
      useEditorStore.getState().setWorkspaceStatus('active');
      if (data.bundleUrl) {
        useEditorStore.getState().setWorkspaceBundleUrl(data.bundleUrl);
      }
    },
    onManifestUpdated: async (data) => {
      if (data.source === 'ai' && projectId) {
        try {
          const manifest = await api.readSandboxManifest(projectId);
          useEditorStore.getState().applyRemoteManifestUpdate(manifest);
        } catch (err) {
          console.error('Failed to apply remote manifest update:', err);
        }
      }
    },
    onBundleReady: (data) => {
      const s = useEditorStore.getState();
      s.setWorkspaceBundleError(null);
      s.incrementBundleVersion();
      if (data.bundleUrl) {
        s.setWorkspaceBundleUrl(data.bundleUrl);
      }
    },
    onBundleError: (data) => {
      useEditorStore.getState().setWorkspaceBundleError(data.error);
    },
    onLockAcquired: (data) => {
      useEditorStore.getState().setWorkspaceLockHolder(data.holder);
    },
    onLockReleased: () => {
      useEditorStore.getState().setWorkspaceLockHolder(null);
    },
    onWorkspaceTeardown: () => {
      const s = useEditorStore.getState();
      s.setWorkspaceStatus('inactive');
      s.setWorkspaceBundleUrl(null);
      s.setWorkspaceLockHolder(null);
    },
  });

  // Sandbox cleanup on unmount
  useEffect(() => {
    return () => {
      const state = useEditorStore.getState();
      if (state.project && state.sandboxStatus === 'ready') {
        api.suspendSandbox(state.project.id).catch((err: any) => {
          console.warn('Failed to suspend sandbox on unmount:', err);
        });
      }
    };
  }, []);

  // Exit inspect mode and clear element selection when playback starts
  const isPlaying = useEditorStore((s) => s.isPlaying);
  useEffect(() => {
    if (isPlaying) {
      const state = useEditorStore.getState();
      if (state.inspectModeEnabled || state.selectedElement || state.elementPickerEnabled) {
        useEditorStore.setState({
          inspectModeEnabled: false,
          selectedElement: null,
          elementPickerEnabled: false,
        });
      }
    }
  }, [isPlaying]);

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

  // Note: Sidebar no longer auto-opens on selection to allow easy multi-select
  // Users can open Style panel manually via icon rail after selecting captions

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
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle YouTube clip added from assets panel
  const handleYouTubeClipAdded = useCallback((clip: { clipId: string; duration: number; clipUrl: string; sourceTitle?: string; frameStyle?: string; startSeconds: number; endSeconds: number; sourceUrl: string }) => {
    const state = useEditorStore.getState();
    const { tracks, fps: currentFps } = state;
    const visualTrack = tracks.find((t) => t.type === 'visual');
    if (!visualTrack) {
      console.warn('[Editor] No visual track found for YouTube clip');
      return;
    }
    state.addItem(visualTrack.id, {
      type: 'visual',
      startMs: 0,
      endMs: clip.duration * 1000,
      data: {
        visualId: `youtube-clip-${clip.clipId}`,
        compositionId: `youtube-clip-${clip.clipId}`,
        bundleUrl: '',
        type: 'youtube-clip',
        description: clip.sourceTitle || 'YouTube Clip',
        width: 1920,
        height: 1080,
        fps: currentFps,
        templateId: 'youtube-clip',
        templateProps: {
          clipUrl: clip.clipUrl,
          frame: clip.frameStyle || 'browser',
          trimStartSeconds: clip.startSeconds,
          trimEndSeconds: clip.endSeconds,
          backgroundColor: '#000000',
          muted: false,
          volume: 1,
        },
        sourceSceneId: 1, // Manual clips get scene 1; render uses this for clip path mapping
        sourceVideoUrl: clip.sourceUrl,
        videoUrl: clip.clipUrl,
        hasVideo: true,
      },
    });
  }, []);

  // Handle export
  const handleExport = () => {
    if (!project) return;
    setShowExportModal(true);
  };

  // Generate visuals state (used by job WebSocket tracking and logs panel)
  const [visualsJobId, setVisualsJobId] = useState<string | null>(null);
  const [visualsProgress, setVisualsProgress] = useState(0);
  const [visualsStatus, setVisualsStatus] = useState<string>('');
  const [visualsError, setVisualsError] = useState<string | null>(null);
  const [visualsComplete, setVisualsComplete] = useState(false);
  const [isGeneratingVisuals, setIsGeneratingVisuals] = useState(false);

  // WebSocket for real-time job updates
  const { isConnected: wsConnected, subscribeToJob, unsubscribeFromJob } = useJobWebSocket(
    project?.id ?? null,
    {
      onProgress: (data) => {
        if (data.jobId === visualsJobId) {
          setVisualsProgress(data.progress || 0);
          if (data.message) {
            setVisualsStatus(data.message);
          }
        }
      },
      onComplete: async (data) => {
        if (data.jobId === visualsJobId) {
          setVisualsStatus('Complete!');
          setIsGeneratingVisuals(false);
          setVisualsComplete(true);

          // Clear cached bundle so workspace composition fetches fresh content
          clearCompositionCache();

          // Reload visuals only (preserves playback position and selection)
          if (project?.id) {
            reloadVisuals(project.id);
          }

          setVisualsJobId(null);
        }
      },
      onError: (data) => {
        if (data.jobId === visualsJobId) {
          setVisualsStatus('Failed');
          setVisualsError(data.error || 'Unknown error occurred');
          setIsGeneratingVisuals(false);
          setVisualsJobId(null);
        }
      },
    }
  );

  // Subscribe to job when it starts
  useEffect(() => {
    if (visualsJobId && wsConnected) {
      subscribeToJob(visualsJobId);
      return () => unsubscribeFromJob(visualsJobId);
    }
  }, [visualsJobId, wsConnected, subscribeToJob, unsubscribeFromJob]);

  // Fallback polling when WebSocket is not connected
  useEffect(() => {
    if (!visualsJobId || !isGeneratingVisuals) return;
    // If WebSocket is connected, skip polling
    if (wsConnected) return;

    const pollInterval = setInterval(async () => {
      try {
        const job = await api.getJob(visualsJobId);
        setVisualsProgress(job.progress || 0);

        if (job.status === 'complete') {
          setVisualsStatus('Complete!');
          setIsGeneratingVisuals(false);
          setVisualsComplete(true);

          // Clear cached bundle so workspace composition fetches fresh content
          clearCompositionCache();

          // Reload visuals only (preserves playback position and selection)
          if (project?.id) {
            reloadVisuals(project.id);
          }

          setVisualsJobId(null);
        } else if (job.status === 'failed' || job.status === 'cancelled') {
          const errorMsg = job.status === 'cancelled'
            ? 'Generation was cancelled'
            : (job.error || 'Unknown error occurred');
          setVisualsStatus(job.status === 'cancelled' ? 'Cancelled' : 'Failed');
          setVisualsError(errorMsg);
          setIsGeneratingVisuals(false);
          setVisualsJobId(null);
        } else if (job.status === 'processing') {
          setVisualsStatus('Generating visuals with AI...');
        }
      } catch (err) {
        console.error('Failed to poll job status:', err);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [visualsJobId, isGeneratingVisuals, project, reloadVisuals, wsConnected]);

  // Cancel visual generation
  const handleCancelVisuals = async () => {
    if (!visualsJobId) return;
    try {
      await api.cancelJob(visualsJobId);
      setVisualsStatus('Cancelling...');
    } catch (err) {
      console.error('Failed to cancel job:', err);
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
    <div className="editor-theme flex h-screen w-screen flex-col bg-[var(--editor-bg-base)] overflow-hidden select-none antialiased">
      {/* Header */}
      <Header
        onOpenCommandPalette={commandPalette.open}
        onExport={handleExport}
        onToggleLogs={() => setShowLogsPanel(!showLogsPanel)}
        isLogsActive={showLogsPanel}
        hasActiveJob={!!visualsJobId}
      />

      {/* Main content area - unified layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Icon Rail - always visible */}
        <div className="w-14 flex flex-col items-center py-2 bg-[var(--editor-bg-surface)] border-r border-[var(--editor-border-subtle)] flex-shrink-0">
          <button
            onClick={() => {
              if (leftSidebarOpen && leftSidebarTab === 'agent') {
                setLeftSidebarOpen(false);
              } else {
                setLeftSidebarTab('agent');
                setLeftSidebarOpen(true);
              }
            }}
            className={`icon-rail-item w-12 ${leftSidebarOpen && leftSidebarTab === 'agent' ? 'active' : ''}`}
            title="Chat"
          >
            <MessageSquareText className="w-5 h-5" />
            <span className="text-[11px]">Chat</span>
          </button>
          <button
            onClick={() => {
              if (leftSidebarOpen && leftSidebarTab === 'captions') {
                setLeftSidebarOpen(false);
              } else {
                setLeftSidebarTab('captions');
                setLeftSidebarOpen(true);
              }
            }}
            className={`icon-rail-item w-12 ${leftSidebarOpen && leftSidebarTab === 'captions' ? 'active' : ''}`}
            title="Captions"
          >
            <Captions className="w-5 h-5" />
            <span className="text-[11px]">Captions</span>
          </button>
          <button
            onClick={() => {
              if (leftSidebarOpen && leftSidebarTab === 'style') {
                setLeftSidebarOpen(false);
              } else {
                setLeftSidebarTab('style');
                setLeftSidebarOpen(true);
              }
            }}
            className={`icon-rail-item w-12 ${leftSidebarOpen && leftSidebarTab === 'style' ? 'active' : ''}`}
            title="Style"
          >
            <Paintbrush className="w-5 h-5" />
            <span className="text-[11px]">Style</span>
          </button>
          <button
            onClick={() => {
              if (leftSidebarOpen && leftSidebarTab === 'layout') {
                setLeftSidebarOpen(false);
              } else {
                setLeftSidebarTab('layout');
                setLeftSidebarOpen(true);
              }
            }}
            className={`icon-rail-item w-12 ${leftSidebarOpen && leftSidebarTab === 'layout' ? 'active' : ''}`}
            title="Layout"
          >
            <PanelsTopLeft className="w-5 h-5" />
            <span className="text-[11px]">Layout</span>
          </button>
          <button
            onClick={() => {
              if (leftSidebarOpen && leftSidebarTab === 'assets') {
                setLeftSidebarOpen(false);
              } else {
                setLeftSidebarTab('assets');
                setLeftSidebarOpen(true);
              }
            }}
            className={`icon-rail-item w-12 ${leftSidebarOpen && leftSidebarTab === 'assets' ? 'active' : ''}`}
            title="Assets"
          >
            <FolderOpen className="w-5 h-5" />
            <span className="text-[11px]">Assets</span>
          </button>
        </div>

        {/* Left Sidebar Panel */}
        <AnimatePresence mode="wait">
          {leftSidebarOpen && leftSidebarTab === 'agent' && (
            <motion.div
              key="agent-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 488, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="flex-shrink-0 overflow-hidden"
            >
              <ErrorBoundary name="AI Assistant">
                <AIAssistantPanel
                  projectId={project.id}
                  onEditComplete={() => reloadVisuals(project.id)}
                  className="w-[488px]"
                />
              </ErrorBoundary>
            </motion.div>
          )}
          {leftSidebarOpen && leftSidebarTab !== 'agent' && (
            <motion.div
              key={`sidebar-${leftSidebarTab}`}
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 488, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="flex-shrink-0 overflow-hidden"
            >
              <div className="w-[488px] flex flex-col h-full bg-[var(--editor-bg-surface)] border-r border-[var(--editor-border-subtle)] overflow-hidden">
                <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0">
                  <h3 className="text-xs font-medium text-[var(--editor-text-muted)] uppercase tracking-wide">
                    {leftSidebarTab === 'captions' && 'Caption Settings'}
                    {leftSidebarTab === 'style' && 'Style Settings'}
                    {leftSidebarTab === 'layout' && 'Layout Settings'}
                    {leftSidebarTab === 'assets' && 'Visual Assets'}
                  </h3>
                  <button
                    onClick={() => setLeftSidebarOpen(false)}
                    className="p-1 rounded-md hover:bg-[var(--editor-bg-hover)] text-[var(--editor-text-muted)] active:scale-[0.97] transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {leftSidebarTab === 'captions' && (
                    <div className="px-4 pb-4">
                      <RightPanel
                        isOpen={true}
                        activeTab="transcript"
                        onTabChange={handleTabChange}
                        onClose={handleClosePanel}
                        layout="stacked"
                        embedded={true}
                      />
                    </div>
                  )}
                  {leftSidebarTab === 'style' && (
                    <ErrorBoundary name="Style Panel">
                      <StylePanel />
                    </ErrorBoundary>
                  )}
                  {leftSidebarTab === 'layout' && (
                    <div className="px-4 pb-4">
                      <RightPanel
                        isOpen={true}
                        activeTab="layout"
                        onTabChange={handleTabChange}
                        onClose={handleClosePanel}
                        layout="stacked"
                        embedded={true}
                      />
                    </div>
                  )}
                  {leftSidebarTab === 'assets' && (
                    <AssetsPanel
                      onEditWithAI={() => {
                        setLeftSidebarTab('agent');
                        useEditorStore.setState({ aiEditRequested: true });
                      }}
                      onYouTubeClipAdded={handleYouTubeClipAdded}
                    />
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Video Preview Area */}
          <div className="flex-1 relative bg-[var(--editor-bg-canvas)] overflow-hidden">
            {/* Workspace status indicators */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end">
              {workspaceLockHolder === 'ai' && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded-lg text-purple-300 text-sm">
                  <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                  AI is editing...
                </div>
              )}
              {workspaceBundleError && (
                <div className="px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
                  Bundle error: {workspaceBundleError}
                </div>
              )}
            </div>

            {/* Zoom control */}
            <div className="absolute top-4 left-4 z-10">
              <Select defaultValue="fit">
                <SelectTrigger className="h-7 w-[72px] text-xs bg-[var(--editor-bg-surface)]/90 backdrop-blur-sm border-[var(--editor-border-subtle)] text-[var(--editor-text-secondary)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--editor-bg-surface)] border-[var(--editor-border-default)]">
                  <SelectItem value="fit" className="text-xs">Fit</SelectItem>
                  <SelectItem value="50" className="text-xs">50%</SelectItem>
                  <SelectItem value="75" className="text-xs">75%</SelectItem>
                  <SelectItem value="100" className="text-xs">100%</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Scene */}
            <ErrorBoundary name="Scene">
              <Scene className="w-full h-full" activePlatform={activePlatform} overlayMode={overlayMode} padding={24} />
            </ErrorBoundary>
          </div>

          {/* Transport Controls */}
          <PlaybackBar />

          {/* Timeline resize handle */}
          <div
            ref={resizeRef}
            onMouseDown={(e) => {
              document.body.style.cursor = 'ns-resize';
              handleResizeStart(e);
            }}
            className="h-1.5 bg-[var(--editor-border-subtle)] hover:bg-[var(--editor-accent)]
                       cursor-ns-resize transition-colors flex items-center justify-center group"
          >
            <div className="w-8 h-0.5 rounded-full bg-[var(--editor-text-muted)]/30 group-hover:bg-white/60 transition-colors" />
          </div>

          {/* Agent Logs Panel */}
          <JobLogsPanel
            projectId={project.id}
            jobId={visualsJobId}
            isOpen={showLogsPanel}
            onClose={() => setShowLogsPanel(false)}
            isGenerating={isGeneratingVisuals}
            progress={visualsProgress}
            status={visualsStatus}
            error={visualsError}
            isComplete={visualsComplete}
            onCancel={handleCancelVisuals}
          />

          {/* Timeline */}
          <div style={{ height: timelineHeight }} className="flex-shrink-0 bg-[var(--editor-bg-surface)] border-t border-[var(--editor-border-subtle)]">
            <ErrorBoundary name="Timeline">
              <Timeline className="h-full" />
            </ErrorBoundary>
          </div>
        </div>

      </div>

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPalette.isOpen}
        onClose={commandPalette.close}
      />

      {/* Export Modal */}
      <ExportModal
        open={showExportModal}
        onOpenChange={setShowExportModal}
        projectId={project.id}
        projectStatus={project.status}
        hasOutputKey={!!project.outputKey}
      />

      {/* Transition Picker Modal */}
      <TransitionPickerModal />
    </div>
  );
}
