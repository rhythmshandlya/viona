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
import { StylePanel } from './panels/StylePanel';
import { CommandPalette, useCommandPalette } from './components/CommandPalette';
import { StyleSelectionModal } from './components/StyleSelectionModal';
import { JobLogsPanel } from './components/JobLogsPanel';
import { ExportModal } from './components/ExportModal';
import { AIAssistantPanel } from './components/AIAssistantPanel';
import { Scene } from './scene/Scene';
import { SceneToolbar } from './scene/SceneToolbar';
import { type SocialPlatform, type OverlayMode } from './scene/social-platforms';
import { Timeline } from './timeline/Timeline';
import { AssetsPanel } from './panels/AssetsPanel';
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';
import { useJobWebSocket } from './hooks/use-job-websocket';
import {
  useProject,
  useIsLoading,
  useError,
  useEditorActions,
  useSelectedIds,
  useCaptionItems,
  useAIEditRequested,
  useEditorStore,
} from './store/use-editor-store';
import { wsClient, WSMessage, JobProgressPayload, JobCompletePayload } from '@/lib/ws';
import { api, GenerateVisualsOptions, JobMetrics } from '@/lib/api';

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

  // AI Visuals generation state
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [isGeneratingVisuals, setIsGeneratingVisuals] = useState(false);
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
  const hasTranscript = captionItems.length > 0;

  // Actions
  const { loadProject, reloadVisuals, clearSelection, updateEnhancementStatus } = useEditorActions();

  // Toggle transcript panel - opens left sidebar to captions tab
  const handleToggleTranscript = useCallback(() => {
    if (leftSidebarTab === 'captions' && leftSidebarOpen) {
      setLeftSidebarOpen(false);
    } else {
      setLeftSidebarOpen(true);
      setLeftSidebarTab('captions');
    }
  }, [leftSidebarTab, leftSidebarOpen]);

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

  // Open AI sidebar when "Edit with AI" is requested from context menu
  const aiEditRequested = useAIEditRequested();
  useEffect(() => {
    if (aiEditRequested) {
      setLeftSidebarOpen(true);
      setLeftSidebarTab('agent');
    }
  }, [aiEditRequested]);

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
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle export
  const handleExport = () => {
    if (!project) return;
    setShowExportModal(true);
  };

  // Generate visuals state
  const [visualsJobId, setVisualsJobId] = useState<string | null>(null);
  const [visualsProgress, setVisualsProgress] = useState(0);
  const [visualsStatus, setVisualsStatus] = useState<string>('');
  const [visualsError, setVisualsError] = useState<string | null>(null);
  const [visualsComplete, setVisualsComplete] = useState(false);
  const [visualsMetrics, setVisualsMetrics] = useState<JobMetrics | null>(null);
  const [visualsPreviewUrl, setVisualsPreviewUrl] = useState<string | null>(null);

  // Handle generate visuals
  const handleOpenStyleModal = () => {
    setShowStyleModal(true);
  };

  const handleGenerateVisuals = async (options: GenerateVisualsOptions) => {
    if (!project) return;
    setIsGeneratingVisuals(true);
    setVisualsProgress(0);
    setVisualsStatus('Starting...');
    setVisualsError(null); // Clear any previous error
    setVisualsComplete(false); // Reset completion state
    setVisualsMetrics(null);
    setVisualsPreviewUrl(null);
    try {
      const { jobId } = await api.generateVisuals(project.id, options);
      console.log('Visual generation started:', jobId, options);
      setVisualsJobId(jobId);
      setShowLogsPanel(true); // Auto-open logs panel
      setShowStyleModal(false); // Close modal - progress shown in logs panel
    } catch (err) {
      console.error('Visual generation failed:', err);
      setIsGeneratingVisuals(false);
      setShowStyleModal(false);
    }
  };

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

          // Fetch job to get metrics
          try {
            const job = await api.getJob(data.jobId);
            if (job.metrics) {
              setVisualsMetrics(job.metrics);
            }
          } catch (err) {
            console.error('Failed to fetch job metrics:', err);
          }

          // Reload visuals only (preserves playback position and selection)
          if (project?.id) {
            reloadVisuals(project.id);
          }

          setVisualsJobId(null);
          setShowStyleModal(true); // Re-open modal to show completion
        }
      },
      onError: (data) => {
        if (data.jobId === visualsJobId) {
          setVisualsStatus('Failed');
          setVisualsError(data.error || 'Unknown error occurred');
          setIsGeneratingVisuals(false);
          setVisualsJobId(null);
          setShowStyleModal(true); // Re-open modal to show error
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

          // Set metrics from job
          if (job.metrics) {
            setVisualsMetrics(job.metrics);
          }

          // Reload visuals only (preserves playback position and selection)
          if (project?.id) {
            reloadVisuals(project.id);
          }

          setVisualsJobId(null);
          setShowStyleModal(true); // Re-open modal to show completion
        } else if (job.status === 'failed' || job.status === 'cancelled') {
          const errorMsg = job.status === 'cancelled'
            ? 'Generation was cancelled'
            : (job.error || 'Unknown error occurred');
          setVisualsStatus(job.status === 'cancelled' ? 'Cancelled' : 'Failed');
          setVisualsError(errorMsg);
          setIsGeneratingVisuals(false);
          setVisualsJobId(null);
          setShowStyleModal(true); // Re-open modal to show error
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

  // Confirm adding visuals to timeline
  const handleConfirmAddVisuals = () => {
    // Reload visuals only (preserves playback position and selection)
    reloadVisuals(project!.id);
    // Reset all states and close modal
    setShowStyleModal(false);
    setVisualsComplete(false);
    setVisualsMetrics(null);
    setVisualsPreviewUrl(null);
  };

  // Discard generated visuals (delete from database and close modal)
  const handleDiscardVisuals = async () => {
    if (!project) return;

    // If visuals were generated, delete them from the database
    if (visualsComplete) {
      try {
        await api.deleteVisuals(project.id);
        console.log('Visuals deleted successfully');
      } catch (err) {
        console.error('Failed to delete visuals:', err);
      }
    }

    setShowStyleModal(false);
    setVisualsComplete(false);
    setVisualsMetrics(null);
    setVisualsPreviewUrl(null);
    setVisualsError(null);
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
        onGenerateVisuals={handleOpenStyleModal}
        isGeneratingVisuals={isGeneratingVisuals}
        hasTranscript={hasTranscript}
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
            title="AI Agent"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3l1.5 3.7 3.8.6-2.7 2.7.6 3.8L12 12l-3.2 1.8.6-3.8L6.7 7.3l3.8-.6L12 3z" />
              <path d="M5 19l1 2.4 2.4.4-1.7 1.7.4 2.4L5 24.5l-2.1 1.4.4-2.4L1.6 21.8l2.4-.4L5 19z" opacity="0.6" />
              <path d="M19 17l.7 1.8 1.8.3-1.3 1.3.3 1.8-1.5-1-1.5 1 .3-1.8-1.3-1.3 1.8-.3L19 17z" opacity="0.6" />
            </svg>
            <span className="text-[10px] mt-1">Agent</span>
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
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h10M4 18h14" />
            </svg>
            <span className="text-[10px] mt-1">Captions</span>
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
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <span className="text-[10px] mt-1">Style</span>
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
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
            <span className="text-[10px] mt-1">Layout</span>
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
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span className="text-[10px] mt-1">Assets</span>
          </button>
        </div>

        {/* Left Sidebar Panel */}
        {leftSidebarOpen && leftSidebarTab === 'agent' && (
          <AIAssistantPanel
            projectId={project.id}
            onEditComplete={() => reloadVisuals(project.id)}
            className="w-[488px] flex-shrink-0"
          />
        )}
        {leftSidebarOpen && leftSidebarTab !== 'agent' && (
          <div className="w-[488px] flex-shrink-0 flex flex-col bg-[var(--editor-bg-surface)] border-r border-[var(--editor-border-subtle)] overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0">
              <h3 className="text-xs font-medium text-[var(--editor-text-muted)] uppercase tracking-wide">
                {leftSidebarTab === 'captions' && 'Caption Settings'}
                {leftSidebarTab === 'style' && 'Style Settings'}
                {leftSidebarTab === 'layout' && 'Layout Settings'}
                {leftSidebarTab === 'assets' && 'Visual Assets'}
              </h3>
              <button
                onClick={() => setLeftSidebarOpen(false)}
                className="p-1 rounded hover:bg-[var(--editor-bg-elevated)] text-[var(--editor-text-muted)]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
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
                <StylePanel />
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
                />
              )}
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Video Preview Area */}
          <div className="flex-1 relative bg-[var(--editor-bg-canvas)] overflow-hidden">
            {/* Zoom control */}
            <div className="absolute top-4 left-4 z-10">
              <select className="text-xs bg-[var(--editor-bg-surface)] border border-[var(--editor-border-subtle)] rounded-md px-2 py-1 text-[var(--editor-text-secondary)]">
                <option>Fit</option>
                <option>50%</option>
                <option>75%</option>
                <option>100%</option>
              </select>
            </div>

            {/* Scene */}
            <Scene className="w-full h-full" activePlatform={activePlatform} overlayMode={overlayMode} padding={24} />
          </div>

          {/* Transport Controls */}
          <PlaybackBar />

          {/* Timeline resize handle */}
          <div
            ref={resizeRef}
            onMouseDown={handleResizeStart}
            className="h-1 bg-[var(--editor-border-subtle)] hover:bg-[var(--editor-accent)]
                       cursor-ns-resize transition-colors"
          />

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
            <Timeline className="h-full" />
          </div>
        </div>

      </div>

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPalette.isOpen}
        onClose={commandPalette.close}
      />

      {/* Style Selection Modal for AI Visuals */}
      <StyleSelectionModal
        open={showStyleModal}
        onOpenChange={(open) => {
          if (!open) {
            handleDiscardVisuals();
          } else {
            setShowStyleModal(open);
          }
        }}
        onSelect={handleGenerateVisuals}
        onCancel={handleCancelVisuals}
        onConfirmAdd={handleConfirmAddVisuals}
        isLoading={isGeneratingVisuals}
        progress={visualsProgress}
        status={visualsStatus}
        error={visualsError}
        isComplete={visualsComplete}
        metrics={visualsMetrics}
        previewUrl={visualsPreviewUrl}
        canvasWidth={project?.videoSettings?.canvasWidth || 1080}
        canvasHeight={project?.videoSettings?.canvasHeight || 1920}
      />

      {/* Export Modal */}
      <ExportModal
        open={showExportModal}
        onOpenChange={setShowExportModal}
        projectId={project.id}
        projectStatus={project.status}
        hasOutputKey={!!project.outputKey}
      />
    </div>
  );
}
