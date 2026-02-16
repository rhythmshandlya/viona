/**
 * AI Assistant Panel
 * Streaming chat interface with inline widget support.
 * Connects to the agent router via SSE for real-time responses.
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles, Send, Loader2, Target, Box, Layers, X, RotateCcw, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { parseSSEStream, SSETimeoutError } from '@/lib/sse-parser';
import { clearVisualCache } from '../player/DynamicVisualLoader';
import { useVideoSettings, useEditorActions, useAIEditingContext, useAIEditRequested, useSelectedTimeRange, useEditorStore } from '../store/use-editor-store';
import { useJobWebSocket } from '../hooks/use-job-websocket';
import { ThemePicker, LayoutPicker, ScenePlanCard, ConfirmationWidget, ChoiceWidget } from './agent-widgets';

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

interface ProgressBlock {
  type: 'progress';
  percent: number;
  message: string;
  error?: boolean;
}

type MessageBlock = TextBlock | WidgetBlock | ProgressBlock;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: MessageBlock[];
  createdAt: string;
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SceneTag {
  sceneIndex: number; // 1-indexed
  sceneTitle: string;
  planJobId: string;
}

export function AIAssistantPanel({ projectId, onEditComplete, className = '' }: AIAssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [sceneTags, setSceneTags] = useState<SceneTag[]>([]);

  const [failedMessageId, setFailedMessageId] = useState<string | null>(null);
  const lastFailedPayload = useRef<{ message: string; widgetResponse?: { widgetId: string; value: unknown } } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Track active generation job for WebSocket progress
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Store hooks
  const videoSettings = useVideoSettings();
  const aiContext = useAIEditingContext();
  const selectedTimeRange = useSelectedTimeRange();
  const aiEditRequested = useAIEditRequested();
  const { reloadVisuals, setSelectedScene, setSelectedElement, setSelectedTimeRange, clearSelection } = useEditorActions();

  // WebSocket for real-time job progress (survives page refresh, unlike SSE)
  const { subscribeToJob } = useJobWebSocket(projectId, {
    onProgress: (data) => {
      if (!activeJobId) return; // Only show if we're tracking a job
      if (data.jobId !== activeJobId) return;
      setMessages((prev) => {
        const last = [...prev].reverse().find((m) => m.role === 'assistant');
        if (!last) return prev;
        return prev.map((m) => {
          if (m.id !== last.id) return m;
          const blocks = [...m.content];
          const progIdx = blocks.findIndex((b) => b.type === 'progress');
          const progressBlock: ProgressBlock = {
            type: 'progress',
            percent: data.progress,
            message: data.message || `Processing... (${data.progress}%)`,
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
      // Add completion message
      const doneMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: [{ type: 'text', text: 'Your visuals are ready! Take a look and let me know if you\'d like any changes.' }],
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => {
        // Remove progress block from the last assistant message
        const updated = prev.map((m) => {
          if (m.role === 'assistant') {
            return { ...m, content: m.content.filter((b) => b.type !== 'progress') };
          }
          return m;
        });
        return [...updated, doneMsg];
      });
      clearVisualCache();
      if (reloadVisuals) reloadVisuals(projectId);
    },
    onError: (data) => {
      if (data.jobId !== activeJobId) return;
      setActiveJobId(null);
      setMessages((prev) => {
        const last = [...prev].reverse().find((m) => m.role === 'assistant');
        if (!last) return prev;
        return prev.map((m) => {
          if (m.id !== last.id) return m;
          const blocks = m.content.filter((b) => b.type !== 'progress');
          blocks.push({ type: 'text', text: `\n\nGeneration failed: ${data.error}` });
          return { ...m, content: blocks };
        });
      });
    },
  });

  // Subscribe to job updates when we have an active job
  useEffect(() => {
    if (activeJobId) {
      subscribeToJob(activeJobId);
    }
  }, [activeJobId, subscribeToJob]);

  // Abort in-flight requests on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
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
            setActiveJobId(data.activeJob.id);
            const progressBlock: ProgressBlock = {
              type: 'progress',
              percent: data.activeJob.progress ?? 0,
              message: data.activeJob.message || 'Processing...',
            };
            const lastAssistant = [...loaded].reverse().find((m) => m.role === 'assistant');
            if (lastAssistant) {
              lastAssistant.content = [...lastAssistant.content, progressBlock];
            }
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

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantMessageId) return m;

          const blocks = [...m.content];

          switch (eventType) {
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
              const progressData = data as { percent: number; message: string; error?: boolean; jobId?: string };
              // On failure, stop tracking the job so the spinner stops
              if (progressData.error) {
                setActiveJobId(null);
              } else if (progressData.jobId) {
                // Track the job ID so WebSocket can pick up progress if SSE drops
                setActiveJobId(progressData.jobId);
              }
              // Update existing progress block or add new one
              const progressIdx = blocks.findIndex((b) => b.type === 'progress');
              const progressBlock: ProgressBlock = {
                type: 'progress',
                percent: progressData.percent,
                message: progressData.message,
                error: progressData.error,
              };
              if (progressIdx >= 0) {
                blocks[progressIdx] = progressBlock;
              } else {
                blocks.push(progressBlock);
              }
              break;
            }

            case 'error': {
              const errorData = data as { message?: string; error?: string };
              const errorText = errorData.message || errorData.error || 'Something went wrong';
              blocks.push({ type: 'text', text: `\n\nError: ${errorText}` });
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

        // Trigger visual reload on completion
        clearVisualCache();
        if (reloadVisuals) {
          reloadVisuals(projectId);
        }
        if (onEditComplete) {
          onEditComplete();
        }
      }

      if (eventType === 'error') {
        setIsStreaming(false);
      }
    },
    [projectId, reloadVisuals, onEditComplete]
  );

  // -----------------------------------------------------------------------
  // Send message
  // -----------------------------------------------------------------------

  const sendMessage = useCallback(
    async (messageText: string, widgetResponse?: { widgetId: string; value: unknown }, options?: { hidden?: boolean }) => {
      if (isStreaming) return;

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

      // Add user message to UI (skip for widget responses and hidden/auto-init messages)
      if (messageText.trim() && !widgetResponse && !options?.hidden) {
        const userMsg: Message = {
          id: generateId(),
          role: 'user',
          content: [{ type: 'text', text: messageText }],
          createdAt: new Date().toISOString(),
        };
        // If there are scene tags, show them as a prefix in the displayed message
        if (currentTags.length > 0) {
          const tagLabels = currentTags.map((t) => `Scene ${t.sceneIndex}`).join(', ');
          userMsg.content = [{ type: 'text', text: `**Editing ${tagLabels}:** ${messageText}` }];
        } else if (currentTimeRange) {
          const rangeLabel = `${formatTimeChip(currentTimeRange.startMs)} – ${formatTimeChip(currentTimeRange.endMs)}`;
          userMsg.content = [{ type: 'text', text: `**Editing ${rangeLabel}:** ${messageText}` }];
        }
        setMessages((prev) => [...prev, userMsg]);
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
      setInput('');
      setSceneTags([]); // Clear tags after sending
      if (currentTimeRange) setSelectedTimeRange(null); // Clear time range after sending

      try {
        // Build context from editor state
        const context: {
          selectedTimeRange?: { startMs: number; endMs: number };
          selectedSceneId?: number;
          selectedElement?: { name: string; sceneId: number };
          selectedVisualItem?: { id: string; description: string };
        } = {};

        if (currentTimeRange) {
          context.selectedTimeRange = currentTimeRange;
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

        // Safety timeout — if streaming hangs for 5 minutes total, abort.
        // This catches cases where the SSE parser's inactivity timeout isn't
        // enough (e.g. heartbeats keep arriving but no real events).
        const safetyTimeout = setTimeout(() => {
          controller.abort();
        }, 5 * 60 * 1000);

        try {
          const stream = await api.chatWithAgent(projectId, {
            message: fullMessage,
            context: Object.keys(context).length > 0 ? context : undefined,
            widgetResponse,
          }, controller.signal);

          for await (const event of parseSSEStream(stream, { signal: controller.signal })) {
            handleSSEEvent(event, assistantId);
          }

          // If stream ends without a 'done' event, stop streaming
          setIsStreaming(false);
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
            setMessages(loaded);
            if (data.conversationId) setConversationId(data.conversationId);

            // If there's an active job, keep tracking it via WebSocket
            if (data.activeJob) {
              setActiveJobId(data.activeJob.id);
            }

            clearVisualCache();
            if (reloadVisuals) reloadVisuals(projectId);
            setIsStreaming(false);
            return;
          }
        } catch { /* recovery failed, show original error */ }

        const errorText = isTimeout
          ? 'Connection timed out. Your progress has been saved — try sending another message.'
          : (err instanceof Error ? err.message : 'Connection failed');
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m;
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
    [isStreaming, projectId, aiContext, handleSSEEvent, reloadVisuals, sceneTags, selectedTimeRange, setSelectedTimeRange]
  );

  // -----------------------------------------------------------------------
  // Widget response handler
  // -----------------------------------------------------------------------

  const handleWidgetResponse = useCallback(
    (widgetId: string, value: unknown) => {
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
    [sendMessage]
  );

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
  // Auto-greet: have the AI start the conversation when panel opens
  // -----------------------------------------------------------------------

  const autoGreetSent = useRef(false);
  useEffect(() => {
    if (historyLoaded && messages.length === 0 && !isStreaming && !autoGreetSent.current) {
      autoGreetSent.current = true;
      sendMessage('[Start the conversation. Greet the user and offer to help.]', undefined, { hidden: true })
        .catch(() => {
          // Allow retry if the greet fails (e.g. server temporarily down)
          autoGreetSent.current = false;
        });
    }
  }, [historyLoaded, messages.length, isStreaming, sendMessage]);

  // -----------------------------------------------------------------------
  // Reset (clear visuals + conversation, restart from scratch)
  // -----------------------------------------------------------------------

  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    if (isResetting || isStreaming) return;
    setIsResetting(true);
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
    // Re-trigger auto-greet
    autoGreetSent.current = false;
    clearVisualCache();
    if (reloadVisuals) reloadVisuals(projectId);
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
  // Key handler
  // -----------------------------------------------------------------------

  const canSend = !isStreaming && input.trim().length > 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) {
        sendMessage(input.trim());
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

      case 'layout_picker':
        return (
          <LayoutPicker
            onSelect={(layoutId) => handleWidgetResponse(widget.id, layoutId)}
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
            onApprove={() => handleWidgetResponse(widget.id, { approved: true, planJobId })}
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
        return (
          <div key={index} className="my-2">
            <div className="flex items-center gap-2 mb-1">
              {!block.error && block.percent < 100 && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />
              )}
              <span className={`text-xs ${block.error ? 'text-red-500' : 'text-[var(--editor-text-secondary)]'}`}>
                {block.message}
              </span>
            </div>
            <div className="w-full bg-[var(--editor-bg-hover)] rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  block.error ? 'bg-red-500' : 'bg-purple-500'
                }`}
                style={{ width: `${Math.min(block.percent, 100)}%` }}
              />
            </div>
          </div>
        );
    }
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className={`flex flex-col h-full bg-[var(--editor-bg-surface)] border-r border-[var(--editor-border-subtle)] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--editor-border-subtle)]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-purple-500" />
          </div>
          <span className="text-sm font-semibold text-[var(--editor-text-primary)]">Creative Director</span>
        </div>
        <div className="flex items-center gap-1">
          {aiContext && (
            <span
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${
                aiContext.type === 'element'
                  ? 'bg-purple-500/10 text-purple-600'
                  : aiContext.type === 'item'
                    ? 'bg-blue-500/10 text-blue-600'
                    : 'bg-purple-500/10 text-purple-600'
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
            disabled={isStreaming || isResetting}
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

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isStreaming ? (
          /* Empty state — only show if not already auto-greeting */
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-purple-500 opacity-60" />
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
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[90%] text-sm ${
                  message.role === 'user'
                    ? 'bg-purple-500/10 border border-purple-500/20 text-[var(--editor-text-primary)] rounded-2xl rounded-br-md px-4 py-2.5'
                    : 'bg-[var(--editor-bg-hover)] text-[var(--editor-text-primary)] rounded-2xl rounded-bl-md px-4 py-2.5'
                }`}
              >
                {message.content.length === 0 && isStreaming && (
                  <div className="flex gap-1 py-1">
                    <span
                      className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <span
                      className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                )}
                {message.content.map((block, i) => renderBlock(block, i))}
                {failedMessageId === message.id && (
                  <button
                    onClick={handleRetry}
                    disabled={isStreaming}
                    className="mt-2 flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retry
                  </button>
                )}
              </div>
            </div>
          ))
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-[var(--editor-border-subtle)]">
        {/* Scene tag chips */}
        {sceneTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {sceneTags.map((tag) => (
              <span
                key={`${tag.planJobId}-${tag.sceneIndex}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium
                           bg-purple-500/15 text-purple-400 border border-purple-500/25"
              >
                Scene {tag.sceneIndex}: {tag.sceneTitle}
                <button
                  onClick={() => setSceneTags((prev) => prev.filter((t) => t.sceneIndex !== tag.sceneIndex || t.planJobId !== tag.planJobId))}
                  className="ml-0.5 hover:text-purple-300 transition-colors"
                  aria-label={`Remove Scene ${tag.sceneIndex}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Time range chip */}
        {selectedTimeRange && sceneTags.length === 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium
                             bg-blue-500/15 text-blue-400 border border-blue-500/25">
              {formatTimeChip(selectedTimeRange.startMs)} – {formatTimeChip(selectedTimeRange.endMs)}
              <button
                onClick={() => setSelectedTimeRange(null)}
                className="ml-0.5 hover:text-blue-300 transition-colors"
                aria-label="Remove time range"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          </div>
        )}

        <div className="relative flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isStreaming
                ? 'Waiting for response...'
                : sceneTags.length > 0
                  ? `Describe changes to ${sceneTags.map((t) => `Scene ${t.sceneIndex}`).join(', ')}...`
                  : selectedTimeRange
                    ? `Describe changes for ${formatTimeChip(selectedTimeRange.startMs)} – ${formatTimeChip(selectedTimeRange.endMs)}...`
                    : aiContext
                      ? `Describe changes to ${aiContext.displayName}...`
                      : 'Describe what you want to create...'
            }
            disabled={isStreaming}
            rows={1}
            className="flex-1 bg-[var(--editor-bg-hover)] text-[var(--editor-text-primary)] text-sm
                       placeholder:text-[var(--editor-text-muted)]
                       rounded-xl px-4 py-3 pr-12
                       border border-[var(--editor-border-subtle)]
                       focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all resize-none"
          />
          <button
            onClick={() => canSend && sendMessage(input.trim())}
            disabled={!canSend}
            className="absolute right-2 bottom-2 w-8 h-8 flex items-center justify-center
                       rounded-full bg-purple-600 text-white
                       hover:bg-purple-500 transition-colors
                       disabled:bg-[var(--editor-bg-hover)] disabled:text-[var(--editor-text-muted)]"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
