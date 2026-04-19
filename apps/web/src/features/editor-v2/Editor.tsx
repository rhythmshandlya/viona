/**
 * Editor V2 Main Component
 * Minimal, Linear/Figma-inspired video editor
 */

'use client';

import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MessageSquareText, Captions, FolderOpen, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SmokeBackground } from '@/components/ui/spooky-smoke-animation';
import { Header } from './components/Header';
import { PreviewControls } from './components/PreviewControls';
import { RightPanel } from './components/RightPanel';
import { CommandPalette, useCommandPalette } from './components/CommandPalette';
import { JobLogsPanel } from './components/JobLogsPanel';
import { Scene } from './scene/Scene';
import { type SocialPlatform, type OverlayMode } from './scene/social-platforms';
import { AddItemToolbar } from './components/AddItemToolbar';
import { Timeline } from './timeline/Timeline';
// Lazy-loaded panels and modals (heavy components, only one visible at a time)
const AIAssistantPanel = lazy(() => import('./components/AIAssistantPanel').then(m => ({ default: m.AIAssistantPanel })));
const StylePanel = lazy(() => import('./panels/StylePanel').then(m => ({ default: m.StylePanel })));
const AssetsPanel = lazy(() => import('./panels/AssetsPanel').then(m => ({ default: m.AssetsPanel })));
const TransitionPickerModal = lazy(() => import('./components/TransitionPickerModal').then(m => ({ default: m.TransitionPickerModal })));
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';
import { useJobWebSocket } from './hooks/use-job-websocket';
import { useWorkspaceWS } from './hooks/use-workspace-ws';
import {
  useProject,
  useIsLoading,
  useLoadingMessage,
  useError,
  useProjectActions,
  useTimelineActions,
  useAudioActions,
  usePlaybackActions,
  useAIActions,
  useSelectedIds,
  useAIEditRequested,
  useEditorStore,
  useIsDirty,
  useAgentActivity,
  useAgentBusy,
} from './store/use-editor-store';
import { wsClient, WSMessage, JobProgressPayload, JobCompletePayload } from '@/lib/ws';
import { isRecentUserDispatch } from './store/manifest-dispatch';
import { api } from '@/lib/api';
import { clearCompositionCache } from './player/useWorkspaceComposition';

interface EditorProps {
  projectId: string;
}

export function Editor({ projectId }: EditorProps) {
  // Layout state - simplified unified layout
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [leftSidebarTab, setLeftSidebarTab] = useState<'captions' | 'assets' | 'agent'>('agent');
  const agentActivity = useAgentActivity();
  const agentBusy = useAgentBusy();

  // Right panel state (item inspector)
  const [panelOpen, setPanelOpen] = useState(false);

  // AI Assistant panel
  // AI panel is now a left sidebar tab ('agent')

  // Kept in px: timelineHeight is driven by pixel-exact drag deltas and persisted as a numeric; rem conversion would fight the drag math.
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

  // Export is now handled by ExportDropdown in Header (state lives in editor store)

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
  const loadingMessage = useLoadingMessage();
  const error = useError();
  const selectedIds = useSelectedIds();

  const rightPanelView = useMemo<'inspector' | 'transcript'>(() => {
    const items = useEditorStore.getState().items;
    const anyCaptionSelected =
      selectedIds.length > 0 &&
      selectedIds.some((id) => items[id]?.type === 'caption');
    const noSelectionOnCaptionsTab =
      selectedIds.length === 0 && leftSidebarTab === 'captions';
    return anyCaptionSelected || noSelectionOnCaptionsTab ? 'transcript' : 'inspector';
  }, [selectedIds, leftSidebarTab]);
  const rightPanelViewRef = useRef(rightPanelView);
  rightPanelViewRef.current = rightPanelView;

  // Workspace state
  const workspaceLockHolder = useEditorStore((s) => s.workspaceLockHolder);
  const workspaceBundleError = useEditorStore((s) => s.workspaceBundleError);

  // Actions
  const { loadProject, reloadVisuals, refreshMediaUrls } = useProjectActions();
  const { clearSelection } = useTimelineActions();
  const { updateEnhancementStatus } = useAudioActions();
  const { pause } = usePlaybackActions();
  const { setInspectModeEnabled } = useAIActions();

  // Auto-open right panel on selection or when in captions tab with no selection
  useEffect(() => {
    if (selectedIds.length > 0) {
      // Caption selection now opens the right panel (transcript editor),
      // not hides it like before.
      setPanelOpen(true);

      if (selectedIds.length === 1) {
        const state = useEditorStore.getState();
        const item = state.items[selectedIds[0]];
        if (item) {
          const currentMs = state.currentTimeMs;
          const isAlreadyOnItem = currentMs >= item.startMs && currentMs <= item.endMs;
          if (!isAlreadyOnItem) {
            const midpoint = Math.round((item.startMs + item.endMs) / 2);
            state.seek(midpoint);
          }
        }
      }
    } else {
      // No selection — open the right panel only when the user is in the
      // unified Captions tab (they're "editing captions"; treat all as selected).
      setPanelOpen(leftSidebarTab === 'captions');
    }
  }, [selectedIds, leftSidebarTab]);

  // Handle closing the panel
  const handleClosePanel = useCallback(() => {
    // On the transcript view the panel is persistent (it's the Captions-tab
    // content on the right side). Treat close as "clear selection" only;
    // the auto-open effect will keep the panel visible because leftSidebarTab
    // is 'captions'.
    if (rightPanelViewRef.current !== 'transcript') {
      setPanelOpen(false);
    }
    clearSelection();
  }, [clearSelection]);

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

  // Scope the rem root to the editor: shrinks every Tailwind utility
  // proportionally while the editor is mounted, without affecting the
  // rest of the app (marketing, auth, project list).
  useEffect(() => {
    document.documentElement.classList.add('editor-density');
    return () => {
      document.documentElement.classList.remove('editor-density');
    };
  }, []);

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

  // Global "click outside" deselect. Clicks in the header, the panel gaps,
  // the background shell, and the black letterbox around the preview should
  // all clear selection — any "dead" surface that isn't actively editable.
  // Rules:
  //   - never interrupt a form control, button, menu, or modal
  //   - editor panels preserve selection by default (a click on a timeline
  //     clip would otherwise deselect right after selecting)
  //   - panels that OPT IN via `data-deselect-on-empty` behave the opposite:
  //     any click inside that doesn't hit a control becomes a deselect.
  //     The preview panel uses this so clicks on black space around the
  //     Remotion player clear selection the same as clicks on the video.
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (useEditorStore.getState().selectedIds.length === 0) return;
      if (target.closest(
        '[role="menu"], [role="dialog"], [data-keep-selection], input, textarea, select, button, [contenteditable="true"]',
      )) return;
      const panel = target.closest('.editor-panel');
      if (panel && !panel.hasAttribute('data-deselect-on-empty')) return;
      useEditorStore.getState().clearSelection();
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, []);

  // Route caption-specific context-menu actions to the correct sidebar tab.
  // The context menu is decoupled from the sidebar state, so it emits window
  // events that this shell listens for. TranscriptPanel picks up the same
  // 'viona:caption-edit-text' event to auto-enter edit mode on the target row.
  useEffect(() => {
    const handleEditText = (e: Event) => {
      const detail = (e as CustomEvent<{ captionId: string }>).detail;
      if (!detail?.captionId) return;
      setLeftSidebarTab('captions');
      setLeftSidebarOpen(true);
      useEditorStore.getState().select([detail.captionId], 'replace');
    };
    window.addEventListener('viona:caption-edit-text', handleEditText);
    return () => {
      window.removeEventListener('viona:caption-edit-text', handleEditText);
    };
  }, []);

  // Workspace WebSocket events (Plan 3)
  useWorkspaceWS(projectId, {
    onWorkspaceReady: (data) => {
      useEditorStore.getState().setWorkspaceStatus('active');
      if (data.bundleUrl) {
        useEditorStore.getState().setWorkspaceBundleUrl(data.bundleUrl);
      }
    },
    onManifestUpdated: async (data) => {
      if (data.source !== 'ai' || !projectId) return;
      // The sandbox mis-tags user edits as source:'ai' (API hardcode). If we
      // just dispatched ops, the event is the echo of our own write — refetching
      // overwrites in-flight local state with a stale snapshot (e.g. a debounced
      // preset update not yet flushed), causing the caption to flash back to
      // the old position. Suppress the round-trip in that window.
      if (isRecentUserDispatch()) return;
      // Retry up to 3 times — manifest write may be in-flight when we read
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const manifest = await api.readSandboxManifest(projectId);
          useEditorStore.getState().applyRemoteManifestUpdate(manifest);
          break;
        } catch (err) {
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
          } else {
            console.error('Failed to apply remote manifest update:', err);
          }
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

  // Sandbox cleanup on unmount — debounced to survive React Strict Mode
  // double-mount and transient re-renders that would otherwise destroy
  // the sandbox mid-session.
  useEffect(() => {
    // Store timer ID in a ref-like variable so the cleanup on re-mount
    // (which fires the NEW effect's setup, not the old cleanup) can cancel it.
    const key = '__viona_suspend_timer';
    const win = window as any;

    // Cancel any pending suspend from a previous unmount (Strict Mode remount)
    if (win[key]) {
      clearTimeout(win[key]);
      win[key] = null;
    }

    return () => {
      const state = useEditorStore.getState();
      if (state.project && state.sandboxStatus === 'ready') {
        const projectId = state.project.id;
        win[key] = setTimeout(() => {
          win[key] = null;
          api.suspendSandbox(projectId).catch((err: any) => {
            console.warn('Failed to suspend sandbox on unmount:', err);
          });
        }, 5000);
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

  // When any caption gets newly selected from the timeline/preview, auto-open
  // the Captions settings tab on the left. Intentionally depends only on
  // selectedIds: if the user later manually switches tabs (e.g. to Assets)
  // while a caption is still selected, they stay where they put themselves.
  // The right-side transcript editor opens through its own effect (Task 2).
  const leftSidebarTabRef = useRef(leftSidebarTab);
  leftSidebarTabRef.current = leftSidebarTab;
  useEffect(() => {
    if (selectedIds.length === 0) return;
    const state = useEditorStore.getState();
    const hasCaption = selectedIds.some((id) => state.items[id]?.type === 'caption');
    const currentTab = leftSidebarTabRef.current;
    if (hasCaption && currentTab !== 'captions' && currentTab !== 'agent') {
      setLeftSidebarOpen(true);
      setLeftSidebarTab('captions');
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

  // Export is handled by ExportDropdown in Header

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
          setVisualsProgress(data.progress ?? data.percent ?? 0);
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
    if (wsConnected) return;

    let delay = 2000;
    const MAX_DELAY = 15000;
    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const job = await api.getJob(visualsJobId);
        setVisualsProgress(job.progress || 0);

        if (job.status === 'complete') {
          setVisualsStatus('Complete!');
          setIsGeneratingVisuals(false);
          setVisualsComplete(true);
          clearCompositionCache();
          if (project?.id) reloadVisuals(project.id);
          setVisualsJobId(null);
          return;
        } else if (job.status === 'failed' || job.status === 'cancelled') {
          const errorMsg = job.status === 'cancelled'
            ? 'Generation was cancelled'
            : (job.error || 'Unknown error occurred');
          setVisualsStatus(job.status === 'cancelled' ? 'Cancelled' : 'Failed');
          setVisualsError(errorMsg);
          setIsGeneratingVisuals(false);
          setVisualsJobId(null);
          return;
        } else if (job.status === 'processing') {
          setVisualsStatus('Generating visuals with AI...');
        }
      } catch (err) {
        console.error('Failed to poll job status:', err);
      }

      delay = Math.min(delay * 2, MAX_DELAY);
      timeoutId = setTimeout(poll, delay);
    };

    timeoutId = setTimeout(poll, delay);
    return () => clearTimeout(timeoutId);
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
      <div className="editor-theme editor-bg-mesh min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[var(--editor-text-primary)]">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--editor-accent)]" />
          <span className="text-sm">{loadingMessage || 'Loading project...'}</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="editor-theme editor-bg-mesh min-h-screen flex items-center justify-center">
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
      <div className="editor-theme editor-bg-mesh min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--editor-text-primary)]">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--editor-accent)]" />
          <span className="text-sm">Preparing editor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-theme relative flex h-screen w-screen flex-col overflow-hidden select-none antialiased">
      {/* Animated smoke background */}
      <div className="absolute inset-0 z-0">
        <SmokeBackground smokeColor="#3B1578" />
      </div>
      {/* Content layer above smoke */}
      <div className="relative z-10 flex h-full w-full flex-col overflow-hidden">
      {/* Header */}
      <Header
        onOpenCommandPalette={commandPalette.open}
        onToggleLogs={() => setShowLogsPanel(!showLogsPanel)}
        isLogsActive={showLogsPanel}
        hasActiveJob={!!visualsJobId}
      />

      {/* Main content area - boxed panel layout with gaps */}
      <div className="flex-1 flex overflow-hidden" style={{ gap: 'var(--editor-panel-gap)', padding: 'var(--editor-panel-gap)' }}>

        {/* Icon Rail - always visible */}
        <div className="w-16 flex flex-col items-center gap-1 py-2 flex-shrink-0 editor-panel">
          {(['agent', 'captions', 'assets'] as const).map((tab) => {
            const icons = { agent: MessageSquareText, captions: Captions, assets: FolderOpen };
            const labels = { agent: 'Chat', captions: 'Captions', assets: 'Assets' };
            const Icon = icons[tab];
            const active = leftSidebarOpen && leftSidebarTab === tab;
            const showActivityDot = tab === 'agent' && (!!agentActivity || agentBusy) && !(leftSidebarOpen && leftSidebarTab === 'agent');
            return (
              <button
                key={tab}
                onClick={() => {
                  if (leftSidebarOpen && leftSidebarTab === tab) {
                    setLeftSidebarOpen(false);
                  } else {
                    setLeftSidebarTab(tab);
                    setLeftSidebarOpen(true);
                  }
                }}
                className={`group relative w-14 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-colors duration-150 active:scale-[0.97] ${
                  active
                    ? 'text-[var(--editor-accent)] bg-[var(--editor-accent-muted)]'
                    : 'text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)] hover:bg-white/[0.05]'
                }`}
                title={showActivityDot ? (agentActivity ? `${agentActivity.agent}: ${agentActivity.action || 'Working...'}` : 'Agent is working...') : labels[tab]}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[0.625rem] leading-none">{labels[tab]}</span>
                {showActivityDot && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--editor-accent)] animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* AI Assistant Panel — always mounted to preserve SSE connection and state.
            Visually hidden (width: 0, overflow: hidden) when another tab is active. */}
        <div
          className="flex-shrink-0 overflow-hidden editor-panel transition-all duration-150 ease-out"
          style={{
            width: leftSidebarOpen && leftSidebarTab === 'agent' ? 'var(--editor-left-panel-width)' : 0,
            opacity: leftSidebarOpen && leftSidebarTab === 'agent' ? 1 : 0,
            pointerEvents: leftSidebarOpen && leftSidebarTab === 'agent' ? 'auto' : 'none',
          }}
        >
          <ErrorBoundary name="AI Assistant">
            <Suspense fallback={<div className="flex items-center justify-center h-full"><span className="text-zinc-500 text-sm">Loading...</span></div>}>
              <AIAssistantPanel
                projectId={project.id}
                onEditComplete={() => reloadVisuals(project.id)}
                className="w-[var(--editor-left-panel-width)]"
              />
            </Suspense>
          </ErrorBoundary>
        </div>

        {/* Other Left Sidebar Panels */}
        <AnimatePresence mode="wait">
          {leftSidebarOpen && leftSidebarTab !== 'agent' && (
            <motion.div
              key="sidebar-panels"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'var(--editor-left-panel-width)', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="flex-shrink-0 overflow-hidden editor-panel"
            >
              <div className="w-[var(--editor-left-panel-width)] flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0">
                  <h3 className="text-xs font-normal text-[var(--editor-text-muted)] uppercase tracking-wide">
                    {leftSidebarTab === 'captions' && 'Caption Settings'}
                    {leftSidebarTab === 'assets' && 'Visual Assets'}
                  </h3>
                  <button
                    onClick={() => setLeftSidebarOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[var(--editor-text-muted)] active:scale-[0.97] transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {leftSidebarTab === 'captions' && (
                    <ErrorBoundary name="Caption Settings">
                      <Suspense fallback={<div className="flex items-center justify-center h-full"><span className="text-zinc-500 text-sm">Loading...</span></div>}>
                        <StylePanel />
                      </Suspense>
                    </ErrorBoundary>
                  )}
                  {leftSidebarTab === 'assets' && (
                    <Suspense fallback={<div className="flex items-center justify-center h-full"><span className="text-zinc-500 text-sm">Loading...</span></div>}>
                      <AssetsPanel
                        onEditWithAI={() => {
                          setLeftSidebarTab('agent');
                          useEditorStore.setState({ aiEditRequested: true });
                        }}
                        onYouTubeClipAdded={handleYouTubeClipAdded}
                      />
                    </Suspense>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content + right panel */}
        <div className="flex-1 flex min-w-0 overflow-hidden" style={{ gap: 'var(--editor-panel-gap)' }}>
          {/* Center: preview + timeline */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ gap: 'var(--editor-panel-gap)' }}>
            {/* Video Preview Area — contains scene + controls in one box.
                Opt into the global "click empty area deselects" pattern so
                tapping the black letterbox around the video clears selection. */}
            <div className="flex-1 relative overflow-hidden flex flex-col editor-panel" data-deselect-on-empty>
              {/* Workspace status indicators */}
              <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end">
                {workspaceLockHolder === 'ai' && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 backdrop-blur-xl border border-purple-500/20 rounded-xl text-purple-300 text-sm shadow-[0_4px_16px_rgba(168,85,247,0.1)]">
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    AI is editing...
                  </div>
                )}
                {workspaceBundleError && (
                  <div className="px-3 py-1.5 bg-red-500/10 backdrop-blur-xl border border-red-500/20 rounded-xl text-red-300 text-sm shadow-[0_4px_16px_rgba(239,68,68,0.1)]">
                    Bundle error: {workspaceBundleError}
                  </div>
                )}
              </div>

              {/* Scene */}
              <div className="flex-1 relative overflow-hidden">
                <ErrorBoundary name="Scene">
                  <Scene className="w-full h-full" activePlatform={activePlatform} overlayMode={overlayMode} padding={24} />
                </ErrorBoundary>
              </div>

              {/* Controls bar — inside the preview box */}
              <PreviewControls />
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

            {/* Timeline (with Add Item Toolbar inside) */}
            <div style={{ height: timelineHeight }} className="flex-shrink-0 overflow-hidden relative editor-panel flex flex-col">
              {/* Resize handle */}
              <div
                ref={resizeRef}
                onMouseDown={(e) => {
                  document.body.style.cursor = 'ns-resize';
                  handleResizeStart(e);
                }}
                className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize z-10 flex items-center justify-center group hover:bg-white/[0.04] transition-colors"
              >
                <div className="w-10 h-0.5 rounded-full bg-white/[0.12] group-hover:bg-[var(--editor-accent)] transition-colors" />
              </div>
              {/* Add Item Toolbar */}
              <AddItemToolbar />
              <ErrorBoundary name="Timeline">
                <Timeline className="flex-1 min-h-0" />
              </ErrorBoundary>
            </div>
          </div>

          {/* Right Panel - Item Inspector / Transcript Editor */}
          {panelOpen && (
            <RightPanel
              isOpen={panelOpen}
              onClose={handleClosePanel}
              view={rightPanelView}
              canClose={rightPanelView !== 'transcript'}
            />
          )}
        </div>

      </div>

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPalette.isOpen}
        onClose={commandPalette.close}
      />

      {/* Transition Picker Modal */}
      <Suspense fallback={null}>
        <TransitionPickerModal />
      </Suspense>
      </div>
    </div>
  );
}
