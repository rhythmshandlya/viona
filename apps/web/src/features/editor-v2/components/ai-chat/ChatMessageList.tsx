'use client';

import React, { memo, useRef, useEffect } from 'react';
import type { Message, TextBlock, WidgetBlock, PlanBlock, ProgressState } from './types';
import { ChatBubble } from './ChatBubble';
import { WidgetRenderer } from './WidgetRenderer';
import { AgentPlanWidget } from './AgentPlanWidget';
import { ProgressIndicator } from './ProgressIndicator';

interface ChatMessageListProps {
  messages: Message[];
  isStreaming: boolean;
  currentProgress: ProgressState | null;
  onWidgetResponse: (widgetId: string, value: unknown) => void;
  onEditScene?: (sceneIndex: number, sceneTitle: string) => void;
  onScenesUpdate?: (planJobId: string, scenes: unknown[]) => void | Promise<void>;
}

/** Group adjacent text blocks into a single string for one bubble. */
function renderMessageBlocks(
  msg: Message,
  isLastMessage: boolean,
  isStreaming: boolean,
  onWidgetResponse: (widgetId: string, value: unknown) => void,
  onEditScene?: (sceneIndex: number, sceneTitle: string) => void,
  onScenesUpdate?: (planJobId: string, scenes: unknown[]) => void | Promise<void>,
) {
  const elements: React.ReactNode[] = [];
  let textAccum = '';

  const flushText = () => {
    if (textAccum.trim()) {
      elements.push(
        <ChatBubble
          key={`text-${elements.length}`}
          role={msg.role}
          text={textAccum}
          isStreaming={isLastMessage && isStreaming && msg.role === 'assistant'}
        />,
      );
    }
    textAccum = '';
  };

  for (const block of msg.content) {
    if (block.type === 'text' && !(block as TextBlock).hidden) {
      textAccum += (textAccum ? '\n' : '') + (block as TextBlock).text;
    } else if (block.type === 'widget') {
      flushText();
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
      flushText();
      elements.push(
        <AgentPlanWidget
          key={`plan-${elements.length}`}
          plan={(block as PlanBlock).plan}
        />,
      );
    }
    // 'progress' blocks (deprecated) are silently skipped
  }

  flushText();
  return elements;
}

export const ChatMessageList = memo(function ChatMessageList({
  messages,
  isStreaming,
  currentProgress,
  onWidgetResponse,
  onEditScene,
  onScenesUpdate,
}: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or streaming
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Only auto-scroll if user is near bottom (within 120px)
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming, currentProgress]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
      {messages.map((msg, i) => (
        <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : ''}>
          <div className={msg.role === 'user' ? 'max-w-[85%]' : 'w-full space-y-2'}>
            {renderMessageBlocks(
              msg,
              i === messages.length - 1,
              isStreaming,
              onWidgetResponse,
              onEditScene,
              onScenesUpdate,
            )}
          </div>
        </div>
      ))}

      {/* Inline progress indicator — shown after last message during streaming */}
      <ProgressIndicator
        progress={currentProgress}
        isVisible={isStreaming && currentProgress != null}
      />

      <div ref={bottomRef} />
    </div>
  );
});
