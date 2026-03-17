'use client';

import React, { memo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContextChip {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onRemove: () => void;
}

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isStreaming: boolean;
  placeholder?: string;
  contextChips?: ContextChip[];
  disabled?: boolean;
}

export const ChatInput = memo(function ChatInput({
  value,
  onChange,
  onSend,
  isStreaming,
  placeholder = 'Ask Viona anything...',
  contextChips = [],
  disabled,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (value.trim() && !isStreaming && !disabled) {
          onSend();
        }
      }
    },
    [value, isStreaming, disabled, onSend],
  );

  const canSend = value.trim().length > 0 && !isStreaming && !disabled;

  return (
    <div className="rounded-xl bg-[var(--chat-input-bg)] border border-[var(--chat-input-border)] backdrop-blur-xl p-2">
      {/* Context chips */}
      <AnimatePresence>
        {contextChips.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-1.5 mb-2 px-1"
          >
            {contextChips.map((chip) => (
              <motion.span
                key={chip.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[var(--chat-chip-bg)] text-white/60 border border-white/[0.06]"
              >
                {chip.icon}
                {chip.label}
                <button
                  onClick={chip.onRemove}
                  className="ml-0.5 hover:text-white/80 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isStreaming}
        rows={1}
        className={cn(
          'w-full bg-transparent text-sm text-white/90 placeholder:text-white/25 resize-none outline-none px-1',
          'min-h-[36px] max-h-[160px]',
        )}
      />

      {/* Bottom row */}
      <div className="flex items-center justify-between mt-1.5 px-0.5">
        <div className="flex items-center gap-1">
          {/* Action icons slot — can be extended */}
        </div>

        {/* Send button */}
        <motion.button
          whileHover={canSend ? { scale: 1.05 } : undefined}
          whileTap={canSend ? { scale: 0.95 } : undefined}
          onClick={canSend ? onSend : undefined}
          disabled={!canSend}
          className={cn(
            'flex items-center justify-center h-7 w-7 rounded-full transition-all',
            canSend
              ? 'bg-[var(--editor-accent)]/80 hover:bg-[var(--editor-accent)] text-white shadow-sm shadow-[var(--editor-accent)]/20'
              : 'bg-white/[0.06] text-white/20 cursor-not-allowed',
          )}
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </motion.button>
      </div>
    </div>
  );
});
