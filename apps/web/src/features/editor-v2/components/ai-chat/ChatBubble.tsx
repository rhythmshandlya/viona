'use client';

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  text: string;
  isStreaming?: boolean;
}

export const ChatBubble = memo(function ChatBubble({ role, text, isStreaming }: ChatBubbleProps) {
  const isUser = role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] }}
      className={cn(
        'relative px-3.5 py-2.5 rounded-2xl backdrop-blur-xl text-sm',
        isUser
          ? 'ml-auto max-w-[85%] rounded-tr-md bg-[var(--chat-bubble-user-bg)] border border-[var(--chat-bubble-user-border)] text-white/95'
          : 'mr-2 rounded-tl-md bg-[var(--chat-bubble-assistant-bg)] border border-[var(--chat-bubble-assistant-border)] text-white/90',
      )}
    >
      {isUser ? (
        <p className="whitespace-pre-wrap break-words">{text}</p>
      ) : (
        <div className="prose-agent">
          <MarkdownRenderer>{text}</MarkdownRenderer>
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 ml-0.5 bg-white/40 rounded-sm animate-pulse align-middle" />
          )}
        </div>
      )}
    </motion.div>
  );
});
