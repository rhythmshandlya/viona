/**
 * AI Assistant Panel
 * Right sidebar chat interface for AI interactions
 */

'use client';

import React, { useState } from 'react';
import { Sparkles, Send, MoreHorizontal } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIAssistantPanelProps {
  className?: string;
}

export function AIAssistantPanel({ className = '' }: AIAssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    // TODO: Connect to AI backend
    // For now, show a placeholder response
    setIsLoading(true);
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm the AI Assistant. This feature is coming soon! I'll be able to help you edit your video, generate visuals, and make creative suggestions.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`flex flex-col h-full bg-[var(--editor-bg-surface)] border-l border-[var(--editor-border-subtle)] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--editor-border-subtle)]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[var(--editor-accent)]" />
          <span className="text-sm font-semibold text-[var(--editor-text-primary)]">AI Assistant</span>
        </div>
        <button
          className="p-1.5 rounded-md hover:bg-[var(--editor-bg-hover)] transition-colors"
          aria-label="Options"
        >
          <MoreHorizontal className="w-4 h-4 text-[var(--editor-text-secondary)]" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-full bg-[var(--editor-accent-muted)] flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-[var(--editor-accent)] opacity-60" />
            </div>
            <p className="text-sm text-[var(--editor-text-secondary)] mb-2">
              Ask AI to help edit your video
            </p>
            <p className="text-xs text-[var(--editor-text-muted)]">
              Try: "Make the captions more dynamic" or "Add a fade transition"
            </p>
          </div>
        ) : (
          /* Messages */
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-4 py-2.5 text-sm ${
                  message.role === 'user'
                    ? 'bg-[var(--editor-accent)] text-white rounded-2xl rounded-br-md'
                    : 'bg-[var(--editor-bg-hover)] text-[var(--editor-text-primary)] rounded-2xl rounded-bl-md'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[var(--editor-bg-hover)] text-[var(--editor-text-primary)] rounded-2xl rounded-bl-md px-4 py-2.5">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-[var(--editor-text-muted)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-[var(--editor-text-muted)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-[var(--editor-text-muted)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-[var(--editor-border-subtle)]">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI to make changes..."
            className="w-full bg-[var(--editor-bg-hover)] text-[var(--editor-text-primary)] text-sm
                       placeholder:text-[var(--editor-text-muted)]
                       rounded-xl px-4 py-3 pr-12
                       border border-transparent
                       focus:outline-none focus:border-[var(--editor-accent)] focus:ring-2 focus:ring-[var(--editor-accent-soft)]
                       transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 w-8 h-8 flex items-center justify-center
                       rounded-full bg-[var(--editor-accent)] text-white
                       hover:bg-[var(--editor-accent-hover)] transition-colors
                       disabled:bg-[var(--editor-bg-hover)] disabled:text-[var(--editor-text-muted)]"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
