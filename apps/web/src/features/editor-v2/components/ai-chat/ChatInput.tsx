'use client';

import React, { memo, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, X, Square, Paperclip, Loader2, ListOrdered } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Auto-resize textarea hook
// ============================================

function useAutoResizeTextarea({
  minHeight,
  maxHeight,
}: {
  minHeight: number;
  maxHeight?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY)
      );
      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) textarea.style.height = `${minHeight}px`;
  }, [minHeight]);

  return { textareaRef, adjustHeight };
}

// ============================================
// Types
// ============================================

export interface ContextChip {
  id: string;
  label: string;
  icon?: React.ReactNode;
  colorClass?: string;
  onRemove: () => void;
}

export interface AttachmentChip {
  id: string;
  label: string;
  onLabelChange: (label: string) => void;
  onRemove: () => void;
}

export interface ChatInputHandle {
  focus: () => void;
}

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  onAttach?: () => void;
  isStreaming: boolean;
  placeholder?: string;
  contextChips?: ContextChip[];
  attachmentChips?: AttachmentChip[];
  attachmentUploading?: boolean;
  queueSize?: number;
  onClearQueue?: () => void;
  disabled?: boolean;
  canSend?: boolean;
}

// ============================================
// ChatInput
// ============================================

export const ChatInput = memo(forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  onAttach,
  isStreaming,
  placeholder = 'Ask anything...',
  contextChips = [],
  attachmentChips = [],
  attachmentUploading = false,
  queueSize = 0,
  onClearQueue,
  disabled,
  canSend: canSendProp,
}, ref) {
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 44,
    maxHeight: 200,
  });

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  // Adjust height when value changes externally (e.g. cleared after send)
  useEffect(() => {
    adjustHeight(value === '' ? true : undefined);
  }, [value, adjustHeight]);

  const canSend = canSendProp ?? value.trim().length > 0;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (canSend && !disabled) onSend();
      }
    },
    [canSend, disabled, onSend],
  );

  return (
    <div className="px-3 pb-3 pt-2 space-y-2">
      {/* Context chips */}
      <AnimatePresence>
        {contextChips.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-1.5"
          >
            {contextChips.map((chip) => (
              <motion.span
                key={chip.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-normal',
                  chip.colorClass || 'bg-[var(--editor-accent-soft)] text-[var(--editor-accent)] border border-[var(--editor-accent)]/25',
                )}
              >
                {chip.icon}
                {chip.label}
                <button
                  onClick={chip.onRemove}
                  className="ml-0.5 hover:opacity-70 transition-opacity"
                  aria-label={`Remove ${chip.label}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Queue indicator */}
      {queueSize > 0 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] text-[var(--editor-text-muted)] flex items-center gap-1">
            <ListOrdered className="w-3 h-3" />
            {queueSize} message{queueSize > 1 ? 's' : ''} queued
          </span>
          {onClearQueue && (
            <button
              onClick={onClearQueue}
              className="text-[11px] text-[var(--editor-text-muted)] hover:text-[var(--editor-text-secondary)] transition-colors"
            >
              Clear queue
            </button>
          )}
        </div>
      )}

      {/* Input card */}
      <div
        className={cn(
          'relative backdrop-blur-2xl rounded-2xl border shadow-[0_4px_24px_rgba(0,0,0,0.2)] transition-colors duration-200',
          'bg-white/[0.03] border-white/[0.07]',
        )}
      >
        {/* Attachment chips inside card */}
        <AnimatePresence>
          {attachmentChips.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pt-3 flex flex-wrap items-center gap-1.5"
            >
              {attachmentChips.map((att) => (
                <span
                  key={att.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-normal
                             bg-white/[0.06] text-white/60 border border-white/[0.08]"
                >
                  <Paperclip className="w-3 h-3" />
                  <input
                    type="text"
                    value={att.label}
                    onChange={(e) => att.onLabelChange(e.target.value)}
                    className="bg-transparent outline-none text-[11px] w-24 max-w-[120px]"
                    placeholder="Label..."
                  />
                  <button
                    onClick={att.onRemove}
                    className="ml-0.5 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {attachmentUploading && (
                <Loader2 className="w-3 h-3 animate-spin text-white/30" />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Textarea */}
        <div className="px-4 pt-3 pb-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              'w-full resize-none bg-transparent border-none',
              'text-white/90 text-sm focus:outline-none placeholder:text-white/25',
              'min-h-[44px] disabled:opacity-50',
            )}
            style={{ overflow: 'hidden' }}
          />
        </div>

        {/* Bottom bar */}
        <div className="px-4 py-2.5 border-t border-white/[0.05] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Attach button */}
            {onAttach && (
              <motion.button
                type="button"
                onClick={onAttach}
                whileTap={{ scale: 0.94 }}
                disabled={disabled}
                className="p-1.5 text-white/40 hover:text-white/90 rounded-lg transition-colors disabled:opacity-50"
                title="Attach an image"
              >
                <Paperclip className="w-4 h-4" />
              </motion.button>
            )}

            {/* Stop button */}
            {isStreaming && onStop && (
              <motion.button
                type="button"
                onClick={onStop}
                whileTap={{ scale: 0.94 }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg
                           border border-white/[0.08] bg-white/[0.04]
                           text-white/50 hover:text-white/80 hover:bg-white/[0.06]
                           transition-colors text-xs"
                title="Stop generating"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                Stop
              </motion.button>
            )}
          </div>

          {/* Send / Queue button */}
          <motion.button
            type="button"
            onClick={canSend && !disabled ? onSend : undefined}
            whileHover={canSend && !disabled ? { scale: 1.04 } : undefined}
            whileTap={canSend && !disabled ? { scale: 0.96 } : undefined}
            disabled={!canSend || disabled}
            className={cn(
              'p-2 rounded-xl text-sm font-normal transition-all flex items-center justify-center',
              canSend && !disabled
                ? 'bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/20 hover:bg-[#7C3AED]'
                : 'bg-white/[0.05] text-white/30 cursor-not-allowed',
            )}
            title={isStreaming ? 'Queue message' : 'Send message'}
          >
            <ArrowUp className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}));
