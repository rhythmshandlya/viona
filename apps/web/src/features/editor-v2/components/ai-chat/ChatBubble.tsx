'use client';

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { PipelineBubble, type PipelineEventBlock } from './PipelineBubble';

interface ChatBubbleProps {
  role: 'user' | 'assistant' | 'pipeline';
  text?: string;
  isStreaming?: boolean;
  /** When role === 'pipeline', the jsonb content array of pipeline_event blocks. */
  content?: unknown;
}

function extractPipelineEvents(content: unknown): PipelineEventBlock[] {
  if (!Array.isArray(content)) return [];
  return content.filter(
    (b): b is PipelineEventBlock =>
      !!b &&
      typeof b === 'object' &&
      (b as { type?: unknown }).type === 'pipeline_event' &&
      typeof (b as { eventType?: unknown }).eventType === 'string',
  );
}

export const ChatBubble = memo(function ChatBubble({ role, text, isStreaming, content }: ChatBubbleProps) {
  if (role === 'pipeline') {
    return <PipelineBubble content={extractPipelineEvents(content)} />;
  }

  const isUser = role === 'user';
  const safeText = text ?? '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] }}
      className={cn(
        'relative px-3.5 py-2.5 rounded-2xl backdrop-blur-xl text-sm',
        isUser
          ? 'ml-auto rounded-tr-md bg-[var(--chat-bubble-user-bg)] border border-[var(--chat-bubble-user-border)] text-white/95'
          : 'mr-2 rounded-tl-md bg-[var(--chat-bubble-assistant-bg)] border border-[var(--chat-bubble-assistant-border)] text-white/90',
      )}
    >
      {isUser ? (
        <p className="whitespace-pre-wrap break-words">{safeText}</p>
      ) : (
        <div className="prose-agent">
          <MarkdownRenderer>{safeText}</MarkdownRenderer>
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 ml-0.5 bg-white/40 rounded-sm animate-pulse align-middle" />
          )}
        </div>
      )}
    </motion.div>
  );
});
