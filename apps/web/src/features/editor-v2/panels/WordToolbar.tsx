'use client';

import React from 'react';
import { Bold, Maximize2, Palette, Highlighter, X } from 'lucide-react';
import { useEditorActions } from '../store/use-editor-store';
import type { CaptionWord } from '../store/types';

interface WordToolbarProps {
  captionId: string;
  wordIndex: number;
  word: CaptionWord;
  position: { x: number; y: number };
  onClose: () => void;
}

export function WordToolbar({ captionId, wordIndex, word, position, onClose }: WordToolbarProps) {
  const { updateWordStyleOverrides } = useEditorActions();
  const overrides = word.styleOverrides || {};

  const toggleBold = () => {
    updateWordStyleOverrides(captionId, wordIndex, {
      fontWeight: overrides.fontWeight === 900 ? undefined : 900,
    });
  };

  const toggleScale = () => {
    updateWordStyleOverrides(captionId, wordIndex, {
      scale: overrides.scale === 1.2 ? undefined : 1.2,
    });
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateWordStyleOverrides(captionId, wordIndex, {
      color: e.target.value,
    });
  };

  const handleHighlightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateWordStyleOverrides(captionId, wordIndex, {
      emphasisBg: e.target.value,
    });
  };

  const clearAll = () => {
    updateWordStyleOverrides(captionId, wordIndex, null);
    onClose();
  };

  return (
    <div
      className="fixed z-[100] flex items-center gap-1 px-2 py-1.5 rounded-lg shadow-lg
                 bg-[var(--editor-bg-elevated)] border border-[var(--editor-border-subtle)]"
      style={{
        left: position.x,
        top: position.y - 44,
        transform: 'translateX(-50%)',
      }}
    >
      {/* Bold toggle */}
      <button
        onClick={toggleBold}
        className={`p-1.5 rounded transition-colors ${
          overrides.fontWeight === 900
            ? 'bg-[var(--editor-accent)]/20 text-[var(--editor-accent)]'
            : 'text-[var(--editor-text-secondary)] hover:bg-[var(--editor-bg-hover)]'
        }`}
        title="Bold"
      >
        <Bold size={14} />
      </button>

      {/* Scale toggle */}
      <button
        onClick={toggleScale}
        className={`p-1.5 rounded transition-colors ${
          overrides.scale === 1.2
            ? 'bg-[var(--editor-accent)]/20 text-[var(--editor-accent)]'
            : 'text-[var(--editor-text-secondary)] hover:bg-[var(--editor-bg-hover)]'
        }`}
        title="Scale up"
      >
        <Maximize2 size={14} />
      </button>

      {/* Divider */}
      <div className="w-px h-5 bg-[var(--editor-border-subtle)]" />

      {/* Color picker */}
      <label
        className="p-1.5 rounded cursor-pointer text-[var(--editor-text-secondary)] hover:bg-[var(--editor-bg-hover)] transition-colors"
        title="Text color"
      >
        <Palette size={14} />
        <input
          type="color"
          value={overrides.color || '#ffffff'}
          onChange={handleColorChange}
          className="sr-only"
        />
      </label>

      {/* Highlight BG picker */}
      <label
        className="p-1.5 rounded cursor-pointer text-[var(--editor-text-secondary)] hover:bg-[var(--editor-bg-hover)] transition-colors"
        title="Highlight background"
      >
        <Highlighter size={14} />
        <input
          type="color"
          value={overrides.emphasisBg || '#ffff00'}
          onChange={handleHighlightChange}
          className="sr-only"
        />
      </label>

      {/* Divider */}
      <div className="w-px h-5 bg-[var(--editor-border-subtle)]" />

      {/* Clear all / Close */}
      <button
        onClick={clearAll}
        className="p-1.5 rounded text-[var(--editor-text-muted)] hover:bg-[var(--editor-bg-hover)] hover:text-red-400 transition-colors"
        title="Clear overrides"
      >
        <X size={14} />
      </button>
    </div>
  );
}
