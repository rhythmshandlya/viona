'use client';

import React, { useState, useEffect } from 'react';
import { Bold, Maximize2, Palette, Highlighter, X, Type } from 'lucide-react';
import { useCaptionActions, useFirstCaptionStyle } from '../store/use-editor-store';
import type { CaptionWord } from '../store/types';
import { FONT_REGISTRY, loadFont, findFont } from '@/lib/font-registry';

interface WordToolbarProps {
  captionId: string;
  wordIndex: number;
  word: CaptionWord;
  position?: { x: number; y: number };
  onClose: () => void;
}

export function WordToolbar({ captionId, wordIndex, word, position, onClose }: WordToolbarProps) {
  const { updateWordStyleOverrides } = useCaptionActions();
  const captionStyle = useFirstCaptionStyle();
  const overrides = word.styleOverrides || {};
  const [expanded, setExpanded] = useState(false);

  // Local state for font size input so user can freely type without validation blocking mid-edit
  const resolvedFontSize = overrides.fontSize ?? captionStyle?.fontSize ?? 48;
  const [fontSizeInput, setFontSizeInput] = useState(String(resolvedFontSize));

  // Sync local input when the override or caption style changes externally
  useEffect(() => {
    setFontSizeInput(String(resolvedFontSize));
  }, [resolvedFontSize]);

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

  const handleActiveColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateWordStyleOverrides(captionId, wordIndex, {
      activeColor: e.target.value,
    });
  };

  const handleHighlightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateWordStyleOverrides(captionId, wordIndex, {
      emphasisBg: e.target.value,
    });
  };

  const handleFontFamilyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedFamily = e.target.value;
    if (!selectedFamily) {
      updateWordStyleOverrides(captionId, wordIndex, { fontFamily: undefined });
      return;
    }
    const entry = findFont(selectedFamily);
    if (entry) {
      await loadFont(entry);
      const fallback =
        entry.category === 'serif'
          ? 'serif'
          : entry.category === 'mono'
            ? 'monospace'
            : 'system-ui, sans-serif';
      updateWordStyleOverrides(captionId, wordIndex, {
        fontFamily: `${entry.family}, ${fallback}`,
      });
    }
  };

  const commitFontSize = () => {
    const value = parseInt(fontSizeInput, 10);
    if (!isNaN(value) && value >= 12 && value <= 200) {
      updateWordStyleOverrides(captionId, wordIndex, { fontSize: value });
    } else {
      // Reset to current resolved value
      setFontSizeInput(String(resolvedFontSize));
    }
  };

  const handleTextTransformChange = (transform: 'none' | 'uppercase' | 'lowercase' | undefined) => {
    updateWordStyleOverrides(captionId, wordIndex, { textTransform: transform });
  };

  const clearAll = () => {
    updateWordStyleOverrides(captionId, wordIndex, null);
    onClose();
  };

  // Derive current primary font family for the select
  const currentFontFamily = overrides.fontFamily?.split(',')[0].trim() || '';

  return (
    <div
      className={`${position ? 'fixed' : 'relative'} z-[100] flex flex-col rounded-lg shadow-lg
                 bg-[var(--editor-bg-elevated)] border border-[var(--editor-border-subtle)]`}
      style={position ? {
        left: position.x,
        top: position.y - (expanded ? 104 : 44),
        transform: 'translateX(-50%)',
      } : undefined}
    >
      {/* Primary toolbar row */}
      <div className="flex items-center gap-1 px-2 py-1.5">
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

        {/* Color picker — single swatch showing current override color */}
        <label
          className="relative p-0.5 rounded cursor-pointer hover:bg-[var(--editor-bg-hover)] transition-colors"
          title="Text color"
        >
          <div
            className="w-6 h-6 rounded border border-[var(--editor-border-subtle)]"
            style={{ backgroundColor: overrides.color || captionStyle?.color || '#ffffff' }}
          />
          <input
            type="color"
            value={overrides.color || captionStyle?.color || '#ffffff'}
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

        {/* Expand toggle for font controls */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`p-1.5 rounded transition-colors ${
            expanded
              ? 'bg-[var(--editor-accent)]/20 text-[var(--editor-accent)]'
              : 'text-[var(--editor-text-secondary)] hover:bg-[var(--editor-bg-hover)]'
          }`}
          title="Font options"
        >
          <Type size={14} />
        </button>

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

      {/* Expanded font controls */}
      {expanded && (
        <div className="flex flex-col gap-1.5 px-2 py-1.5 border-t border-[var(--editor-border-subtle)]">
          <div className="flex items-center gap-1.5">
            {/* Font Family */}
            <select
              value={currentFontFamily}
              onChange={handleFontFamilyChange}
              className="w-24 px-1 py-1 text-[10px] rounded
                         bg-[var(--editor-bg-surface)] text-[var(--editor-text-primary)]
                         border border-[var(--editor-border-subtle)]
                         focus:outline-none focus:border-[var(--editor-accent)]
                         cursor-pointer"
              title="Font family"
            >
              <option value="">Default</option>
              {FONT_REGISTRY.map((font) => (
                <option key={font.family} value={font.family}>
                  {font.family}
                </option>
              ))}
            </select>

            {/* Font Size — free-type input, commits on blur/Enter */}
            <input
              type="text"
              inputMode="numeric"
              value={fontSizeInput}
              onChange={(e) => setFontSizeInput(e.target.value)}
              onBlur={commitFontSize}
              onKeyDown={(e) => { if (e.key === 'Enter') commitFontSize(); }}
              className="w-12 px-1 py-1 text-[10px] rounded text-center
                         bg-[var(--editor-bg-surface)] text-[var(--editor-text-primary)]
                         border border-[var(--editor-border-subtle)]
                         focus:outline-none focus:border-[var(--editor-accent)]"
              title="Font size (px)"
            />

            {/* Text Transform toggles */}
            <div className="flex rounded overflow-hidden border border-[var(--editor-border-subtle)]">
              <button
                onClick={() => handleTextTransformChange(overrides.textTransform === 'uppercase' ? undefined : 'uppercase')}
                className={`px-1.5 py-1 text-[10px] font-medium transition-colors ${
                  overrides.textTransform === 'uppercase'
                    ? 'bg-[var(--editor-accent)]/20 text-[var(--editor-accent)]'
                    : 'bg-[var(--editor-bg-surface)] text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)]'
                }`}
                title="Uppercase"
              >
                AA
              </button>
              <button
                onClick={() => handleTextTransformChange(overrides.textTransform === 'lowercase' ? undefined : 'lowercase')}
                className={`px-1.5 py-1 text-[10px] font-medium transition-colors ${
                  overrides.textTransform === 'lowercase'
                    ? 'bg-[var(--editor-accent)]/20 text-[var(--editor-accent)]'
                    : 'bg-[var(--editor-bg-surface)] text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)]'
                }`}
                title="Lowercase"
              >
                aa
              </button>
            </div>

            {/* Active color swatch — in expanded row */}
            <label
              className="relative p-0.5 rounded cursor-pointer hover:bg-[var(--editor-bg-hover)] transition-colors"
              title="Active word color"
            >
              <div
                className="w-6 h-6 rounded border border-[var(--editor-border-subtle)]"
                style={{ backgroundColor: overrides.activeColor || captionStyle?.activeColor || '#ffff00' }}
              />
              <input
                type="color"
                value={overrides.activeColor || captionStyle?.activeColor || '#ffff00'}
                onChange={handleActiveColorChange}
                className="sr-only"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
