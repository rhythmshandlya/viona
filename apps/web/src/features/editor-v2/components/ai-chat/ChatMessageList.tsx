'use client';

import React, { memo } from 'react';
import type { Message, TextBlock, WidgetBlock, PlanBlock, ActiveTask } from './types';
import { ChatBubble } from './ChatBubble';
import { WidgetRenderer } from './WidgetRenderer';
import { AgentPlanWidget } from './AgentPlanWidget';
import { ActiveTaskList } from './ActiveTaskList';

interface ChatMessageListProps {
  messages: Message[];
  isStreaming: boolean;
  /** True only while text events are actively arriving (goes false ~500ms after last text). */
  isTextActive: boolean;
  activeTasks: ActiveTask[];
  busy: boolean;
  onWidgetResponse: (widgetId: string, value: unknown) => void;
  onEditScene?: (sceneIndex: number, sceneTitle: string, planJobId: string) => void;
  onScenesUpdate?: (planJobId: string, scenes: unknown[]) => void | Promise<void>;
}

/** Group adjacent text blocks into a single string for one bubble. */
function renderMessageBlocks(
  msg: Message,
  isLastMessage: boolean,
  isStreaming: boolean,
  isTextActive: boolean,
  onWidgetResponse: (widgetId: string, value: unknown) => void,
  onEditScene?: (sceneIndex: number, sceneTitle: string, planJobId: string) => void,
  onScenesUpdate?: (planJobId: string, scenes: unknown[]) => void | Promise<void>,
) {
  const elements: React.ReactNode[] = [];
  let textAccum = '';

  const flushText = (isFinal: boolean) => {
    if (textAccum.trim()) {
      elements.push(
        <ChatBubble
          key={`text-${elements.length}`}
          role={msg.role}
          text={textAccum}
          isStreaming={isFinal && isLastMessage && isTextActive && msg.role === 'assistant'}
        />,
      );
    }
    textAccum = '';
  };

  for (const block of msg.content) {
    if (block.type === 'text' && !(block as TextBlock).hidden) {
      textAccum += (textAccum ? '\n' : '') + (block as TextBlock).text;
    } else if (block.type === 'widget') {
      flushText(false);
      elements.push(
        <WidgetRenderer
          key={`widget-${(block as WidgetBlock).widget.id}`}
          block={block as WidgetBlock}
          onWidgetResponse={onWidgetResponse}
          onEditScene={onEditScene}
          onScenesUpdate={onScenesUpdate}
          disabled={isStreaming}
        />,
      );
    } else if (block.type === 'plan') {
      flushText(false);
      elements.push(
        <AgentPlanWidget
          key={`plan-${elements.length}`}
          plan={(block as PlanBlock).plan}
        />,
      );
    }
    // 'progress' blocks (deprecated) are silently skipped
  }

  flushText(true);
  return elements;
}

/**
 * Renders the message list and inline active task list.
 * Does NOT own scrolling — the parent container handles scroll tracking.
 */
export const ChatMessageList = memo(function ChatMessageList({
  messages,
  isStreaming,
  isTextActive,
  activeTasks,
  busy,
  onWidgetResponse,
  onEditScene,
  onScenesUpdate,
}: ChatMessageListProps) {
  return (
    <>
      {messages
        .filter((m) => m.content.length > 0 || m.role === 'assistant')
        .map((msg, i, filtered) => (
          <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : ''}>
            <div className={msg.role === 'user' ? 'max-w-[85%]' : 'w-full space-y-2'}>
              {/* Empty assistant placeholder — streaming dots (hidden when tasks are showing) */}
              {msg.role === 'assistant' && msg.content.length === 0 && i === filtered.length - 1 && isStreaming && !busy && (
                <div className="w-fit bg-[var(--chat-bubble-assistant-bg)] border border-[var(--chat-bubble-assistant-border)] rounded-2xl rounded-bl-md px-3 py-2 backdrop-blur-xl">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-[var(--editor-accent)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-[var(--editor-accent)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-[var(--editor-accent)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              {renderMessageBlocks(
                msg,
                i === filtered.length - 1,
                isStreaming,
                isTextActive,
                onWidgetResponse,
                onEditScene,
                onScenesUpdate,
              )}
            </div>
          </div>
        ))}

      {/* Active task list — replaces the old ProgressIndicator */}
      <ActiveTaskList tasks={activeTasks} busy={busy} isVisible={isStreaming} />
    </>
  );
});
