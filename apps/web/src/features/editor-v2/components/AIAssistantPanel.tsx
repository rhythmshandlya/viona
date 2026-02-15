/**
 * AI Assistant Panel
 * Streaming chat interface with inline widget support.
 * Connects to the agent router via SSE for real-time responses.
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Send, Trash2, Loader2, Target, Box, Layers } from 'lucide-react';
import { api } from '@/lib/api';
import { parseSSEStream } from '@/lib/sse-parser';
import { clearVisualCache } from '../player/DynamicVisualLoader';
import { useVideoSettings, useEditorActions, useAIEditingContext } from '../store/use-editor-store';
import { ThemePicker, LayoutPicker, ScenePlanCard, ConfirmationWidget } from './agent-widgets';

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
    scenes?: Array<{ startMs: number; endMs: number; title: string; description: string }>;
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AIAssistantPanel({ projectId, onEditComplete, className = '' }: AIAssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Store hooks
  const videoSettings = useVideoSettings();
  const aiContext = useAIEditingContext();
  const { reloadVisuals, setSelectedScene, setSelectedElement, clearSelection } = useEditorActions();

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
          const loaded: Message[] = data.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: normalizeContent(m.content),
            createdAt: m.createdAt,
          }));
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

  function normalizeContent(raw: unknown): MessageBlock[] {
    // If it's already an array of blocks, use it
    if (Array.isArray(raw)) {
      return raw as MessageBlock[];
    }
    // If it's a string, wrap in a text block
    if (typeof raw === 'string') {
      return [{ type: 'text', text: raw }];
    }
    // Fallback
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
              const progressData = data as { percent: number; message: string; error?: boolean };
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
    async (messageText: string, widgetResponse?: { widgetId: string; value: unknown }) => {
      if (isStreaming) return;

      // Add user message to UI (only if there is visible text, skip for widget-only responses)
      if (messageText.trim() && !widgetResponse) {
        const userMsg: Message = {
          id: generateId(),
          role: 'user',
          content: [{ type: 'text', text: messageText }],
          createdAt: new Date().toISOString(),
        };
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

      try {
        // Build context from editor state
        const context: {
          selectedTimeRange?: { startMs: number; endMs: number };
          selectedSceneId?: number;
          selectedElement?: { name: string; sceneId: number };
        } = {};

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
        }

        const stream = await api.chatWithAgent(projectId, {
          message: messageText,
          context: Object.keys(context).length > 0 ? context : undefined,
          widgetResponse,
        });

        for await (const event of parseSSEStream(stream)) {
          handleSSEEvent(event, assistantId);
        }

        // If stream ends without a 'done' event, stop streaming
        setIsStreaming(false);
      } catch (err) {
        console.error('Chat error:', err);
        const errorText = err instanceof Error ? err.message : 'Connection failed';
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m;
            return {
              ...m,
              content: [...m.content, { type: 'text' as const, text: `\n\nError: ${errorText}` }],
            };
          })
        );
        setIsStreaming(false);
      }
    },
    [isStreaming, projectId, aiContext, handleSSEEvent]
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
  // Clear conversation
  // -----------------------------------------------------------------------

  const handleClear = async () => {
    try {
      await api.clearConversation(projectId);
    } catch (err) {
      console.error('Failed to clear conversation:', err);
    }
    setMessages([]);
    setConversationId(null);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isStreaming) {
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
      case 'theme-picker':
        return (
          <ThemePicker
            onSelect={(themeId) => handleWidgetResponse(widget.id, themeId)}
            disabled={hasResponded || isStreaming}
            selectedValue={typeof response === 'string' ? response : undefined}
          />
        );

      case 'layout-picker':
        return (
          <LayoutPicker
            onSelect={(layoutId) => handleWidgetResponse(widget.id, layoutId)}
            disabled={hasResponded || isStreaming}
            selectedValue={typeof response === 'string' ? response : undefined}
          />
        );

      case 'scene-plan':
        return (
          <ScenePlanCard
            scenes={widget.scenes || []}
            onApprove={() => handleWidgetResponse(widget.id, { approved: true })}
            onReject={() => handleWidgetResponse(widget.id, { approved: false })}
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
          <div className="my-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/50">
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
          <div key={index} className="whitespace-pre-wrap break-words">
            {block.text}
          </div>
        );

      case 'widget':
        return <div key={index}>{renderWidget(block)}</div>;

      case 'progress':
        return (
          <div key={index} className="my-2">
            <div className="flex items-center gap-2 mb-1">
              {!block.error && block.percent < 100 && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
              )}
              <span className={`text-xs ${block.error ? 'text-red-400' : 'text-white/60'}`}>
                {block.message}
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5">
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
    <div className={`flex flex-col h-full bg-[#0a0a0f] border-l border-white/10 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <span className="text-sm font-semibold text-white">Creative Director</span>
        </div>
        <div className="flex items-center gap-1">
          {aiContext && (
            <span
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${
                aiContext.type === 'element'
                  ? 'bg-purple-500/10 text-purple-400'
                  : aiContext.type === 'item'
                    ? 'bg-blue-500/10 text-blue-400'
                    : 'bg-purple-500/10 text-purple-400'
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
              className="px-2 py-1 text-[10px] text-white/40 hover:text-white hover:bg-white/5 rounded transition-colors"
            >
              Clear
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              disabled={isStreaming}
              className="p-1.5 rounded-md hover:bg-white/5 transition-colors disabled:opacity-50"
              aria-label="Clear conversation"
              title="Clear conversation"
            >
              <Trash2 className="w-4 h-4 text-white/40 hover:text-white/70" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-purple-400 opacity-60" />
            </div>
            {aiContext ? (
              <>
                <p className="text-sm text-white/60 mb-1">
                  Editing: {aiContext.displayName}
                </p>
                {aiContext.displayDescription && (
                  <p className="text-xs text-white/40 mb-2 max-w-[200px] truncate">
                    {aiContext.displayDescription}
                  </p>
                )}
                <p className="text-xs text-white/40">
                  Describe your changes below
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-white/60 mb-2">
                  Your AI creative director
                </p>
                <p className="text-xs text-white/40 mb-1">
                  Describe what visuals you want to create
                </p>
                <p className="text-xs text-white/40">
                  I'll guide you through themes, layouts, and scenes
                </p>
              </>
            )}
          </div>
        ) : (
          /* Messages */
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[90%] text-sm ${
                  message.role === 'user'
                    ? 'bg-purple-600/30 border border-purple-500/20 text-white rounded-2xl rounded-br-md px-4 py-2.5'
                    : 'bg-white/5 text-white/90 rounded-2xl rounded-bl-md px-4 py-2.5'
                }`}
              >
                {message.content.length === 0 && isStreaming && (
                  <div className="flex gap-1 py-1">
                    <span
                      className="w-2 h-2 bg-white/30 rounded-full animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <span
                      className="w-2 h-2 bg-white/30 rounded-full animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="w-2 h-2 bg-white/30 rounded-full animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                )}
                {message.content.map((block, i) => renderBlock(block, i))}
              </div>
            </div>
          ))
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/10">
        <div className="relative flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isStreaming
                ? 'Waiting for response...'
                : aiContext
                  ? `Describe changes to ${aiContext.displayName}...`
                  : 'Describe what you want to create...'
            }
            disabled={isStreaming}
            rows={1}
            className="flex-1 bg-white/5 text-white text-sm
                       placeholder:text-white/30
                       rounded-xl px-4 py-3 pr-12
                       border border-white/10
                       focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all resize-none"
          />
          <button
            onClick={() => input.trim() && !isStreaming && sendMessage(input.trim())}
            disabled={!input.trim() || isStreaming}
            className="absolute right-2 bottom-2 w-8 h-8 flex items-center justify-center
                       rounded-full bg-purple-600 text-white
                       hover:bg-purple-500 transition-colors
                       disabled:bg-white/10 disabled:text-white/30"
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
