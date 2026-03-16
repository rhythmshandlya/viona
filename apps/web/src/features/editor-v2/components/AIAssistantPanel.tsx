/**
 * AI Assistant Panel
 * Streaming chat interface with inline widget support.
 * Connects to the agent router via SSE for real-time responses.
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles, Send, Loader2, Target, Box, Layers, X, RotateCcw, RefreshCw, Square, Clock, AlertCircle, Check, Circle, XCircle, ListOrdered, Plus, Paperclip } from 'lucide-react';
import { api } from '@/lib/api';
import { parseSSEStream, SSETimeoutError } from '@/lib/sse-parser';
import { clearCompositionCache } from '../player/useWorkspaceComposition';
import { useVideoSettings, useProjectActions, useAIActions, useTimelineActions, useAIEditingContext, useAIEditRequested, usePendingAIMessage, useSelectedTimeRange, useEditorStore } from '../store/use-editor-store';
import { useJobWebSocket } from '../hooks/use-job-websocket';
import { useProgress } from '../hooks/use-progress';
import { ProgressBar } from './ProgressBar';
import { ActivityIndicator } from './ActivityIndicator';
import { ActivityLog } from './ActivityLog';
import { HealthIndicator } from './HealthIndicator';
import { ThemePicker, ScenePlanCard, ConfirmationWidget, ChoiceWidget } from './agent-widgets';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TextBlock {
  type: 'text';
  text: string;
}

interface WidgetBlock {
  type: 'widget';
  widget: {
    id: string;
    kind: string;
    message?: string;
    scenes?: Array<{
      startMs: number; endMs: number; title: string; description: string;
      emotion?: string;
      keySync?: { word: string; timestamp: number; visualEvent: string };
      buildsFrom?: string | null;
      connectsTo?: string | null;
      layout?: Record<string, unknown> | null;
      frames?: [number, number] | null;
      icons?: string[];
      transition?: {
        enter: { type: string; durationMs: number };
        exit: { type: string; durationMs: number };
      };
    }>;
    scenePlanMarkdown?: string;
    metadata?: {
      primaryMetaphor?: string; colorPalette?: string;
      totalScenes?: number; durationSeconds?: number;
      visualContinuity?: string;
    };
    options?: Array<{ label: string; value: string }>;
    planJobId?: string;
    requiresApproval?: boolean;
  };
  response?: unknown;
}

interface ProgressMeta {
  phase?: string;
  phaseName?: string;
  scene?: number;
  totalScenes?: number;
  iteration?: number;
  maxIterations?: number;
  score?: number;
  detail?: string;
}

interface ProgressBlock {
  type: 'progress';
  percent: number;
  message: string;
  error?: boolean;
  phase?: string;
  phaseName?: string;
  jobType?: string;
  meta?: ProgressMeta;
  agentName?: string;
  trackName?: string;
  estimatedTimeRemaining?: number;
}

type MessageBlock = TextBlock | WidgetBlock | ProgressBlock;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: MessageBlock[];
  createdAt: string;
  queued?: boolean;
}

interface AIAssistantPanelProps {
  projectId: string;
  onEditComplete?: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function formatTimeChip(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

/** Estimate remaining seconds from recent progress samples. Returns null if insufficient data. */
function computeTimeBasedEta(avgDurationMs: number, jobStartedAt: string): number | null {
  const startTime = new Date(jobStartedAt).getTime();
  if (isNaN(startTime)) return null;
  const elapsedMs = Date.now() - startTime;
  const remainingMs = avgDurationMs - elapsedMs;
  // If we've exceeded the average, don't show negative — hide ETA
  if (remainingMs < 30_000) return null;
  return Math.min(remainingMs / 1000, 3600);
}

function formatEta(seconds: number): string {
  const mins = Math.ceil(seconds / 60);
  if (mins <= 1) return '~1 min remaining';
  return `~${mins} min remaining`;
}

// ---------------------------------------------------------------------------
// Vertical Step Indicator constants
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Generation phases: ordered list of phases for generate-visuals jobs.
// When structured metadata is available (meta.phase), we use this to render
// a dynamic step indicator. Falls back to legacy phases for other job types.
// ---------------------------------------------------------------------------

const GENERATION_PHASES: Array<{ id: string; label: string }> = [
  { id: 'plan', label: 'Planning scenes' },
  { id: 'workspace', label: 'Setting up workspace' },
  { id: 'animate', label: 'Animating scenes' },
  { id: 'self_heal', label: 'Fixing errors' },
  { id: 'bundle', label: 'Bundling for preview' },
  { id: 'verify', label: 'Verifying scenes' },
];

// Legacy fallback phase steps (used for plan-visuals, edit-visuals, or old jobs without metadata)
const PHASE_STEPS: Record<string, string[]> = {
  'plan-visuals': ['Loading project', 'Planning scenes', 'Finalizing plan'],
  'generate-visuals': ['Preparing pipeline', 'Generating visuals', 'Validating code', 'Uploading assets'],
  'edit-visuals': ['Analyzing request', 'Editing visual', 'Validating changes'],
};

const PHASE_ORDER: Record<string, string[]> = {
  'plan-visuals': ['preparing', 'planning', 'finalizing'],
  'generate-visuals': ['preparing', 'generating', 'validating', 'uploading'],
  'edit-visuals': ['preparing', 'editing', 'validating'],
};

/** Map raw backend error messages to user-friendly text */
function sanitizeErrorMessage(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('network error') || lower.includes('failed to fetch') || lower.includes('fetch failed') || lower.includes('connection lost') || lower.includes('networkerror')) {
    return 'Connection lost. Please check your network and try again.';
  }
  if (lower.includes('prompt is too long')) {
    return 'This project has too many files for a single edit. Try targeting a specific scene instead.';
  }
  if (lower.includes('timed out') || lower.includes('timeout')) {
    return 'The operation took too long. Please try again with a simpler request.';
  }
  if (lower.includes('cancelled') || lower.includes('canceled')) {
    return 'Generation was cancelled.';
  }
  if (lower.includes('crashed') || lower.includes('oom') || lower.includes('out of memory')) {
    return 'The AI ran into a resource limit. Try a simpler edit or target a specific scene.';
  }
  if (lower.includes('exited with code') || lower.includes('process exited')) {
    return 'Something went wrong during generation. Please try again.';
  }
  if (lower.includes('authentication') || lower.includes('unauthorized') || lower.includes('credentials')) {
    return 'AI service authentication failed. Please contact support.';
  }
  if (lower.includes('rate limit') || lower.includes('429')) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  // Don't expose internal details — cap at a reasonable length
  if (raw.length > 120) {
    return 'Something went wrong. Please try again or try a different approach.';
  }
  return raw;
}

function getStepStatus(currentPhase: string | undefined, jobType: string, stepIndex: number): 'done' | 'active' | 'pending' {
  if (currentPhase === 'done') return 'done';
  const phases = PHASE_ORDER[jobType];
  if (!phases || !currentPhase) return stepIndex === 0 ? 'active' : 'pending';
  const currentIdx = phases.indexOf(currentPhase);
  if (currentIdx === -1) return 'pending';
  if (stepIndex < currentIdx) return 'done';
  if (stepIndex === currentIdx) return 'active';
  return 'pending';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SceneTag {
  sceneIndex: number; // 1-indexed
  sceneTitle: string;
  planJobId: string;
}

interface QueuedMessage {
  id: string;
  text: string;
  fullMessage: string;
  context: {
    sceneTags: SceneTag[];
    selectedTimeRange: { startMs: number; endMs: number } | null;
  };
}

export function AIAssistantPanel({ projectId, onEditComplete, className = '' }: AIAssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [sceneTags, setSceneTags] = useState<SceneTag[]>([]);

  // Message queue — lets users queue messages while streaming
  const messageQueueRef = useRef<QueuedMessage[]>([]);
  const [queueSize, setQueueSize] = useState(0);

  const [failedMessageId, setFailedMessageId] = useState<string | null>(null);
  const lastFailedPayload = useRef<{ message: string; widgetResponse?: { widgetId: string; value: unknown } } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const progressSourceRef = useRef<'sse' | 'ws' | 'http' | null>(null);
  const pendingWidgetResponseRef = useRef<Array<{ widgetId: string; value: unknown }>>([]);
  const lastEventIdRef = useRef<number | undefined>(undefined);
  const sandboxBootAttempted = useRef(false);
  const bootAndRetryRef = useRef<((message: string, widgetResponse?: { widgetId: string; value: unknown }) => Promise<void>) | null>(null);

  // Attachment state (supports multiple files)
  const [attachmentFiles, setAttachmentFiles] = useState<{ file: File; label: string }[]>([]);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  // Unified progress state (merges SSE + WS + HTTP)
  const progressState = useProgress();

  // Stall detection
  const [stallState, setStallState] = useState<'ok' | 'slow' | 'stuck'>('ok');
  const lastProgressTimeRef = useRef(Date.now());
  // High-water mark for HTTP polling — prevents progress going backward
  const httpHighWaterRef = useRef(0);

  // ETA tracking — stores recent (timestamp, percent) samples to compute progress rate
  // Track avg duration and job start time from backend for time-based ETA
  const etaInfoRef = useRef<{ avgDurationMs: number; jobStartedAt: string } | null>(null);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);

  // Track active generation job for WebSocket/HTTP polling progress.
  // Initialize from sessionStorage so it survives remount/navigation.
  const [activeJobId, setActiveJobId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(`viona:activeJobId:${projectId}`) || null;
    } catch { return null; }
  });

  // Persist activeJobId to sessionStorage whenever it changes
  useEffect(() => {
    try {
      if (activeJobId) {
        sessionStorage.setItem(`viona:activeJobId:${projectId}`, activeJobId);
      } else {
        sessionStorage.removeItem(`viona:activeJobId:${projectId}`);
      }
    } catch { /* sessionStorage unavailable */ }
  }, [activeJobId, projectId]);

  // Store hooks
  const videoSettings = useVideoSettings();
  const aiContext = useAIEditingContext();
  const selectedTimeRange = useSelectedTimeRange();
  const aiEditRequested = useAIEditRequested();
  const pendingAIMessage = usePendingAIMessage();
  const { reloadVisuals } = useProjectActions();
  const { setSelectedScene, setSelectedElement, setSelectedTimeRange, setPendingAIMessage } = useAIActions();
  const { clearSelection } = useTimelineActions();

  // WebSocket for real-time job progress (survives page refresh, unlike SSE)
  const { subscribeToJob, isConnected: wsConnected } = useJobWebSocket(projectId, {
    onProgress: (data) => {
      // SSE takes priority while stream is active — prevents duplicate updates
      if (progressSourceRef.current === 'sse' && isStreaming) {
        return;
      }
      progressSourceRef.current = 'ws';
      // Reset stall timer
      lastProgressTimeRef.current = Date.now();
      setStallState('ok');
      // Feed into unified progress state
      progressState.onWSProgress({
        percent: data.progress,
        message: data.message || `Processing... (${data.progress}%)`,
        phase: data.meta?.phase || data.phase,
        phaseName: data.meta?.phaseName || data.phaseName,
        detail: data.meta?.detail,
        meta: data.meta,
      });
      if (!activeJobId || data.jobId !== activeJobId) return;
      setMessages((prev) => {
        const last = [...prev].reverse().find((m) => m.role === 'assistant');
        if (!last) return prev;
        return prev.map((m) => {
          if (m.id !== last.id) return m;
          const blocks = [...m.content];
          const progIdx = blocks.findIndex((b) => b.type === 'progress');
          // Don't overwrite an errored progress block with a stale update
          if (progIdx >= 0 && (blocks[progIdx] as ProgressBlock).error) return m;
          const progressBlock: ProgressBlock = {
            type: 'progress',
            percent: data.progress,
            message: data.message || `Processing... (${data.progress}%)`,
            phase: data.meta?.phase || data.phase,
            phaseName: data.meta?.phaseName || data.phaseName,
            jobType: data.jobType,
            meta: data.meta,
          };
          if (progIdx >= 0) {
            blocks[progIdx] = progressBlock;
          } else {
            blocks.push(progressBlock);
          }
          return { ...m, content: blocks };
        });
      });
    },
    onComplete: (data) => {
      if (data.jobId !== activeJobId) return;
      setActiveJobId(null);
      progressSourceRef.current = null;
      setMessages((prev) => {
        // Mark progress blocks as completed (100% + green bar) instead of removing them
        // Skip errored progress blocks — don't overwrite failure with "Done!"
        const updated = prev.map((m) => {
          if (m.role !== 'assistant') return m;
          const hasProgress = m.content.some((b) => b.type === 'progress');
          if (!hasProgress) return m;
          return {
            ...m,
            content: m.content.map((b) =>
              b.type === 'progress' && !b.error
                ? { ...b, percent: 100, message: 'Done!', phase: 'done' }
                : b,
            ),
          };
        });
        // Add completion message
        const doneMsg: Message = {
          id: generateId(),
          role: 'assistant',
          content: [{ type: 'text', text: 'Your visuals are ready! Take a look and let me know if you\'d like any changes.' }],
          createdAt: new Date().toISOString(),
        };
        return [...updated, doneMsg];
      });
      clearCompositionCache();
      if (reloadVisuals) reloadVisuals(projectId);
    },
    onError: (data) => {
      if (data.jobId !== activeJobId) return;
      setActiveJobId(null);
      progressSourceRef.current = null;
      setMessages((prev) => {
        const last = [...prev].reverse().find((m) => m.role === 'assistant');
        if (!last) return prev;
        return prev.map((m) => {
          if (m.id !== last.id) return m;
          // Mark progress as error state instead of removing
          const blocks = m.content.map((b) =>
            b.type === 'progress'
              ? { ...b, error: true, message: sanitizeErrorMessage(data.error || 'Generation failed') }
              : b,
          );
          return { ...m, content: blocks };
        });
      });
    },
    onHealth: (data) => {
      progressState.onWSHealth(data);
    },
    onActivity: (data) => {
      progressState.onSSEActivity(data);
    },
  });

  // Subscribe to job updates when we have an active job
  useEffect(() => {
    if (activeJobId) {
      subscribeToJob(activeJobId);
    }
  }, [activeJobId, subscribeToJob]);

  // HTTP polling fallback — activates when activeJobId is set but SSE is not streaming.
  // Polls every 3s as a tertiary progress channel (after SSE and WebSocket).
  useEffect(() => {
    if (!activeJobId || isStreaming) return;
    // Reset high-water mark when a new job starts being polled
    httpHighWaterRef.current = 0;

    const poll = async () => {
      // Don't override SSE or WS while they're actively providing progress.
      // But if no update arrived from them in 10s, allow HTTP to take over.
      const staleMs = Date.now() - lastProgressTimeRef.current;
      if ((progressSourceRef.current === 'sse' || progressSourceRef.current === 'ws') && staleMs < 10_000) return;
      try {
        const job = await api.getJob(activeJobId);
        progressSourceRef.current = 'http';
        lastProgressTimeRef.current = Date.now();
        setStallState('ok');

        if (job.status === 'complete') {
          setActiveJobId(null);
          progressSourceRef.current = null;
          httpHighWaterRef.current = 0;
          setMessages(prev => {
            const updated = prev.map(m => {
              if (m.role !== 'assistant') return m;
              const hasProgress = m.content.some(b => b.type === 'progress');
              if (!hasProgress) return m;
              return {
                ...m,
                content: m.content.map(b =>
                  b.type === 'progress' && !b.error ? { ...b, percent: 100, message: 'Done!', phase: 'done' } : b,
                ),
              };
            });
            return [...updated, {
              id: generateId(),
              role: 'assistant' as const,
              content: [{ type: 'text' as const, text: 'Your visuals are ready! Take a look and let me know if you\'d like any changes.' }],
              createdAt: new Date().toISOString(),
            }];
          });
          clearCompositionCache();
          if (reloadVisuals) reloadVisuals(projectId);
          return;
        }

        if (job.status === 'failed' || job.status === 'cancelled') {
          setActiveJobId(null);
          progressSourceRef.current = null;
          httpHighWaterRef.current = 0;
          setMessages(prev => {
            const last = [...prev].reverse().find(m => m.role === 'assistant');
            if (!last) return prev;
            return prev.map(m => {
              if (m.id !== last.id) return m;
              return {
                ...m,
                content: m.content.map(b =>
                  b.type === 'progress'
                    ? { ...b, error: true, message: sanitizeErrorMessage(job.error || 'Generation failed') }
                    : b,
                ),
              };
            });
          });
          return;
        }

        // Apply high-water mark — never show progress going backward
        const effectivePercent = Math.max(job.progress, httpHighWaterRef.current);
        httpHighWaterRef.current = effectivePercent;

        // Use progressMeta from DB if available, otherwise derive phase from percent
        const jt = job.type;
        const jobMeta = job.progressMeta as ProgressMeta | null;
        let phase: string | undefined;
        if (jobMeta?.phase) {
          phase = jobMeta.phase;
        } else {
          // Derive canonical phase from percent (matches backend derivePhase + ProgressBar thresholds)
          if (jt === 'plan-visuals') {
            phase = 'plan';
          } else if (jt === 'generate-visuals') {
            if (effectivePercent < 15) phase = 'plan';
            else if (effectivePercent < 65) phase = 'animate';
            else if (effectivePercent < 75) phase = 'verify';
            else phase = 'bundle';
          } else if (jt === 'edit-visuals') {
            if (effectivePercent < 65) phase = 'animate';
            else if (effectivePercent < 75) phase = 'verify';
            else phase = 'bundle';
          }
        }

        // Processing — update progress block with enriched data
        setMessages(prev => {
          const last = [...prev].reverse().find(m => m.role === 'assistant');
          if (!last) return prev;
          return prev.map(m => {
            if (m.id !== last.id) return m;
            const blocks = [...m.content];
            const progIdx = blocks.findIndex(b => b.type === 'progress');
            // Don't overwrite an errored progress block with a stale update
            if (progIdx >= 0 && (blocks[progIdx] as ProgressBlock).error) return m;
            const progressBlock: ProgressBlock = {
              type: 'progress',
              percent: effectivePercent,
              message: job.progressMessage || `Processing... (${effectivePercent}%)`,
              phase,
              phaseName: jobMeta?.phaseName || undefined,
              jobType: jt,
              meta: jobMeta || undefined,
            };
            if (progIdx >= 0) {
              blocks[progIdx] = progressBlock;
            } else {
              blocks.push(progressBlock);
            }
            return { ...m, content: blocks };
          });
        });
      } catch {
        // Polling failed — will retry on next interval
      }
    };

    // Initial poll immediately, then every 3s
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [activeJobId, isStreaming, projectId, reloadVisuals]);

  // Progress received — reset stall timer
  const onProgressReceived = useCallback(() => {
    lastProgressTimeRef.current = Date.now();
    setStallState('ok');
  }, []);

  // Stall check interval
  useEffect(() => {
    if (!isStreaming) {
      setStallState('ok');
      return;
    }

    const check = setInterval(() => {
      const elapsed = Date.now() - lastProgressTimeRef.current;
      const slowThreshold = activeJobId ? 180_000 : 60_000;   // 3 min with active job (was 2 min)
      const stuckThreshold = activeJobId ? 600_000 : 120_000; // 10 min with active job (was 5 min)

      if (elapsed > stuckThreshold) setStallState('stuck');
      else if (elapsed > slowThreshold) setStallState('slow');
      else setStallState('ok');
    }, 3_000);

    return () => clearInterval(check);
  }, [isStreaming, activeJobId]);

  // Abort in-flight requests on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Track scroll position — only auto-scroll if user is near the bottom
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const threshold = 80;
      isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll to bottom (only when near bottom)
  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  }, [input]);

  // React to "Edit with AI" request: clear flag and focus textarea
  useEffect(() => {
    if (aiEditRequested) {
      useEditorStore.setState({ aiEditRequested: false });
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
  }, [aiEditRequested]);

  // -----------------------------------------------------------------------
  // Load conversation history on mount
  // -----------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        const data = await api.getConversation(projectId);
        if (cancelled) return;

        if (data.conversationId) {
          setConversationId(data.conversationId);
        }

        if (data.messages && data.messages.length > 0) {
          let loaded: Message[] = data.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: normalizeContent(m.content),
            createdAt: m.createdAt,
          }));

          // If there's an active job, restore progress bar and subscribe to WebSocket updates.
          // Do this BEFORE filtering so the progress block attaches to the correct
          // assistant message (which may be an empty placeholder created at stream start).
          if (data.activeJob) {
            // Only subscribe to WebSocket for generate/edit jobs.
            // Plan-visuals should show progress but NOT trigger "visuals ready" on completion.
            if (data.activeJob.jobType !== 'plan-visuals') {
              setActiveJobId(data.activeJob.id);
            }
            const progressBlock: ProgressBlock = {
              type: 'progress',
              percent: data.activeJob.progress ?? 0,
              message: data.activeJob.message || 'Processing...',
              phase: data.activeJob.phase,
              phaseName: data.activeJob.phaseName,
              jobType: data.activeJob.jobType,
              meta: data.activeJob.progressMeta || undefined,
            };
            const lastAssistant = [...loaded].reverse().find((m) => m.role === 'assistant');
            if (lastAssistant) {
              lastAssistant.content = [...lastAssistant.content, progressBlock];
            }
          }

          // Restore sandbox pipeline progress (Redis-backed, not BullMQ)
          const sandboxProgress = (data as any).sandboxProgress;
          if (sandboxProgress && !data.activeJob) {
            progressState.onHTTPProgress(sandboxProgress as Record<string, unknown>);
          }

          // Drop empty assistant placeholder rows (created at stream start but
          // not yet filled — only relevant when there's no active job to show)
          loaded = loaded.filter((m) => m.content.length > 0 || m.role !== 'assistant');

          setMessages(loaded);
        }
      } catch (err) {
        console.error('Failed to load conversation history:', err);
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    }

    loadHistory();
    return () => { cancelled = true; };
  }, [projectId]);

  // -----------------------------------------------------------------------
  // Normalize content from the API (which may store it differently)
  // -----------------------------------------------------------------------

  // Internal metadata patterns that should never be shown to the user
  const internalPattern = /\[Widget response:[^\]]*\]|\[Selected (?:time range|scene|element):[^\]]*\]|\[Editing visuals:[^\]]*\]|\[Start the conversation\.[^\]]*\]/g;

  function normalizeContent(raw: unknown): MessageBlock[] {
    if (Array.isArray(raw)) {
      return (raw as Array<Record<string, unknown> & MessageBlock>)
        .filter((b) => !(b as any).hidden)
        .map((b) => {
          // Strip internal annotations from text blocks
          if (b.type === 'text' && typeof (b as any).text === 'string') {
            const cleaned = ((b as any).text as string).replace(internalPattern, '').trim();
            if (!cleaned) return null;
            return { ...b, text: cleaned } as MessageBlock;
          }
          return b;
        })
        .filter(Boolean) as MessageBlock[];
    }
    if (typeof raw === 'string') {
      const cleaned = raw.replace(internalPattern, '').trim();
      if (!cleaned) return [];
      return [{ type: 'text', text: cleaned }];
    }
    return [{ type: 'text', text: String(raw ?? '') }];
  }

  // -----------------------------------------------------------------------
  // SSE event handler
  // -----------------------------------------------------------------------

  const handleSSEEvent = useCallback(
    (event: { event: string; data: unknown }, assistantMessageId: string) => {
      const { event: eventType, data } = event;

      // Reset stall timer on any meaningful SSE activity (not just progress events)
      if (eventType === 'text' || eventType === 'widget' || eventType === 'progress' || eventType === 'heartbeat' || eventType === 'activity' || eventType === 'health') {
        lastProgressTimeRef.current = Date.now();
        setStallState('ok');
      }

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantMessageId) return m;

          const blocks = [...m.content];

          switch (eventType) {
            case 'reset': {
              // Server is retrying after a failed session resume — clear partial text
              blocks.length = 0;
              break;
            }

            case 'text': {
              const textData = data as { text: string };
              const last = blocks[blocks.length - 1];
              if (last && last.type === 'text') {
                blocks[blocks.length - 1] = { ...last, text: last.text + textData.text };
              } else {
                blocks.push({ type: 'text', text: textData.text });
              }
              break;
            }

            case 'widget': {
              const widgetData = data as WidgetBlock['widget'];
              blocks.push({ type: 'widget', widget: widgetData });
              break;
            }

            case 'progress': {
              progressSourceRef.current = 'sse';
              onProgressReceived();
              const progressData = data as {
                percent: number; message: string; error?: boolean;
                jobId?: string; phase?: string; phaseName?: string; jobType?: string;
                meta?: ProgressMeta;
                avgDurationMs?: number; jobStartedAt?: string;
                agentName?: string; trackName?: string; estimatedTimeRemaining?: number;
              };
              // Feed into unified progress state
              {
                progressState.onSSEProgress({
                  percent: progressData.percent,
                  message: progressData.message,
                  phase: progressData.phase,
                  phaseName: progressData.phaseName,
                  detail: progressData.meta?.detail,
                  meta: progressData.meta,
                  agentName: progressData.agentName,
                  trackName: progressData.trackName,
                  estimatedTimeRemaining: progressData.estimatedTimeRemaining,
                });
              }
              // On failure, stop tracking the job so the spinner stops
              if (progressData.error) {
                setActiveJobId(null);
                etaInfoRef.current = null;
                setEtaSeconds(null);
              } else if (progressData.jobId) {
                // Track the job ID so WebSocket can pick up progress if SSE drops
                setActiveJobId(progressData.jobId);
              }

              // Time-based ETA: store avg duration info from backend, compute remaining
              if (!progressData.error && progressData.avgDurationMs && progressData.jobStartedAt) {
                etaInfoRef.current = { avgDurationMs: progressData.avgDurationMs, jobStartedAt: progressData.jobStartedAt };
              }
              if (!progressData.error && etaInfoRef.current && progressData.percent < 95) {
                const eta = computeTimeBasedEta(etaInfoRef.current.avgDurationMs, etaInfoRef.current.jobStartedAt);
                setEtaSeconds(eta);
              } else if (progressData.error || progressData.percent >= 95) {
                setEtaSeconds(null);
              }

              // Update existing progress block or add new one
              const progressIdx = blocks.findIndex((b) => b.type === 'progress');
              const progressBlock: ProgressBlock = {
                type: 'progress',
                percent: progressData.percent,
                message: progressData.error ? sanitizeErrorMessage(progressData.message) : progressData.message,
                error: progressData.error,
                phase: progressData.phase,
                phaseName: progressData.phaseName,
                jobType: progressData.jobType,
                meta: progressData.meta,
                agentName: progressData.agentName,
                trackName: progressData.trackName,
                estimatedTimeRemaining: progressData.estimatedTimeRemaining,
              };
              if (progressIdx >= 0) {
                blocks[progressIdx] = progressBlock;
              } else {
                // New job starting — reset ETA
                etaInfoRef.current = null;
                setEtaSeconds(null);
                blocks.push(progressBlock);
              }
              break;
            }

            case 'error': {
              const errorData = data as { message?: string; error?: string };
              const errorText = sanitizeErrorMessage(errorData.message || errorData.error || 'Something went wrong');
              // Mark existing progress block as errored instead of adding a text block
              const errProgIdx = blocks.findIndex((b) => b.type === 'progress');
              if (errProgIdx >= 0) {
                const existing = blocks[errProgIdx] as ProgressBlock;
                blocks[errProgIdx] = { ...existing, error: true, message: errorText };
              } else {
                // No progress block — fall back to text
                blocks.push({ type: 'text', text: `\n\nError: ${errorText}` });
              }
              break;
            }

            case 'activity': {
              progressState.onSSEActivity(data as Record<string, unknown>);
              break;
            }

            case 'health': {
              progressState.onSSEHealth(data as Record<string, unknown>);
              break;
            }

            default:
              break;
          }

          return { ...m, content: blocks };
        })
      );

      // Handle special events outside of message content
      if (eventType === 'done') {
        const doneData = data as { conversationId?: string };
        if (doneData.conversationId) {
          setConversationId(doneData.conversationId);
        }
        setIsStreaming(false);
        progressSourceRef.current = null;
        etaInfoRef.current = null;
        setEtaSeconds(null);

        // Mark any remaining progress block as completed instead of removing it
        // Skip errored progress blocks — don't overwrite failure with "Done!"
        setMessages((prev) =>
          prev.map((m) => {
            if (m.role !== 'assistant') return m;
            const hasProgress = m.content.some((b) => b.type === 'progress');
            if (!hasProgress) return m;
            return {
              ...m,
              content: m.content.map((b) =>
                b.type === 'progress' && !b.error
                  ? { ...b, percent: 100, message: 'Done!', phase: 'done' }
                  : b,
              ),
            };
          }),
        );

        // Trigger visual reload on completion
        clearCompositionCache();
        if (reloadVisuals) {
          reloadVisuals(projectId);
        }
        if (onEditComplete) {
          onEditComplete();
        }
      }

      if (eventType === 'error') {
        setIsStreaming(false);
        setActiveJobId(null);
        progressSourceRef.current = null;
        etaInfoRef.current = null;
        setEtaSeconds(null);
        progressState.reset();
      }
    },
    [projectId, reloadVisuals, onEditComplete, onProgressReceived, progressState]
  );

  // -----------------------------------------------------------------------
  // Execute message (internal — runs the SSE stream)
  // -----------------------------------------------------------------------

  const _executeMessage = useCallback(
    async (params: {
      messageText: string;
      fullMessage: string;
      widgetResponse?: { widgetId: string; value: unknown };
      existingUserMsgId?: string;
      snapshotContext?: {
        sceneTags: SceneTag[];
        selectedTimeRange: { startMs: number; endMs: number } | null;
      };
    }) => {
      const { messageText, fullMessage, widgetResponse, existingUserMsgId, snapshotContext } = params;

      // If this was a queued message, unmark it
      if (existingUserMsgId) {
        setMessages((prev) => prev.map((m) =>
          m.id === existingUserMsgId ? { ...m, queued: false } : m
        ));
      }

      // Add empty assistant placeholder
      const assistantId = generateId();
      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        content: [],
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      setIsStreaming(true);

      // Use snapshot context if provided (from queued message), otherwise use live state
      const effectiveTimeRange = snapshotContext?.selectedTimeRange ?? selectedTimeRange;

      try {
        // Build context from editor state
        const context: {
          selectedTimeRange?: { startMs: number; endMs: number };
          selectedSceneId?: number;
          selectedElement?: { name: string; sceneId: number };
          selectedVisualItem?: { id: string; description: string };
        } = {};

        if (effectiveTimeRange) {
          context.selectedTimeRange = effectiveTimeRange;
        }

        if (aiContext) {
          if (aiContext.sceneId !== undefined) {
            context.selectedSceneId = aiContext.sceneId;
          }
          if (aiContext.element) {
            context.selectedElement = {
              name: aiContext.element.name,
              sceneId: aiContext.element.sceneId,
            };
          }
          if (aiContext.type === 'item' && aiContext.item) {
            context.selectedVisualItem = {
              id: aiContext.item.id,
              description: aiContext.item.name,
            };
          }
        }

        const controller = new AbortController();
        abortRef.current = controller;

        // Safety timeout — abort if no SSE events arrive for 2 minutes.
        // Resets on every event, so long-running jobs (10-30 min) stay alive
        // as long as heartbeats/progress keep arriving.
        let safetyTimeout = setTimeout(() => {
          controller.abort();
        }, 2 * 60 * 1000);

        const resetSafetyTimeout = () => {
          clearTimeout(safetyTimeout);
          safetyTimeout = setTimeout(() => {
            controller.abort();
          }, 2 * 60 * 1000);
        };

        try {
          const stream = await api.chatWithAgent(projectId, {
            message: fullMessage,
            context: Object.keys(context).length > 0 ? context : undefined,
            widgetResponse,
          }, controller.signal, lastEventIdRef.current ?? undefined);

          for await (const event of parseSSEStream(stream, { signal: controller.signal, inactivityTimeoutMs: 90_000 })) {
            resetSafetyTimeout();
            if (event.id !== undefined) lastEventIdRef.current = event.id;
            handleSSEEvent(event, assistantId);
          }

          // If stream ends without a 'done' event, stop streaming
          setIsStreaming(false);
          progressSourceRef.current = null;
        } finally {
          clearTimeout(safetyTimeout);
        }
      } catch (err) {
        // Ignore AbortError — this fires when the component unmounts or the user navigates away
        const isAbort = (err instanceof DOMException && err.name === 'AbortError')
          || (err instanceof Error && (err.message.includes('aborted') || err.message.includes('abort')));
        if (isAbort) {
          setIsStreaming(false);
          return;
        }

        const isTimeout = err instanceof SSETimeoutError;
        console.error('Chat error:', isTimeout ? 'SSE stream timed out' : err);

        // Check if error indicates sandbox needs booting
        const errorMsg = err instanceof Error ? err.message : String(err);
        if ((errorMsg.includes('Sandbox') || errorMsg.includes('502')) && !sandboxBootAttempted.current) {
          sandboxBootAttempted.current = true;
          bootAndRetryRef.current?.(fullMessage, widgetResponse).catch(console.error);
          return;
        }

        // Try to recover by loading the latest conversation state from the server.
        // The backend may have completed successfully even though the stream dropped.
        try {
          const data = await api.getConversation(projectId);
          if (data.messages && data.messages.length > 0) {
            const loaded: Message[] = data.messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: normalizeContent(m.content),
              createdAt: m.createdAt,
            }));

            // If there's an active job, restore progress bar and track via WebSocket
            // (skip WebSocket subscription for plan-visuals to avoid false "visuals ready")
            if (data.activeJob) {
              if (data.activeJob.jobType !== 'plan-visuals') {
                setActiveJobId(data.activeJob.id);
              }
              const progressBlock: ProgressBlock = {
                type: 'progress',
                percent: data.activeJob.progress ?? 0,
                message: data.activeJob.message || 'Processing...',
                phase: data.activeJob.phase,
                jobType: data.activeJob.jobType,
              };
              const lastAssistant = [...loaded].reverse().find((m) => m.role === 'assistant');
              if (lastAssistant) {
                lastAssistant.content = [...lastAssistant.content, progressBlock];
              }
            } else {
              // No active job — connection dropped and backend isn't running anything.
              // Show an error so the user knows the stream was interrupted.
              const recoveryError = sanitizeErrorMessage(
                err instanceof Error ? err.message : 'Connection lost',
              );
              const lastAssistant = [...loaded].reverse().find((m) => m.role === 'assistant');
              if (lastAssistant) {
                lastAssistant.content = [
                  ...lastAssistant.content,
                  { type: 'progress', percent: 0, message: recoveryError, error: true } as ProgressBlock,
                ];
              }
              setFailedMessageId(lastAssistant?.id ?? null);
              lastFailedPayload.current = { message: fullMessage, widgetResponse };
            }

            setMessages(loaded);
            if (data.conversationId) setConversationId(data.conversationId);

            clearCompositionCache();
            if (reloadVisuals) reloadVisuals(projectId);
            setIsStreaming(false);
            return;
          }
        } catch { /* recovery failed, show original error */ }

        const errorText = isTimeout
          ? 'Connection timed out. Your progress has been saved — try sending another message.'
          : sanitizeErrorMessage(err instanceof Error ? err.message : 'Connection failed');
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m;
            // Mark progress block as errored if one exists, otherwise add error text
            const hasProgress = m.content.some((b) => b.type === 'progress');
            if (hasProgress) {
              return {
                ...m,
                content: m.content.map((b) =>
                  b.type === 'progress'
                    ? { ...b, error: true, message: errorText }
                    : b,
                ),
              };
            }
            return {
              ...m,
              content: [...m.content, { type: 'text' as const, text: `\n\nError: ${errorText}` }],
            };
          })
        );
        setFailedMessageId(assistantId);
        lastFailedPayload.current = { message: fullMessage, widgetResponse };
        setIsStreaming(false);
      }
    },
    [projectId, aiContext, handleSSEEvent, reloadVisuals, selectedTimeRange, setSelectedTimeRange]
  );

  // -----------------------------------------------------------------------
  // Boot sandbox & retry message if sandbox was sleeping
  // -----------------------------------------------------------------------

  const bootAndRetry = useCallback(async (message: string, widgetResponse?: { widgetId: string; value: unknown }) => {
    try {
      // Silently restart sandbox — no status message needed since it resumes quickly
      await api.createSandbox(projectId);

      // Poll until ready (max 2 minutes)
      let ready = false;
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const status = await api.getSandboxStatus(projectId);
        if (status.status === 'ready') { ready = true; break; }
      }
      if (!ready) throw new Error('Sandbox failed to start within 2 minutes');

      // Retry the message
      sandboxBootAttempted.current = false;
      await _executeMessage({ messageText: message, fullMessage: message, widgetResponse });
    } catch (err) {
      sandboxBootAttempted.current = false;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => i === prev.length - 1
            ? { ...m, content: [{ type: 'text' as const, text: 'Failed to start sandbox. Please try again.' }] }
            : m
          );
        }
        return prev;
      });
      setIsStreaming(false);
    }
  }, [projectId, _executeMessage]);
  bootAndRetryRef.current = bootAndRetry;

  // -----------------------------------------------------------------------
  // Attachment helpers
  // -----------------------------------------------------------------------
  const handleAttachmentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newAttachments = Array.from(files).map(file => ({
      file,
      label: file.name.replace(/\.[^.]+$/, ''),
    }));
    setAttachmentFiles(prev => [...prev, ...newAttachments]);
    e.target.value = '';
  };

  // -----------------------------------------------------------------------
  // Send message (entry point — queues if streaming)
  // -----------------------------------------------------------------------

  const sendMessage = useCallback(
    async (messageText: string, widgetResponse?: { widgetId: string; value: unknown }, options?: { hidden?: boolean }) => {
      // Clear any previous failure state
      setFailedMessageId(null);
      lastFailedPayload.current = null;

      // Build the full message, prepending scene tags if any
      const currentTags = sceneTags;
      const currentTimeRange = selectedTimeRange;
      let fullMessage = messageText;
      if (currentTags.length > 0 && !widgetResponse && !options?.hidden) {
        const tagMeta = currentTags.map((t) => `Scene ${t.sceneIndex}: "${t.sceneTitle}"`).join(', ');
        const planJobId = currentTags[0].planJobId;
        fullMessage = `[Edit scenes: ${tagMeta} | planJobId: ${planJobId}]\n${messageText}`;
      }

      // If streaming and it's a regular user message, queue it
      if (isStreaming && messageText.trim() && !widgetResponse && !options?.hidden) {
        const userMsgId = generateId();
        const userMsg: Message = {
          id: userMsgId,
          role: 'user',
          content: [{ type: 'text', text: messageText }],
          createdAt: new Date().toISOString(),
          queued: true,
        };
        // Show scene tags / time range in display
        if (currentTags.length > 0) {
          const tagLabels = currentTags.map((t) => `Scene ${t.sceneIndex}`).join(', ');
          userMsg.content = [{ type: 'text', text: `**Editing ${tagLabels}:** ${messageText}` }];
        } else if (currentTimeRange) {
          const rangeLabel = `${formatTimeChip(currentTimeRange.startMs)} – ${formatTimeChip(currentTimeRange.endMs)}`;
          userMsg.content = [{ type: 'text', text: `**Editing ${rangeLabel}:** ${messageText}` }];
        }
        setMessages((prev) => [...prev, userMsg]);

        // Snapshot context at queue time
        messageQueueRef.current.push({
          id: userMsgId,
          text: messageText,
          fullMessage,
          context: {
            sceneTags: [...currentTags],
            selectedTimeRange: currentTimeRange ? { ...currentTimeRange } : null,
          },
        });
        setQueueSize(messageQueueRef.current.length);

        setInput('');
        setSceneTags([]);
        if (currentTimeRange) setSelectedTimeRange(null);
        return;
      }

      // Widget responses and hidden messages: existing behavior
      if (isStreaming) return;

      // Add user message to UI (skip for widget responses and hidden/auto-init messages)
      if (messageText.trim() && !widgetResponse && !options?.hidden) {
        const userMsg: Message = {
          id: generateId(),
          role: 'user',
          content: [{ type: 'text', text: messageText }],
          createdAt: new Date().toISOString(),
        };
        if (currentTags.length > 0) {
          const tagLabels = currentTags.map((t) => `Scene ${t.sceneIndex}`).join(', ');
          userMsg.content = [{ type: 'text', text: `**Editing ${tagLabels}:** ${messageText}` }];
        } else if (currentTimeRange) {
          const rangeLabel = `${formatTimeChip(currentTimeRange.startMs)} – ${formatTimeChip(currentTimeRange.endMs)}`;
          userMsg.content = [{ type: 'text', text: `**Editing ${rangeLabel}:** ${messageText}` }];
        }
        setMessages((prev) => [...prev, userMsg]);
      }

      setInput('');
      setSceneTags([]);
      if (currentTimeRange) setSelectedTimeRange(null);

      _executeMessage({ messageText, fullMessage, widgetResponse });
    },
    [isStreaming, projectId, aiContext, _executeMessage, sceneTags, selectedTimeRange, setSelectedTimeRange]
  );

  // -----------------------------------------------------------------------
  // Widget response handler
  // -----------------------------------------------------------------------

  const handleWidgetResponse = useCallback(
    (widgetId: string, value: unknown) => {
      if (isStreaming) {
        // Queue the response — it will be sent when the current stream ends
        pendingWidgetResponseRef.current.push({ widgetId, value });
        return;
      }

      // Mark the widget as responded in the UI
      setMessages((prev) =>
        prev.map((m) => ({
          ...m,
          content: m.content.map((block) => {
            if (block.type === 'widget' && block.widget.id === widgetId) {
              return { ...block, response: value };
            }
            return block;
          }),
        }))
      );

      // Send the response back to the agent
      sendMessage('', { widgetId, value });
    },
    [sendMessage, isStreaming]
  );

  // Flush queued widget responses one at a time when streaming stops.
  // Processing one triggers sendMessage → isStreaming=true → effect re-fires
  // on next stream completion, draining the queue sequentially.
  useEffect(() => {
    if (!isStreaming && pendingWidgetResponseRef.current.length > 0) {
      const next = pendingWidgetResponseRef.current.shift()!;
      handleWidgetResponse(next.widgetId, next.value);
    }
  }, [isStreaming, handleWidgetResponse]);

  // Flush queued user messages after streaming stops (widget responses take priority).
  useEffect(() => {
    if (!isStreaming && pendingWidgetResponseRef.current.length === 0 && messageQueueRef.current.length > 0) {
      const next = messageQueueRef.current.shift()!;
      setQueueSize(messageQueueRef.current.length);
      _executeMessage({
        messageText: next.text,
        fullMessage: next.fullMessage,
        existingUserMsgId: next.id,
        snapshotContext: next.context,
      });
    }
  }, [isStreaming, _executeMessage]);

  // Auto-send pending AI message (e.g. from "Change & AI Adapt" context menu)
  useEffect(() => {
    if (pendingAIMessage && !isStreaming && historyLoaded) {
      setPendingAIMessage(null);
      sendMessage(pendingAIMessage);
    }
  }, [pendingAIMessage, isStreaming, historyLoaded, sendMessage, setPendingAIMessage]);

  // -----------------------------------------------------------------------
  // Queue management
  // -----------------------------------------------------------------------

  const handleRemoveQueued = useCallback((messageId: string) => {
    messageQueueRef.current = messageQueueRef.current.filter((m) => m.id !== messageId);
    setQueueSize(messageQueueRef.current.length);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  const handleClearQueue = useCallback(() => {
    const queuedIds = new Set(messageQueueRef.current.map((m) => m.id));
    messageQueueRef.current = [];
    setQueueSize(0);
    setMessages((prev) => prev.filter((m) => !queuedIds.has(m.id)));
  }, []);

  // -----------------------------------------------------------------------
  // Retry failed message
  // -----------------------------------------------------------------------

  const handleRetry = useCallback(() => {
    if (!lastFailedPayload.current || isStreaming) return;

    // Remove the failed assistant message
    if (failedMessageId) {
      setMessages((prev) => prev.filter((m) => m.id !== failedMessageId));
    }

    const { message, widgetResponse } = lastFailedPayload.current;
    setFailedMessageId(null);
    lastFailedPayload.current = null;

    // Re-send — sendMessage will add a fresh assistant placeholder
    sendMessage(message, widgetResponse);
  }, [failedMessageId, isStreaming, sendMessage]);

  // -----------------------------------------------------------------------
  // Cancel / Stop handler
  // -----------------------------------------------------------------------

  const handleCancel = useCallback(async () => {
    // 1. Abort the SSE stream immediately (instant UI feedback)
    abortRef.current?.abort();

    // 2. Tell the backend to kill the worker job
    try {
      await api.cancelAgent(projectId);
    } catch {
      // Best-effort — SSE abort already stopped the frontend
    }

    // 3. Update UI state
    setIsStreaming(false);
    setActiveJobId(null);

    // 4. Replace progress block with cancellation message
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last?.role === 'assistant') {
        return [...prev.slice(0, -1), {
          ...last,
          content: [
            ...last.content.filter((b: any) => b.type !== 'progress'),
            { type: 'text' as const, text: '\n\n*Generation stopped.*' },
          ],
        }];
      }
      return prev;
    });
  }, [projectId]);

  // -----------------------------------------------------------------------
  // Auto-greet: have the AI start the conversation when panel opens
  // -----------------------------------------------------------------------

  const autoGreetSent = useRef(false);
  useEffect(() => {
    if (historyLoaded && messages.length === 0 && !isStreaming && !autoGreetSent.current) {
      autoGreetSent.current = true;

      // Check for creative brief from upload flow
      const brief = sessionStorage.getItem(`project-brief-${projectId}`);
      if (brief) {
        sessionStorage.removeItem(`project-brief-${projectId}`);
        // Send the brief as the first user message — AI jumps straight to planning
        sendMessage(brief, undefined, { hidden: false })
          .catch(() => { autoGreetSent.current = false; });
      } else {
        // No brief — generic greet
        sendMessage('[Start the conversation. Greet the user and offer to help.]', undefined, { hidden: true })
          .catch(() => { autoGreetSent.current = false; });
      }
    }
  }, [historyLoaded, messages.length, isStreaming, sendMessage, projectId]);

  // -----------------------------------------------------------------------
  // Reset (clear visuals + conversation, restart from scratch)
  // -----------------------------------------------------------------------

  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    if (isResetting) return;
    setIsResetting(true);

    // Cancel any in-flight jobs first (abort SSE + worker)
    abortRef.current?.abort();
    try {
      await api.cancelAgent(projectId);
    } catch {
      // Best-effort
    }
    setIsStreaming(false);
    setActiveJobId(null);
    // Clear persisted job ID so page refresh doesn't resume stale tracking
    sessionStorage.removeItem(`viona:activeJobId:${projectId}`);

    try {
      await Promise.all([
        api.clearConversation(projectId),
        api.deleteVisuals(projectId),
      ]);
    } catch (err) {
      console.error('Failed to reset:', err);
    }
    setMessages([]);
    setConversationId(null);
    setSceneTags([]);
    messageQueueRef.current = [];
    setQueueSize(0);
    progressState.reset();
    // Clear any pending attachments
    setAttachmentFiles([]);
    // Re-trigger auto-greet
    autoGreetSent.current = false;
    clearCompositionCache();
    // Await reloadVisuals so store syncs status/tracks before we unblock UI
    if (reloadVisuals) await reloadVisuals(projectId);
    setIsResetting(false);
  };

  // -----------------------------------------------------------------------
  // Clear context
  // -----------------------------------------------------------------------

  const handleClearContext = () => {
    setSelectedScene(null);
    setSelectedElement(null);
    clearSelection();
  };

  // -----------------------------------------------------------------------
  // Send with attachment
  // -----------------------------------------------------------------------
  const handleSendWithAttachment = useCallback(async () => {
    const text = input.trim();
    if (!text && attachmentFiles.length === 0) return;

    if (attachmentFiles.length > 0) {
      setAttachmentUploading(true);
      const labels: string[] = [];
      try {
        for (const { file, label } of attachmentFiles) {
          await api.uploadProjectMedia(projectId, file, label || undefined);
          labels.push(label || file.name);
        }
        const attachPrefix = labels.map(l => `[Attached: ${l}]`).join('\n');
        const fullText = text ? `${attachPrefix}\n${text}` : attachPrefix;
        setAttachmentFiles([]);
        setAttachmentUploading(false);
        setInput('');
        sendMessage(fullText);
      } catch (err) {
        console.error('Attachment upload failed:', err);
        // Remove successfully uploaded files, keep only un-uploaded ones
        const uploadedCount = labels.length;
        setAttachmentFiles(prev => prev.slice(uploadedCount));
        setAttachmentUploading(false);
        const msg = uploadedCount > 0
          ? `Uploaded ${uploadedCount} file(s) but failed on the rest. Please retry.`
          : 'Failed to upload attachment. Please try again.';
        setMessages(prev => [...prev, {
          id: generateId(),
          role: 'assistant' as const,
          content: [{ type: 'text' as const, text: msg }],
          createdAt: new Date().toISOString(),
        }]);
      }
    } else {
      setInput('');
      sendMessage(text);
    }
  }, [input, attachmentFiles, projectId, sendMessage]);

  // -----------------------------------------------------------------------
  // Key handler
  // -----------------------------------------------------------------------

  const canSend = input.trim().length > 0 || attachmentFiles.length > 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) {
        handleSendWithAttachment();
      }
    }
  };

  // -----------------------------------------------------------------------
  // Widget renderer
  // -----------------------------------------------------------------------

  const renderWidget = (block: WidgetBlock) => {
    const { widget, response } = block;
    const hasResponded = response !== undefined;

    switch (widget.kind) {
      case 'theme_picker':
        return (
          <ThemePicker
            onSelect={(themeId) => handleWidgetResponse(widget.id, themeId)}
            disabled={hasResponded || isStreaming}
            selectedValue={typeof response === 'string' ? response : undefined}
          />
        );

      case 'scene_plan': {
        const planJobId = widget.planJobId || '';
        return (
          <ScenePlanCard
            scenes={widget.scenes || []}
            scenePlanMarkdown={widget.scenePlanMarkdown}
            metadata={widget.metadata}
            planJobId={planJobId}
            onApprove={(iconSelections) => handleWidgetResponse(widget.id, {
              approved: true,
              planJobId,
              ...(iconSelections ? { selectedIcons: iconSelections } : {}),
            })}
            onReject={() => handleWidgetResponse(widget.id, { approved: false, planJobId })}
            onEditScene={(sceneIndex, sceneTitle) => {
              const tag: SceneTag = { sceneIndex: sceneIndex + 1, sceneTitle, planJobId };
              setSceneTags((prev) => {
                // Don't add duplicates
                if (prev.some((t) => t.sceneIndex === tag.sceneIndex && t.planJobId === tag.planJobId)) return prev;
                return [...prev, tag];
              });
              // Focus the input so the user can type their edit instructions
              textareaRef.current?.focus();
            }}
            onScenesUpdate={async (pjId, updatedScenes) => {
              try {
                const result = await api.updatePlanScenes(
                  projectId,
                  pjId,
                  updatedScenes.map((s, i) => ({
                    id: i + 1,
                    title: s.title,
                    description: s.description,
                  })),
                );
                if (result.success && result.scenes) {
                  // Update the widget's scenes in local message state
                  setMessages((prev) =>
                    prev.map((m) => ({
                      ...m,
                      content: m.content.map((block) => {
                        if (block.type === 'widget' && block.widget.id === widget.id) {
                          return { ...block, widget: { ...block.widget, scenes: result.scenes } };
                        }
                        return block;
                      }),
                    }))
                  );
                }
              } catch (err) {
                console.error('Failed to update plan scenes:', err);
              }
            }}
            disabled={hasResponded || isStreaming}
            approved={
              hasResponded
                ? typeof response === 'object' && response !== null && 'approved' in response
                  ? (response as { approved: boolean }).approved
                  : undefined
                : undefined
            }
          />
        );
      }

      case 'choice':
        return (
          <ChoiceWidget
            options={widget.options || []}
            onSelect={(value) => handleWidgetResponse(widget.id, value)}
            disabled={hasResponded || isStreaming}
            selectedValue={typeof response === 'string' ? response : undefined}
          />
        );

      case 'confirmation':
        return (
          <ConfirmationWidget
            message={widget.message || 'Proceed?'}
            onConfirm={() => handleWidgetResponse(widget.id, true)}
            onCancel={() => handleWidgetResponse(widget.id, false)}
            disabled={hasResponded || isStreaming}
            confirmed={typeof response === 'boolean' ? response : undefined}
          />
        );

      default:
        return (
          <div className="my-2 px-3 py-2 rounded-lg bg-[var(--editor-bg-hover)] border border-[var(--editor-border-subtle)] text-xs text-[var(--editor-text-muted)]">
            Unknown widget: {widget.kind}
          </div>
        );
    }
  };

  // -----------------------------------------------------------------------
  // Block renderer
  // -----------------------------------------------------------------------

  /** Merge adjacent text blocks into one so streaming chunks render as a single paragraph. */
  function mergeAdjacentTextBlocks(blocks: MessageBlock[]): MessageBlock[] {
    const merged: MessageBlock[] = [];
    for (const block of blocks) {
      const prev = merged[merged.length - 1];
      if (block.type === 'text' && prev?.type === 'text') {
        // Join with newline so markdown paragraphs stay separate
        merged[merged.length - 1] = { type: 'text', text: prev.text + '\n' + block.text };
      } else {
        merged.push(block);
      }
    }
    return merged;
  }

  /** Deduplicate widgets — keep only the LAST instance of each widget kind. */
  function deduplicateWidgets(blocks: MessageBlock[]): MessageBlock[] {
    const lastWidgetIndex = new Map<string, number>();
    blocks.forEach((block, i) => {
      if (block.type === 'widget' && block.widget.kind) {
        lastWidgetIndex.set(block.widget.kind, i);
      }
    });
    return blocks.filter((block, i) => {
      if (block.type === 'widget' && block.widget.kind && lastWidgetIndex.has(block.widget.kind)) {
        return i === lastWidgetIndex.get(block.widget.kind);
      }
      return true;
    });
  }

  const renderBlock = (block: MessageBlock, index: number) => {
    switch (block.type) {
      case 'text':
        return (
          <div key={index} className="prose-agent break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {block.text}
            </ReactMarkdown>
          </div>
        );

      case 'widget':
        return <div key={index}>{renderWidget(block)}</div>;

      case 'progress':
        if (block.error) {
          const errMsg = sanitizeErrorMessage(block.message || 'Something went wrong');
          const isNetwork = errMsg.includes('network') || errMsg.includes('Connection lost');
          const isTimeout = errMsg.includes('too long') || errMsg.includes('timed out');
          const isRateLimit = errMsg.includes('Too many requests');
          const isCancelled = errMsg.includes('cancelled');

          return (
            <div key={index} className="rounded-lg border border-[var(--editor-border-default)] bg-[var(--editor-bg-surface)] p-3 my-2">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center">
                  {isNetwork ? (
                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                  ) : isTimeout ? (
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--editor-text-primary)]">{errMsg}</p>
                  {!isCancelled && (
                    <div className="flex gap-2 mt-2.5">
                      {lastFailedPayload.current && (
                        <button
                          onClick={handleRetry}
                          disabled={isStreaming}
                          className="px-3 py-1 text-xs font-medium rounded-md
                                     bg-[var(--editor-accent)] text-white
                                     hover:opacity-90 transition-opacity disabled:opacity-40"
                        >
                          <RefreshCw className="w-3 h-3 inline-block mr-1 -mt-px" />
                          Retry
                        </button>
                      )}
                      {isRateLimit && (
                        <span className="px-3 py-1 text-[11px] text-[var(--editor-text-muted)] self-center">
                          Wait a moment, then retry
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        }

        // Progress is now shown via ActivityIndicator above the message list
        return null;
    }
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className={`flex flex-col h-full bg-[var(--editor-bg-surface)] border-r border-[var(--editor-border-subtle)] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--editor-border-subtle)]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--editor-text-primary)]">Chat</span>
        </div>
        <div className="flex items-center gap-1">
          {aiContext && (
            <span
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${
                aiContext.type === 'element'
                  ? 'bg-[var(--editor-accent-soft)] text-[var(--editor-accent)]'
                  : aiContext.type === 'item'
                    ? 'bg-[var(--editor-info-soft)] text-[var(--editor-info)]'
                    : 'bg-[var(--editor-accent-soft)] text-[var(--editor-accent)]'
              }`}
            >
              {aiContext.type === 'element' && <Target className="w-3 h-3" />}
              {aiContext.type === 'item' && <Box className="w-3 h-3" />}
              {aiContext.type === 'scene' && <Layers className="w-3 h-3" />}
              {aiContext.displayName}
            </span>
          )}
          {aiContext && (
            <button
              onClick={handleClearContext}
              className="px-2 py-1 text-[10px] text-[var(--editor-text-muted)] hover:text-[var(--editor-text-primary)] hover:bg-[var(--editor-bg-hover)] rounded transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={handleReset}
            disabled={isResetting}
            className="p-1.5 rounded-md hover:bg-[var(--editor-bg-hover)] transition-colors disabled:opacity-50"
            aria-label="Start over"
            title="Start over"
          >
            {isResetting ? (
              <Loader2 className="w-4 h-4 text-[var(--editor-text-muted)] animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4 text-[var(--editor-text-muted)] hover:text-[var(--editor-text-secondary)]" />
            )}
          </button>
        </div>
      </div>

      {/* Minimal progress indicator — pinned above messages */}
      <ActivityIndicator
        percent={progressState.progress?.percent ?? 0}
        message={progressState.progress?.message}
        isActive={!!progressState.progress && progressState.progress.percent < 100}
        error={false}
      />

      {/* Messages Area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {!historyLoaded ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-[var(--editor-accent)] animate-spin" />
            <p className="text-xs text-[var(--editor-text-muted)] mt-2">Loading conversation...</p>
          </div>
        ) : messages.length === 0 && !isStreaming ? (
          /* Empty state — only show if not already auto-greeting */
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-full bg-[var(--editor-accent-soft)] flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-[var(--editor-accent)] opacity-60" />
            </div>
            {aiContext ? (
              <>
                <p className="text-sm text-[var(--editor-text-secondary)] mb-1">
                  Editing: {aiContext.displayName}
                </p>
                {aiContext.displayDescription && (
                  <p className="text-xs text-[var(--editor-text-muted)] mb-2 max-w-[200px] truncate">
                    {aiContext.displayDescription}
                  </p>
                )}
                <p className="text-xs text-[var(--editor-text-muted)]">
                  Describe your changes below
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-[var(--editor-text-secondary)] mb-2">
                  Your AI creative director
                </p>
                <p className="text-xs text-[var(--editor-text-muted)] mb-1">
                  Describe what visuals you want to create
                </p>
                <p className="text-xs text-[var(--editor-text-muted)]">
                  I&apos;ll guide you through themes, layouts, and scenes
                </p>
              </>
            )}
          </div>
        ) : (
          /* Messages */
          messages
            .filter((m) => m.content.length > 0 || m.role === 'assistant')
            .map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} ${message.queued ? 'opacity-60' : ''}`}
            >
              <div
                className={`text-sm ${
                  message.content.some((b) => b.type === 'progress') ? 'w-full' : 'max-w-[90%]'
                } ${
                  message.role === 'user'
                    ? 'bg-[var(--editor-accent-soft)] border border-[var(--editor-accent)]/20 text-[var(--editor-text-primary)] rounded-2xl rounded-br-md px-4 py-2.5'
                    : 'bg-[var(--editor-bg-hover)] text-[var(--editor-text-primary)] rounded-2xl rounded-bl-md px-4 py-2.5'
                } ${message.queued ? 'border-dashed' : ''}`}
              >
                {message.queued && (
                  <div className="flex items-center justify-between gap-2 mb-1 text-[10px] text-[var(--editor-text-muted)]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" /> Queued
                    </span>
                    <button
                      onClick={() => handleRemoveQueued(message.id)}
                      className="hover:text-red-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                {message.content.length === 0 && isStreaming && (
                  <div className="flex gap-1 py-1">
                    <span
                      className="w-2 h-2 bg-[var(--editor-accent)] rounded-full animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <span
                      className="w-2 h-2 bg-[var(--editor-accent)] rounded-full animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="w-2 h-2 bg-[var(--editor-accent)] rounded-full animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                )}
                {deduplicateWidgets(mergeAdjacentTextBlocks(message.content)).map((block, i) => renderBlock(block, i))}
                {failedMessageId === message.id && !message.content.some((b) => b.type === 'progress' && b.error) && (
                  <button
                    onClick={handleRetry}
                    disabled={isStreaming}
                    className="mt-2 flex items-center gap-1.5 text-xs text-[var(--editor-accent)] hover:text-[var(--editor-accent-hover)] transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retry
                  </button>
                )}
              </div>
            </div>
          ))
        )}

        {stallState === 'stuck' && isStreaming && (
          <div className="flex items-center gap-2 text-xs text-red-500 px-3 py-1">
            <AlertCircle className="w-3 h-3" />
            This seems stuck.
            <button onClick={handleCancel} className="underline hover:no-underline">
              Stop &amp; retry
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="px-3 pb-3 pt-2">
        {/* Context chips */}
        {sceneTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {sceneTags.map((tag) => (
              <span
                key={`${tag.planJobId}-${tag.sceneIndex}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium
                           bg-[var(--editor-accent-soft)] text-[var(--editor-accent)] border border-[var(--editor-accent)]/25"
              >
                Scene {tag.sceneIndex}: {tag.sceneTitle}
                <button
                  onClick={() => setSceneTags((prev) => prev.filter((t) => t.sceneIndex !== tag.sceneIndex || t.planJobId !== tag.planJobId))}
                  className="ml-0.5 hover:text-[var(--editor-accent-hover)] transition-colors"
                  aria-label={`Remove Scene ${tag.sceneIndex}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {selectedTimeRange && sceneTags.length === 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium
                             bg-[var(--editor-info-soft)] text-[var(--editor-info)] border border-[var(--editor-info)]/25">
              {formatTimeChip(selectedTimeRange.startMs)} – {formatTimeChip(selectedTimeRange.endMs)}
              <button
                onClick={() => setSelectedTimeRange(null)}
                className="ml-0.5 hover:text-[var(--editor-info)] transition-colors"
                aria-label="Remove time range"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          </div>
        )}

        {/* Queue count indicator */}
        {queueSize > 0 && (
          <div className="flex items-center justify-between px-1 mb-1.5">
            <span className="text-[11px] text-[var(--editor-text-muted)] flex items-center gap-1">
              <ListOrdered className="w-3 h-3" />
              {queueSize} message{queueSize > 1 ? 's' : ''} queued
            </span>
            <button
              onClick={handleClearQueue}
              className="text-[11px] text-[var(--editor-text-muted)] hover:text-[var(--editor-text-secondary)] transition-colors"
            >
              Clear queue
            </button>
          </div>
        )}

        {/* Attachment chips */}
        {attachmentFiles.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            {attachmentFiles.map((att, idx) => (
              <span key={`${att.file.name}-${att.file.lastModified}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium
                               bg-[var(--editor-accent-soft)] text-[var(--editor-accent)] border border-[var(--editor-accent)]/25">
                <Paperclip className="w-3 h-3" />
                <input
                  type="text"
                  value={att.label}
                  onChange={(e) => setAttachmentFiles(prev => prev.map((a, i) => i === idx ? { ...a, label: e.target.value } : a))}
                  className="bg-transparent outline-none text-[11px] w-24 max-w-[120px]"
                  placeholder="Label..."
                />
                <button
                  onClick={() => setAttachmentFiles(prev => prev.filter((_, i) => i !== idx))}
                  className="ml-0.5 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {attachmentUploading && (
              <Loader2 className="w-3 h-3 animate-spin text-[var(--editor-text-muted)]" />
            )}
          </div>
        )}

        {/* Hidden attachment input */}
        <input
          ref={attachmentInputRef}
          type="file"
          accept="image/*,.svg"
          multiple
          className="hidden"
          onChange={handleAttachmentSelect}
        />

        <div className="relative flex items-end rounded-xl border border-[var(--editor-border-subtle)]
                        bg-[var(--editor-bg-elevated)]">
          {/* Paperclip button */}
          <button
            onClick={() => attachmentInputRef.current?.click()}
            className="absolute left-2 bottom-2.5 w-6 h-6 flex items-center justify-center
                       rounded-md text-[var(--editor-text-muted)]
                       hover:text-[var(--editor-text-secondary)] hover:bg-[var(--editor-bg-hover)]
                       active:scale-95 transition-all"
            title="Attach an image"
          >
            <Paperclip className="w-3.5 h-3.5" />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isStreaming
                ? 'Type to queue another message...'
                : sceneTags.length > 0
                  ? `Describe changes to ${sceneTags.map((t) => `Scene ${t.sceneIndex}`).join(', ')}...`
                  : selectedTimeRange
                    ? `Describe changes for ${formatTimeChip(selectedTimeRange.startMs)} – ${formatTimeChip(selectedTimeRange.endMs)}...`
                    : aiContext
                      ? `Describe changes to ${aiContext.displayName}...`
                      : 'Ask anything...'
            }
            rows={3}
            className={`flex-1 bg-transparent text-[var(--editor-text-primary)] text-sm
                       placeholder:text-[var(--editor-text-muted)]
                       pl-9 py-3
                       outline-none! focus:outline-none! focus-visible:outline-none!
                       resize-none ${isStreaming ? 'pr-[4.5rem]' : 'pr-11'}`}
          />
          {/* Stop button — shown during streaming, always left of send */}
          {isStreaming && (
            <button
              onClick={handleCancel}
              className="absolute right-10 bottom-2.5 w-6 h-6 flex items-center justify-center
                         rounded-md border border-[var(--editor-border-default)]
                         bg-[var(--editor-bg-surface)] text-[var(--editor-text-muted)]
                         hover:text-[var(--editor-text-secondary)] hover:bg-[var(--editor-bg-hover)]
                         active:scale-95 transition-all"
              title="Stop generating"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
            </button>
          )}
          {/* Send/Queue button — always visible on the right */}
          <button
            onClick={() => canSend && handleSendWithAttachment()}
            disabled={!canSend}
            className={`absolute right-2 bottom-2 w-7 h-7 flex items-center justify-center
                       rounded-lg active:scale-95 transition-all
                       ${isStreaming
                         ? 'bg-[var(--editor-accent-soft)] text-[var(--editor-accent)] hover:bg-[var(--editor-accent-soft)]/80 disabled:bg-[var(--editor-bg-hover)] disabled:text-[var(--editor-text-muted)]'
                         : 'bg-white text-[var(--editor-text-primary)] hover:bg-[var(--editor-bg-hover)] disabled:bg-[var(--editor-bg-hover)] disabled:text-[var(--editor-text-muted)]'
                       }`}
            title={isStreaming ? 'Queue message' : 'Send message'}
          >
            {isStreaming ? <Plus className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
