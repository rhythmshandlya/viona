'use client';

import React, { memo } from 'react';
import type { Message, TextBlock, WidgetBlock, ActiveTask } from './types';
import { ChatBubble } from './ChatBubble';
import { WidgetRenderer } from './WidgetRenderer';
import { ActiveTaskList } from './ActiveTaskList';
import { IngestStatusList } from './IngestStatusList';

interface ChatMessageListProps {
  messages: Message[];
  isStreaming: boolean;
  /** True only while text events are actively arriving (goes false ~500ms after last text). */
  isTextActive: boolean;
  activeTasks: ActiveTask[];
  busy: boolean;
  /** Current project id — passed through to IngestStatusList so it can seed
   *  from the project asset list on mount (not just react to SSE events). */
  projectId?: string;
  onWidgetResponse: (widgetId: string, value: unknown) => void;
  onEditScene?: (sceneIndex: number, sceneTitle: string, planJobId: string) => void;
  onScenesUpdate?: (planJobId: string, scenes: unknown[]) => void | Promise<void>;
}

/** Render each content block — each TextBlock gets its own bubble. */
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
  const blocks = msg.content;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type === 'text' && !(block as TextBlock).hidden) {
      const text = (block as TextBlock).text;
      if (text.trim()) {
        const isLast = i === blocks.length - 1;
        elements.push(
          <ChatBubble
            key={`text-${elements.length}`}
            role={msg.role}
            text={text}
            isStreaming={isLast && isLastMessage && isTextActive && msg.role === 'assistant'}
          />,
        );
      }
    } else if (block.type === 'widget') {
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
    }
    // 'plan' blocks are rendered in the dedicated plan panel above the chat input.
    // 'progress' blocks (deprecated) are silently skipped.
  }

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
  projectId,
  onWidgetResponse,
  onEditScene,
  onScenesUpdate,
}: ChatMessageListProps) {
  return (
    <>
      {messages
        .filter((m) => m.content.length > 0 || m.role === 'assistant' || m.role === 'pipeline')
        .map((msg, i, filtered) => {
          if (msg.role === 'pipeline') {
            return (
              <div key={msg.id} className="w-full">
                <ChatBubble role="pipeline" content={msg.content} />
              </div>
            );
          }
          return (
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
          );
        })}

      {/* Active task list — replaces the old ProgressIndicator */}
      <ActiveTaskList tasks={activeTasks} busy={busy} isVisible={isStreaming} />

      {/* Ingest status — always visible (listens to /asset-events SSE). Shows
          upload + metadata + transcription progress per asset, using the same
          agent-badge visual language as ActiveTaskList. Seeds from the project
          asset list so rows appear even when the editor mounts mid-ingest. */}
      <IngestStatusList projectId={projectId} />
    </>
  );
});
