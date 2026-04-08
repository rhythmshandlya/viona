/**
 * AI Assistant Panel — Thin container.
 * Owns SSE lifecycle, message state, and transient progress.
 * Delegates rendering to ai-chat/ child components.
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles, Loader2, RotateCcw, RefreshCw,
  Target, Box, Layers, ListChecks, ChevronDown,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseSSEStream, SSETimeoutError } from '@/lib/sse-parser';
import { clearCompositionCache } from '../player/useWorkspaceComposition';
import {
  useVideoSettings, useProjectActions, useAIActions, useTimelineActions,
  useAIEditingContext, useAIEditRequested, usePendingAIMessage,
  useSelectedTimeRange, useEditorStore,
} from '../store/use-editor-store';
import { useJobWebSocket } from '../hooks/use-job-websocket';
import { useActivity } from '../hooks/use-progress';
import { useActiveTasks } from '../hooks/use-progress';
import { ChatMessageList } from './ai-chat/ChatMessageList';
import { ChatInput } from './ai-chat/ChatInput';
import type { ChatInputHandle, ContextChip, AttachmentChip } from './ai-chat/ChatInput';
import type { Message, MessageBlock, WidgetBlock, PlanBlock, ProgressState, ActiveTask, AgentPlan } from './ai-chat/types';
import { AgentPlanView } from '@/components/ui/agent-plan';

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

function sanitizeErrorMessage(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('network error') || lower.includes('failed to fetch') || lower.includes('fetch failed') || lower.includes('connection lost') || lower.includes('networkerror'))
    return 'Connection lost. Please check your network and try again.';
  if (lower.includes('prompt is too long'))
    return 'This project has too many files for a single edit. Try targeting a specific scene instead.';
  if (lower.includes('timed out') || lower.includes('timeout'))
    return 'The operation took too long. Please try again with a simpler request.';
  if (lower.includes('cancelled') || lower.includes('canceled'))
    return 'Generation was cancelled.';
  if (lower.includes('crashed') || lower.includes('oom') || lower.includes('out of memory'))
    return 'The AI ran into a resource limit. Try a simpler edit or target a specific scene.';
  if (lower.includes('exited with code') || lower.includes('process exited'))
    return 'Something went wrong during generation. Please try again.';
  if (lower.includes('authentication') || lower.includes('unauthorized') || lower.includes('credentials'))
    return 'AI service authentication failed. Please contact support.';
  if (lower.includes('rate limit') || lower.includes('429'))
    return 'Too many requests. Please wait a moment and try again.';
  if (raw.length > 120)
    return 'Something went wrong. Please try again or try a different approach.';
  return raw;
}

const internalPattern = /\[Widget response:[^\]]*\]|\[Selected (?:time range|scene|element):[^\]]*\]|\[Editing visuals:[^\]]*\]|\[Start the conversation\.[^\]]*\]/g;

function normalizeContent(raw: unknown): MessageBlock[] {
  if (Array.isArray(raw)) {
    return (raw as Array<Record<string, unknown> & MessageBlock>)
      .filter((b) => !(b as any).hidden)
      .map((b) => {
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SceneTag {
  sceneIndex: number; // 1-indexed
  sceneTitle: string;
  planJobId: string;
}

interface AIAssistantPanelProps {
  projectId: string;
  onEditComplete?: () => void;
  className?: string;
}

// -- Widget response persistence (survives page refresh) --
const PENDING_WIDGET_KEY_PREFIX = 'viona:pendingWidgets:';
function getPendingWidgetResponses(projectId: string): Array<{ widgetId: string; value: unknown }> {
  try {
    const stored = sessionStorage.getItem(`${PENDING_WIDGET_KEY_PREFIX}${projectId}`);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}
function setPendingWidgetResponses(projectId: string, responses: Array<{ widgetId: string; value: unknown }>) {
  try {
    if (responses.length === 0) {
      sessionStorage.removeItem(`${PENDING_WIDGET_KEY_PREFIX}${projectId}`);
    } else {
      sessionStorage.setItem(`${PENDING_WIDGET_KEY_PREFIX}${projectId}`, JSON.stringify(responses));
    }
  } catch { /* storage full — non-critical */ }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AIAssistantPanel({ projectId, onEditComplete, className = '' }: AIAssistantPanelProps) {
  // -- State ---------------------------------------------------------------
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [sceneTags, setSceneTags] = useState<SceneTag[]>([]);
  const streamingCountRef = useRef(0);
  const [failedMessageId, setFailedMessageId] = useState<string | null>(null);
  const lastFailedPayload = useRef<{ message: string; widgetResponse?: { widgetId: string; value: unknown } } | null>(null);
  const [currentProgress, setCurrentProgress] = useState<ProgressState | null>(null);
  const [attachmentFiles, setAttachmentFiles] = useState<{ file: File; label: string }[]>([]);
  const [attachmentUploading, setAttachmentUploading] = useState(false);

  const [lastError, setLastError] = useState<string | null>(null);
  const [showTypingDot, setShowTypingDot] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<AgentPlan | null>(null);
  const [planExpanded, setPlanExpanded] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(() => {
    try { return sessionStorage.getItem(`viona:activeJobId:${projectId}`) || null; }
    catch { return null; }
  });

  // Helper: decrement streaming counter, only clear isStreaming when all turns done
  const decrementStreaming = useCallback(() => {
    streamingCountRef.current = Math.max(0, streamingCountRef.current - 1);
    if (streamingCountRef.current <= 0) {
      decrementStreaming();
    }
  }, []);

  // -- Refs ----------------------------------------------------------------
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const chatInputRef = useRef<ChatInputHandle>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sandboxBootAttempted = useRef(false);
  const bootAndRetryRef = useRef<((message: string, widgetResponse?: { widgetId: string; value: unknown }) => Promise<void>) | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const lastTextTimeRef = useRef(Date.now());
  const receivedDoneRef = useRef(false);
  const lastTextDedupRef = useRef<{ text: string; time: number }>({ text: '', time: 0 });
  // When true, the next text chunk starts a new TextBlock (separate chat bubble)
  const textBoundaryRef = useRef(false);

  // -- Hooks ---------------------------------------------------------------
  const activityState = useActivity();
  const activeTasksState = useActiveTasks();
  const setAgentActivity = useEditorStore((s) => s.setAgentActivity);
  const setAgentBusy = useEditorStore((s) => s.setAgentBusy);
  const videoSettings = useVideoSettings();
  const aiContext = useAIEditingContext();
  const selectedTimeRange = useSelectedTimeRange();
  const aiEditRequested = useAIEditRequested();
  const pendingAIMessage = usePendingAIMessage();
  const sandboxStatus = useEditorStore((s) => s.sandboxStatus);
  const { reloadVisuals, loadProject } = useProjectActions();
  const { setSelectedScene, setSelectedElement, setSelectedTimeRange, setPendingAIMessage } = useAIActions();
  const { clearSelection } = useTimelineActions();

  // -- WebSocket for job progress ------------------------------------------
  const { subscribeToJob } = useJobWebSocket(projectId, {
    onProgress: (data) => {
            activityState.onProgress({
        message: data.message || `Processing... (${data.progress}%)`,
        phase: data.meta?.phase || data.phase,
        agentName: data.meta?.agentName,
      });
    },
    onComplete: (data) => {
      if (data.jobId !== activeJobId) return;
      setActiveJobId(null);
      activityState.reset();
      setLastError(null);
      setCurrentProgress(null);
      setMessages((prev) => [...prev, {
        id: generateId(), role: 'assistant',
        content: [{ type: 'text', text: 'Your visuals are ready! Take a look and let me know if you\'d like any changes.' }],
        createdAt: new Date().toISOString(),
      }]);
      clearCompositionCache();
      if (reloadVisuals) reloadVisuals(projectId);
    },
    onError: (data) => {
      if (data.jobId !== activeJobId) return;
      setActiveJobId(null);
      setCurrentProgress(null);
      const errMsg = sanitizeErrorMessage(data.error || 'Generation failed');
      setLastError(errMsg);
      activityState.reset();
      setMessages((prev) => {
        const last = [...prev].reverse().find((m) => m.role === 'assistant');
        if (!last) return prev;
        return prev.map((m) => m.id !== last.id ? m : {
          ...m, content: [...m.content, { type: 'text' as const, text: `\u26A0 ${errMsg}` }],
        });
      });
    },
    onHealth: (data) => { activityState.onHeartbeat(data as Record<string, unknown>); },
    onActivity: (data) => { activityState.onActivity(data as Record<string, unknown>); },
  });

  // -- Effects -------------------------------------------------------------

  // Sync activity to global store (so editor shows indicator when chat is closed)
  useEffect(() => {
    if (activityState.activity) {
      setAgentActivity({
        agent: activityState.activity.agent || 'Agent',
        action: activityState.activity.action || null,
        startedAt: activityState.activity.startedAt || Date.now(),
      });
    } else {
      setAgentActivity(null);
    }
  }, [activityState.activity, setAgentActivity]);

  // Sync agentBusy to global store (so editor can show activity dot when chat is closed)
  useEffect(() => {
    setAgentBusy(activeTasksState.busy);
  }, [activeTasksState.busy, setAgentBusy]);

  // Persist activeJobId to sessionStorage
  useEffect(() => {
    try {
      if (activeJobId) sessionStorage.setItem(`viona:activeJobId:${projectId}`, activeJobId);
      else sessionStorage.removeItem(`viona:activeJobId:${projectId}`);
    } catch {}
  }, [activeJobId, projectId]);

  // Subscribe to job updates
  useEffect(() => { if (activeJobId) subscribeToJob(activeJobId); }, [activeJobId, subscribeToJob]);

  // HTTP polling fallback for job progress
  useEffect(() => {
    if (!activeJobId || isStreaming) return;
    const poll = async () => {
      try {
        const job = await api.getJob(activeJobId);
                if (job.status === 'complete') {
          setActiveJobId(null); activityState.reset(); setLastError(null); setCurrentProgress(null);
          setMessages(prev => [...prev, {
            id: generateId(), role: 'assistant' as const,
            content: [{ type: 'text' as const, text: 'Your visuals are ready! Take a look and let me know if you\'d like any changes.' }],
            createdAt: new Date().toISOString(),
          }]);
          clearCompositionCache();
          if (reloadVisuals) reloadVisuals(projectId);
          return;
        }
        if (job.status === 'failed' || job.status === 'cancelled') {
          setActiveJobId(null); setCurrentProgress(null);
          const errMsg = sanitizeErrorMessage(job.error || 'Generation failed');
          setLastError(errMsg); activityState.reset();
          setMessages(prev => {
            const last = [...prev].reverse().find(m => m.role === 'assistant');
            if (!last) return prev;
            return prev.map(m => m.id !== last.id ? m : { ...m, content: [...m.content, { type: 'text' as const, text: `\u26A0 ${errMsg}` }] });
          });
          return;
        }
        activityState.onProgress({
          message: job.progressMessage || `Processing... (${job.progress}%)`,
          phase: (job.progressMeta as any)?.phase,
          agentName: (job.progressMeta as any)?.agentName,
        });
      } catch { /* retry next interval */ }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [activeJobId, isStreaming, projectId, reloadVisuals, activityState]);

  const onProgressReceived = useCallback(() => {
    // no-op — progress timing tracked by recovery polling
  }, []);

  // Typing dot
  useEffect(() => {
    if (!isStreaming) { setShowTypingDot(false); return; }
    const check = setInterval(() => {
      setShowTypingDot(Date.now() - lastTextTimeRef.current > 500);
    }, 200);
    return () => clearInterval(check);
  }, [isStreaming]);

  // Backend connectivity heartbeat — verify sandbox is reachable every 30s while streaming.
  // Also restores the progress pill from Redis if the page was refreshed mid-stream.
  useEffect(() => {
    if (!isStreaming) return;
    const check = async () => {
      try {
        const status = await api.getSandboxStatus(projectId);
        if (status.status !== 'ready') {
          console.warn('[heartbeat] sandbox status:', status.status);
        }
        // Restore progress pill from Redis (survives page refresh)
        if (status.agentProgress?.message) {
          setCurrentProgress((prev) => prev ?? {
            phase: status.agentProgress!.phase || 'working',
            message: status.agentProgress!.message,
            agentName: status.agentProgress!.agentName,
            startedAt: Date.now(),
          });
        }
      } catch (err) {
        console.warn('[heartbeat] backend unreachable:', err);
      }
    };
    // Run immediately on mount to restore state, then every 30s
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [isStreaming, projectId]);

  // Abort on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Scroll tracking
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // React to "Edit with AI" context menu
  useEffect(() => {
    if (aiEditRequested) {
      useEditorStore.setState({ aiEditRequested: false });
      requestAnimationFrame(() => { chatInputRef.current?.focus(); });
    }
  }, [aiEditRequested]);

  // Load conversation history on mount
  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      try {
        const data = await api.getConversation(projectId);
        if (cancelled) return;
        if (data.conversationId) setConversationId(data.conversationId);
        if (data.messages && data.messages.length > 0) {
          let loaded: Message[] = data.messages.map((m) => ({
            id: m.id, role: m.role, content: normalizeContent(m.content), createdAt: m.createdAt,
          }));
          if (data.activeJob) {
            if (data.activeJob.jobType !== 'plan-visuals') setActiveJobId(data.activeJob.id);
            activityState.onProgress({ message: data.activeJob.message || 'Processing...', phase: data.activeJob.phase });
          }
          const sandboxActivity = (data as any).sandboxActivity;
          if (sandboxActivity?.agent && !data.activeJob) {
            activityState.onActivity(sandboxActivity as Record<string, unknown>);
          }
          // Restore activeTasks from API (new resilient progress model)
          if (data.activeTasks && data.activeTasks.length > 0) {
            activeTasksState.restoreFromApi(data.activeTasks, data.busy ?? true);
            setIsStreaming(true);
            // Start recovery polling since we may have missed SSE events
            startRecoveryPolling();
          } else if (data.busy) {
            activeTasksState.restoreFromApi([], true);
            setIsStreaming(true);
            startRecoveryPolling();
          }
          // Restore progress pill from Redis (survives page refresh) — legacy path
          const sandboxProgress = (data as any).sandboxProgress;
          if (sandboxProgress?.message && !data.busy) {
            setCurrentProgress({
              phase: sandboxProgress.phase || 'working',
              message: sandboxProgress.message,
              agentName: sandboxProgress.agentName,
              startedAt: Date.now(),
            });
            setIsStreaming(true);
          }
          // Restore plan from Redis if available
          const sandboxPlan = data.sandboxPlan;
          if (sandboxPlan) {
            setCurrentPlan(sandboxPlan as AgentPlan);
          }
          // Restore widget from Redis if available (survives SSE disconnect)
          const sandboxWidget = (data as any).sandboxWidget;
          if (sandboxWidget) {
            const lastAssistant = [...loaded].reverse().find(m => m.role === 'assistant');
            if (lastAssistant && !lastAssistant.content.some(b => b.type === 'widget')) {
              lastAssistant.content = [...lastAssistant.content, { type: 'widget', widget: sandboxWidget as any }];
            }
          }
          // Extract plan blocks from messages into dedicated state and strip from message content
          let restoredPlan: AgentPlan | null = null;
          for (const m of loaded) {
            const planBlock = m.content.find(b => b.type === 'plan') as PlanBlock | undefined;
            if (planBlock) restoredPlan = planBlock.plan;
            m.content = m.content.filter(b => b.type !== 'plan');
          }
          if (restoredPlan) setCurrentPlan(restoredPlan);
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
  // Recovery polling — used when SSE stream dies but sandbox may still be working.
  // Polls getSandboxStatus every 5s for up to 30 minutes.
  // -----------------------------------------------------------------------

  const recoveryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopRecoveryPolling = useCallback(() => {
    if (recoveryTimerRef.current) {
      clearInterval(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
  }, []);

  const startRecoveryPolling = useCallback(() => {
    stopRecoveryPolling();
    const MAX_POLL_MS = 5 * 60 * 1000; // 5 min — don't trap user in loading state
    const POLL_INTERVAL = 3000;
    const startedAt = Date.now();

    console.info('[recovery] Starting status polling...');

    recoveryTimerRef.current = setInterval(async () => {
      if (Date.now() - startedAt > MAX_POLL_MS) {
        stopRecoveryPolling();
        decrementStreaming();
        setCurrentProgress(null);
        activeTasksState.onDone();
        activityState.reset();
        setLastError('Lost connection to the sandbox. Please try sending another message.');
        return;
      }
      try {
        const status = await api.getSandboxStatus(projectId);
        if (status.busy) {
          activeTasksState.restoreFromApi(status.activeTasks ?? [], true);
        } else {
          stopRecoveryPolling();
          activeTasksState.onDone();
          activityState.reset();
          setCurrentProgress(null);
          decrementStreaming();
          setLastError(null);
          // Reload messages from server
          try {
            const data = await api.getConversation(projectId);
            if (data.messages && data.messages.length > 0) {
              const loaded: Message[] = data.messages.map((m) => ({
                id: m.id, role: m.role, content: normalizeContent(m.content), createdAt: m.createdAt,
              }));
              // Restore widget from Redis (lost during SSE disconnect)
              const sandboxWidget = (data as any).sandboxWidget;
              if (sandboxWidget) {
                const lastAssistant = [...loaded].reverse().find(m => m.role === 'assistant');
                if (lastAssistant && !lastAssistant.content.some(b => b.type === 'widget')) {
                  lastAssistant.content = [...lastAssistant.content, { type: 'widget', widget: sandboxWidget as any }];
                }
              }
              // Restore plan from Redis
              const sandboxPlan = (data as any).sandboxPlan;
              if (sandboxPlan) {
                setCurrentPlan(sandboxPlan as AgentPlan);
              }
              setMessages(loaded);
              if (data.conversationId) setConversationId(data.conversationId);
            }
          } catch { /* best effort */ }
          clearCompositionCache();
          if (reloadVisuals) reloadVisuals(projectId);
        }
      } catch {
        console.warn('[recovery] Poll failed, retrying...');
      }
    }, POLL_INTERVAL);
  }, [projectId, reloadVisuals, activityState, activeTasksState, stopRecoveryPolling]);

  // Cancel recovery polling on unmount
  useEffect(() => () => { stopRecoveryPolling(); }, [stopRecoveryPolling]);

  // -----------------------------------------------------------------------
  // SSE event handler
  // -----------------------------------------------------------------------

  const handleSSEEvent = useCallback(
    (event: { event: string; data: unknown }, assistantMessageId: string) => {
      const { event: eventType, data } = event;

      // Non-content events
      switch (eventType) {
        case 'task_started': {
          const taskData = data as ActiveTask;
          activeTasksState.onTaskStarted(taskData);
          textBoundaryRef.current = true;
          return;
        }
        case 'task_updated': {
          const updateData = data as { id: string; action: string };
          activeTasksState.onTaskUpdated(updateData.id, updateData.action);
          return;
        }
        case 'task_completed': {
          const completeData = data as { id: string };
          activeTasksState.onTaskCompleted(completeData.id);
          textBoundaryRef.current = true;
          return;
        }
        case 'activity':
          activityState.onActivity(data as Record<string, unknown>);
          return;
        case 'heartbeat':
        case 'health': {
          activityState.onHeartbeat(data as Record<string, unknown>);
          // Don't call restoreFromApi from heartbeats during active SSE streaming —
          // SSE task events (task_started/task_completed) are authoritative.
          // restoreFromApi from heartbeats would race with onTaskCompleted's removal
          // timers, causing completed tasks to linger in the list.
          // Recovery polling handles reconnection scenarios separately.
          return;
        }
        case 'progress': {
          onProgressReceived();
          const pd = data as { message?: string; phase?: string; agentName?: string; jobId?: string; error?: boolean };
          activityState.onProgress(pd as Record<string, unknown>);
          if (pd.message) {
            setCurrentProgress((prev) => ({
              phase: pd.phase || 'working',
              message: pd.message!,
              agentName: pd.agentName,
              startedAt: prev?.startedAt ?? Date.now(),
            }));
          }
          if (pd.error) setActiveJobId(null);
          else if (pd.jobId) setActiveJobId(pd.jobId);
          return;
        }
      }

      // agent_plan is handled outside of setMessages — update dedicated state
      if (eventType === 'agent_plan') {
        const planData = data as AgentPlan;
        setCurrentPlan(planData);
        setPlanExpanded(true);
        return;
      }

      // Content-modifying events
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantMessageId) return m;
          const blocks = [...m.content];

          switch (eventType) {
            case 'reset':
              // Clear text blocks, keep widgets
              return { ...m, content: blocks.filter(b => b.type === 'widget') };

            case 'text': {
              const now = Date.now();
              lastTextTimeRef.current = now;
              const textData = data as { text: string };
              const chunk = textData.text;

              // Dedup: skip identical consecutive text chunks within 100ms
              // (catches transport-level duplication)
              if (chunk && chunk === lastTextDedupRef.current.text && now - lastTextDedupRef.current.time < 100) {
                break;
              }
              if (chunk) {
                lastTextDedupRef.current = { text: chunk, time: now };
              }

              // If a boundary was set (subagent dispatched/completed, phase change),
              // force a new TextBlock so it renders as a separate chat bubble.
              const forceNew = textBoundaryRef.current;
              if (forceNew) textBoundaryRef.current = false;

              const last = blocks[blocks.length - 1];
              if (last && last.type === 'text' && !forceNew) {
                blocks[blocks.length - 1] = { ...last, text: last.text + chunk };
              } else {
                blocks.push({ type: 'text', text: chunk });
              }
              break;
            }

            case 'widget': {
              const widgetData = data as WidgetBlock['widget'];
              blocks.push({ type: 'widget', widget: widgetData });
              break;
            }

            case 'error': {
              const errorData = data as { message?: string; error?: string };
              const errMsg = sanitizeErrorMessage(errorData.message || errorData.error || 'Something went wrong');
              blocks.push({ type: 'text', text: `\u26A0 ${errMsg}` });
              break;
            }

            default:
              break;
          }

          return { ...m, content: blocks };
        })
      );

      // Post-content event handling
      if (eventType === 'done') {
        receivedDoneRef.current = true;
        stopRecoveryPolling();
        const doneData = data as { conversationId?: string };
        if (doneData.conversationId) setConversationId(doneData.conversationId);
        decrementStreaming();
        setCurrentProgress(null);
        activeTasksState.onDone();
        activityState.reset();
        setLastError(null);
        clearCompositionCache();
        if (reloadVisuals) reloadVisuals(projectId);
        if (onEditComplete) onEditComplete();
      }

      if (eventType === 'error') {
        const errorData = data as { message?: string; error?: string; recoverable?: boolean };
        if (errorData.recoverable) {
          // Stream interrupted but work may still be in progress — poll for recovery
          console.info('[SSE] Recoverable error received, entering recovery polling');
          startRecoveryPolling();
          return;
        }
        decrementStreaming();
        setActiveJobId(null);
        setCurrentProgress(null);
        activeTasksState.onDone();
        setLastError(sanitizeErrorMessage(errorData.message || errorData.error || 'Something went wrong'));
        activityState.reset();
      }
    },
    [projectId, reloadVisuals, onEditComplete, onProgressReceived, activityState, activeTasksState, startRecoveryPolling, stopRecoveryPolling]
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
      snapshotContext?: { sceneTags: SceneTag[]; selectedTimeRange: { startMs: number; endMs: number } | null };
    }) => {
      const { messageText, fullMessage, widgetResponse, existingUserMsgId, snapshotContext } = params;

      if (existingUserMsgId) {
        setMessages((prev) => prev.map((m) => m.id === existingUserMsgId ? { ...m, queued: false } : m));
      }

      const assistantId = generateId();
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: [], createdAt: new Date().toISOString() }]);
      streamingCountRef.current++;
      setIsStreaming(true);
      lastTextDedupRef.current = { text: '', time: 0 }; // Reset dedup for new message
      textBoundaryRef.current = false; // Reset boundary for new message

      const effectiveTimeRange = snapshotContext?.selectedTimeRange ?? selectedTimeRange;

      try {
        const context: Record<string, unknown> = {};
        if (effectiveTimeRange) context.selectedTimeRange = effectiveTimeRange;
        if (aiContext) {
          if (aiContext.sceneId !== undefined) context.selectedSceneId = aiContext.sceneId;
          if (aiContext.element) context.selectedElement = { name: aiContext.element.name, sceneId: aiContext.element.sceneId };
          if (aiContext.type === 'item' && aiContext.item) context.selectedVisualItem = { id: aiContext.item.id, description: aiContext.item.name };
        }

        const controller = new AbortController();
        abortRef.current = controller;

        // Long-running agents can work for 10+ minutes — safety timeout is per-event,
        // not total. Sandbox heartbeats every 15s reset this. 5 min without ANY event
        // (including heartbeats) means the connection is truly dead.
        let safetyTimeout = setTimeout(() => controller.abort(), 5 * 60 * 1000);
        const resetSafetyTimeout = () => {
          clearTimeout(safetyTimeout);
          safetyTimeout = setTimeout(() => controller.abort(), 5 * 60 * 1000);
        };

        try {
          receivedDoneRef.current = false;

          const stream = await api.chatWithAgent(projectId, {
            message: fullMessage,
            context: Object.keys(context).length > 0 ? context : undefined,
            widgetResponse,
          }, controller.signal);

          // Sandbox sends heartbeats every 15s — 3 min without any data means connection is dead
          for await (const event of parseSSEStream(stream, { signal: controller.signal, inactivityTimeoutMs: 3 * 60 * 1000 })) {
            resetSafetyTimeout();
            handleSSEEvent(event, assistantId);
          }

          // If stream ended without a done event, attempt recovery polling
          if (!receivedDoneRef.current) {
            console.warn('SSE stream ended without done event — attempting recovery');
            startRecoveryPolling();
          } else {
            decrementStreaming();
          }
        } finally {
          clearTimeout(safetyTimeout);
        }
      } catch (err) {
        const isAbort = (err instanceof DOMException && err.name === 'AbortError')
          || (err instanceof Error && (err.message.includes('aborted') || err.message.includes('abort')));
        if (isAbort) { decrementStreaming(); return; }

        const isTimeout = err instanceof SSETimeoutError;
        console.error('Chat error:', isTimeout ? 'SSE stream timed out' : err);

        const errorMsg = err instanceof Error ? err.message : String(err);
        if ((errorMsg.includes('Sandbox') || errorMsg.includes('502')) && !sandboxBootAttempted.current) {
          sandboxBootAttempted.current = true;
          bootAndRetryRef.current?.(fullMessage, widgetResponse).catch(console.error);
          return;
        }

        // Try recovery from server
        try {
          const data = await api.getConversation(projectId);
          if (data.messages && data.messages.length > 0) {
            const loaded: Message[] = data.messages.map((m) => ({
              id: m.id, role: m.role, content: normalizeContent(m.content), createdAt: m.createdAt,
            }));
            if (data.activeJob) {
              if (data.activeJob.jobType !== 'plan-visuals') setActiveJobId(data.activeJob.id);
              activityState.onProgress({ message: data.activeJob.message || 'Processing...', phase: data.activeJob.phase });
            } else {
              const recoveryError = sanitizeErrorMessage(err instanceof Error ? err.message : 'Connection lost');
              setLastError(recoveryError);
              const lastAssistant = [...loaded].reverse().find((m) => m.role === 'assistant');
              if (lastAssistant) {
                lastAssistant.content = [...lastAssistant.content, { type: 'text', text: `\u26A0 ${recoveryError}` }];
              }
              setFailedMessageId(lastAssistant?.id ?? null);
              lastFailedPayload.current = { message: fullMessage, widgetResponse };
            }
            setMessages(loaded);
            if (data.conversationId) setConversationId(data.conversationId);
            clearCompositionCache();
            if (reloadVisuals) reloadVisuals(projectId);
            decrementStreaming();
            return;
          }
        } catch { /* recovery failed */ }

        const errorText = isTimeout
          ? 'Connection timed out. Your progress has been saved — try sending another message.'
          : sanitizeErrorMessage(err instanceof Error ? err.message : 'Connection failed');
        setLastError(errorText);
        setCurrentProgress(null);
        activityState.reset();
        setMessages((prev) => prev.map((m) => {
          if (m.id !== assistantId) return m;
          return { ...m, content: [...m.content, { type: 'text' as const, text: `\u26A0 ${errorText}` }] };
        }));
        setFailedMessageId(assistantId);
        lastFailedPayload.current = { message: fullMessage, widgetResponse };
        decrementStreaming();
      }
    },
    [projectId, aiContext, handleSSEEvent, reloadVisuals, selectedTimeRange, setSelectedTimeRange]
  );

  // -----------------------------------------------------------------------
  // Boot sandbox & retry
  // -----------------------------------------------------------------------

  const bootAndRetry = useCallback(async (message: string, widgetResponse?: { widgetId: string; value: unknown }) => {
    try {
      await api.createSandbox(projectId);
      let ready = false;
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const status = await api.getSandboxStatus(projectId);
        if (status.status === 'ready') { ready = true; break; }
      }
      if (!ready) throw new Error('Sandbox failed to start within 2 minutes');
      sandboxBootAttempted.current = false;
      await _executeMessage({ messageText: message, fullMessage: message, widgetResponse });
    } catch {
      sandboxBootAttempted.current = false;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => i === prev.length - 1
            ? { ...m, content: [{ type: 'text' as const, text: 'Failed to start sandbox. Please try again.' }] }
            : m);
        }
        return prev;
      });
      decrementStreaming();
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
      setFailedMessageId(null);
      lastFailedPayload.current = null;

      const currentTags = sceneTags;
      const currentTimeRange = selectedTimeRange;
      let fullMessage = messageText;
      if (currentTags.length > 0 && !widgetResponse && !options?.hidden) {
        const tagMeta = currentTags.map((t) => `Scene ${t.sceneIndex}: "${t.sceneTitle}"`).join(', ');
        const planJobId = currentTags[0].planJobId;
        fullMessage = `[Edit scenes: ${tagMeta} | planJobId: ${planJobId}]\n${messageText}`;
      }

      // Add user message to UI — messages are always sent immediately (no queueing)
      if (messageText.trim() && !widgetResponse && !options?.hidden) {
        const userMsg: Message = {
          id: generateId(), role: 'user',
          content: [{ type: 'text', text: messageText }],
          createdAt: new Date().toISOString(),
        };
        if (currentTags.length > 0) {
          const tagLabels = currentTags.map((t) => `Scene ${t.sceneIndex}`).join(', ');
          userMsg.content = [{ type: 'text', text: `**Editing ${tagLabels}:** ${messageText}` }];
        } else if (currentTimeRange) {
          const rangeLabel = `${formatTimeChip(currentTimeRange.startMs)} \u2013 ${formatTimeChip(currentTimeRange.endMs)}`;
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
        const pending = getPendingWidgetResponses(projectId);
        pending.push({ widgetId, value });
        setPendingWidgetResponses(projectId, pending);
        return;
      }
      setMessages((prev) => prev.map((m) => ({
        ...m,
        content: m.content.map((block) => {
          if (block.type === 'widget' && block.widget.id === widgetId) return { ...block, response: value };
          return block;
        }),
      })));
      sendMessage('', { widgetId, value });
    },
    [sendMessage, isStreaming, projectId]
  );

  // Flush pending widget responses (survives page refresh via sessionStorage)
  useEffect(() => {
    if (!isStreaming) {
      const pending = getPendingWidgetResponses(projectId);
      if (pending.length > 0) {
        const next = pending.shift()!;
        setPendingWidgetResponses(projectId, pending);
        handleWidgetResponse(next.widgetId, next.value);
      }
    }
  }, [isStreaming, handleWidgetResponse, projectId]);

  // Auto-send pending AI message (from "Change & AI Adapt" context menu)
  useEffect(() => {
    if (pendingAIMessage && !isStreaming && historyLoaded) {
      setPendingAIMessage(null);
      sendMessage(pendingAIMessage);
    }
  }, [pendingAIMessage, isStreaming, historyLoaded, sendMessage, setPendingAIMessage]);

  // -----------------------------------------------------------------------
  // Retry, cancel, reset
  // -----------------------------------------------------------------------

  const handleRetry = useCallback(() => {
    if (!lastFailedPayload.current || isStreaming) return;
    if (failedMessageId) setMessages((prev) => prev.filter((m) => m.id !== failedMessageId));
    const { message, widgetResponse } = lastFailedPayload.current;
    setFailedMessageId(null);
    lastFailedPayload.current = null;
    sendMessage(message, widgetResponse);
  }, [failedMessageId, isStreaming, sendMessage]);

  const handleCancel = useCallback(async () => {
    abortRef.current?.abort();
    stopRecoveryPolling();
    try { await api.cancelAgent(projectId); } catch { /* best-effort */ }
    decrementStreaming();
    setActiveJobId(null);
    setCurrentProgress(null);
    activeTasksState.onDone();
    activityState.reset();
    setLastError(null);
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
  }, [projectId, activityState, activeTasksState, stopRecoveryPolling]);

  const handleReset = async () => {
    if (isResetting) return;
    setIsResetting(true);
    abortRef.current?.abort();
    stopRecoveryPolling();

    // Full reset: cancels agent, destroys sandbox, clears DB + Redis
    let brief: string | null = null;
    try {
      const result = await api.resetProject(projectId);
      brief = result.brief;
    } catch (err) {
      console.error('Failed to reset project:', err);
    }

    // Clear all local UI state
    decrementStreaming();
    setActiveJobId(null);
    sessionStorage.removeItem(`viona:activeJobId:${projectId}`);
    setPendingWidgetResponses(projectId, []);
    setMessages([]);
    setConversationId(null);
    setSceneTags([]);
    streamingCountRef.current = 0;
    setCurrentProgress(null);
    activeTasksState.onDone();
    activityState.reset();
    setLastError(null);
    setAttachmentFiles([]);
    clearCompositionCache();

    // Boot fresh sandbox and reload project (manifest, preview, tracks)
    // loadProject handles createSandbox + polling + manifest read internally
    try {
      await loadProject(projectId);
    } catch (err) {
      console.error('Failed to reload project after reset:', err);
    }

    // Now that sandbox is ready and preview is clean, trigger auto-greet with the brief
    if (brief) {
      sessionStorage.setItem(`project-brief-${projectId}`, brief);
    }
    autoGreetSent.current = false;
    setIsResetting(false);
  };

  const handleClearContext = () => {
    setSelectedScene(null);
    setSelectedElement(null);
    clearSelection();
  };

  // -----------------------------------------------------------------------
  // Scene edit / scenes update callbacks (from WidgetRenderer → ScenePlanCard)
  // -----------------------------------------------------------------------

  const handleEditScene = useCallback((sceneIndex: number, sceneTitle: string, planJobId: string) => {
    // sceneIndex from ScenePlanCard is 0-based, SceneTag is 1-indexed
    const tag: SceneTag = { sceneIndex: sceneIndex + 1, sceneTitle, planJobId };
    setSceneTags((prev) => {
      if (prev.some((t) => t.sceneIndex === tag.sceneIndex && t.planJobId === tag.planJobId)) return prev;
      return [...prev, tag];
    });
    chatInputRef.current?.focus();
  }, []);

  const handleScenesUpdate = useCallback(async (planJobId: string, updatedScenes: unknown[]) => {
    try {
      const result = await api.updatePlanScenes(
        projectId, planJobId,
        (updatedScenes as any[]).map((s, i) => ({ id: i + 1, title: s.title, description: s.description })),
      );
      if (result.success && result.scenes) {
        setMessages((prev) => prev.map((m) => ({
          ...m,
          content: m.content.map((block) => {
            if (block.type === 'widget' && (block as WidgetBlock).widget.planJobId === planJobId) {
              return { ...block, widget: { ...(block as WidgetBlock).widget, scenes: result.scenes } };
            }
            return block;
          }),
        })));
      }
    } catch (err) {
      console.error('Failed to update plan scenes:', err);
    }
  }, [projectId]);

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
        const uploadedCount = labels.length;
        setAttachmentFiles(prev => prev.slice(uploadedCount));
        setAttachmentUploading(false);
        const msg = uploadedCount > 0
          ? `Uploaded ${uploadedCount} file(s) but failed on the rest. Please retry.`
          : 'Failed to upload attachment. Please try again.';
        setMessages(prev => [...prev, {
          id: generateId(), role: 'assistant' as const,
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
  // Auto-greet
  // -----------------------------------------------------------------------

  const autoGreetSent = useRef(false);
  useEffect(() => {
    if (historyLoaded && messages.length === 0 && !isStreaming && !autoGreetSent.current) {
      autoGreetSent.current = true;
      const brief = sessionStorage.getItem(`project-brief-${projectId}`);
      if (brief) {
        sessionStorage.removeItem(`project-brief-${projectId}`);
        sendMessage(brief, undefined, { hidden: false }).catch(() => { autoGreetSent.current = false; });
      } else {
        sendMessage('[Start the conversation. Greet the user and offer to help.]', undefined, { hidden: true })
          .catch(() => { autoGreetSent.current = false; });
      }
    }
  }, [historyLoaded, messages.length, isStreaming, sendMessage, projectId]);

  // -----------------------------------------------------------------------
  // Computed props for ChatInput
  // -----------------------------------------------------------------------

  const canSend = input.trim().length > 0 || attachmentFiles.length > 0;

  const sandboxReady = sandboxStatus === 'ready';

  const inputPlaceholder = !sandboxReady
    ? 'Waiting for sandbox to start...'
    : isStreaming
    ? 'Type to queue another message...'
    : sceneTags.length > 0
      ? `Describe changes to ${sceneTags.map((t) => `Scene ${t.sceneIndex}`).join(', ')}...`
      : selectedTimeRange
        ? `Describe changes for ${formatTimeChip(selectedTimeRange.startMs)} – ${formatTimeChip(selectedTimeRange.endMs)}...`
        : aiContext
          ? `Describe changes to ${aiContext.displayName}...`
          : 'Ask anything...';

  const contextChips: ContextChip[] = [
    ...sceneTags.map((tag): ContextChip => ({
      id: `scene-${tag.planJobId}-${tag.sceneIndex}`,
      label: `Scene ${tag.sceneIndex}: ${tag.sceneTitle}`,
      onRemove: () => setSceneTags((prev) => prev.filter((t) => t.sceneIndex !== tag.sceneIndex || t.planJobId !== tag.planJobId)),
    })),
    ...(selectedTimeRange && sceneTags.length === 0
      ? [{
          id: 'time-range',
          label: `${formatTimeChip(selectedTimeRange.startMs)} – ${formatTimeChip(selectedTimeRange.endMs)}`,
          colorClass: 'bg-[var(--editor-info-soft)] text-[var(--editor-info)] border border-[var(--editor-info)]/25',
          onRemove: () => setSelectedTimeRange(null),
        } as ContextChip]
      : []),
  ];

  const inputAttachmentChips: AttachmentChip[] = attachmentFiles.map((att, idx) => ({
    id: `${att.file.name}-${att.file.lastModified}`,
    label: att.label,
    onLabelChange: (label: string) => setAttachmentFiles(prev => prev.map((a, i) => i === idx ? { ...a, label } : a)),
    onRemove: () => setAttachmentFiles(prev => prev.filter((_, i) => i !== idx)),
  }));

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className={`flex flex-col h-full bg-[var(--editor-bg-surface)] border-r border-[var(--editor-border-subtle)] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--editor-border-subtle)]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-normal text-[var(--editor-text-primary)]">Chat</span>
        </div>
        <div className="flex items-center gap-1">
          {aiContext && (
            <span
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-normal rounded-full ${
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

      {/* Messages area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {!historyLoaded ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-[var(--editor-accent)] animate-spin" />
            <p className="text-xs text-[var(--editor-text-muted)] mt-2">Loading conversation...</p>
          </div>
        ) : messages.length === 0 && !isStreaming ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-full bg-[var(--editor-accent-soft)] flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-[var(--editor-accent)] opacity-60" />
            </div>
            {aiContext ? (
              <>
                <p className="text-sm text-[var(--editor-text-secondary)] mb-1">Editing: {aiContext.displayName}</p>
                {aiContext.displayDescription && (
                  <p className="text-xs text-[var(--editor-text-muted)] mb-2 max-w-[200px] truncate">{aiContext.displayDescription}</p>
                )}
                <p className="text-xs text-[var(--editor-text-muted)]">Describe your changes below</p>
              </>
            ) : (
              <>
                <p className="text-sm text-[var(--editor-text-secondary)] mb-2">Your AI creative director</p>
                <p className="text-xs text-[var(--editor-text-muted)] mb-1">Describe what visuals you want to create</p>
                <p className="text-xs text-[var(--editor-text-muted)]">I&apos;ll guide you through themes, layouts, and scenes</p>
              </>
            )}
          </div>
        ) : (
          <ChatMessageList
            messages={messages}
            isStreaming={isStreaming}
            isTextActive={isStreaming && !showTypingDot}
            activeTasks={activeTasksState.tasks}
            busy={activeTasksState.busy}
            onWidgetResponse={handleWidgetResponse}
            onEditScene={handleEditScene}
            onScenesUpdate={handleScenesUpdate}
          />
        )}


        {/* Failed message retry */}
        {failedMessageId && !isStreaming && (
          <div className="flex items-center gap-2 px-3 py-1">
            <button
              onClick={handleRetry}
              className="flex items-center gap-1.5 text-xs text-[var(--editor-accent)] hover:text-[var(--editor-accent-hover)] transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Hidden file input for attachments */}
      <input
        ref={attachmentInputRef}
        type="file"
        accept="image/*,.svg"
        multiple
        className="hidden"
        onChange={handleAttachmentSelect}
      />

      {/* Toggleable plan panel above chat input */}
      {currentPlan && (
        <div className="mx-2 mb-2">
          <button
            onClick={() => setPlanExpanded(prev => !prev)}
            className="flex items-center justify-between w-full px-3 py-2 text-xs rounded-xl backdrop-blur-2xl border transition-all duration-200 hover:border-[var(--editor-accent)]/30"
            style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.06) 0%, rgba(139, 92, 246, 0.02) 100%)',
              borderColor: 'rgba(139, 92, 246, 0.12)',
            }}
          >
            <span className="flex items-center gap-2">
              <span
                className="flex items-center justify-center w-5 h-5 rounded-md"
                style={{ background: 'rgba(139, 92, 246, 0.12)' }}
              >
                <ListChecks className="w-3 h-3 text-[var(--editor-accent)]" />
              </span>
              <span className="text-[var(--editor-text-primary)] font-medium truncate max-w-[180px]">{currentPlan.title}</span>
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                style={{
                  background: 'rgba(139, 92, 246, 0.1)',
                  color: 'var(--editor-accent)',
                }}
              >
                {currentPlan.tasks.filter(t => t.status === 'complete').length}/{currentPlan.tasks.length}
              </span>
            </span>
            <ChevronDown
              className="w-3.5 h-3.5 text-[var(--editor-accent)] transition-transform duration-200"
              style={{ transform: planExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>
          {planExpanded && (
            <div
              className="mt-1 max-h-[300px] overflow-y-auto rounded-xl backdrop-blur-2xl border p-2"
              style={{
                background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.04) 0%, rgba(139, 92, 246, 0.01) 100%)',
                borderColor: 'rgba(139, 92, 246, 0.08)',
              }}
            >
              <AgentPlanView plan={currentPlan} className="!bg-transparent !border-0 !backdrop-blur-none" />
            </div>
          )}
        </div>
      )}

      {/* Input area */}
      <ChatInput
        ref={chatInputRef}
        value={input}
        onChange={setInput}
        onSend={handleSendWithAttachment}
        onStop={handleCancel}
        onAttach={() => attachmentInputRef.current?.click()}
        isStreaming={isStreaming}
        placeholder={inputPlaceholder}
        contextChips={contextChips}
        attachmentChips={inputAttachmentChips}
        attachmentUploading={attachmentUploading}
        canSend={canSend}
        disabled={!sandboxReady}
      />
    </div>
  );
}
