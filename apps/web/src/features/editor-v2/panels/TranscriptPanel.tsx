'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  AlignLeft,
  Search,
  LocateFixed,
  LocateOff,
  Layers,
  CornerLeftUp,
  CornerLeftDown,
  Scissors,
  Trash2,
  Replace,
  X,
} from 'lucide-react';
import {
  useCaptionItems,
  useEditorStore,
  usePlaybackActions,
  useCaptionActions,
  useTimelineActions,
  useAIActions,
  useProject,
  useSelectedIds,
  useSelectedSceneId,
} from '../store/use-editor-store';
import { CaptionItemData, TimelineItem } from '../store/types';
import { api, SceneInfo } from '@/lib/api';
import { WordToolbar } from '../panels/WordToolbar';

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function TranscriptPanel() {
  const [isFollowing, setIsFollowing] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [scenes, setScenes] = useState<SceneInfo[]>([]);
  const [showScenes, setShowScenes] = useState(true);
  const [selectedWord, setSelectedWord] = useState<{ captionId: string; wordIndex: number } | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const captionItems = useCaptionItems();
  const project = useProject();
  const selectedIds = useSelectedIds();
  const selectedSceneId = useSelectedSceneId();
  const { seek } = usePlaybackActions();
  const { updateCaptionText, splitCaption, mergeCaptions } = useCaptionActions();
  const { select, deleteItems } = useTimelineActions();
  const { setSelectedScene } = useAIActions();

  const [transcriptPhrases, setTranscriptPhrases] = useState<
    Array<{ text: string; startMs: number; endMs: number }>
  >([]);

  const activeCaptionId = useEditorStore((state) => {
    const t = state.currentTimeMs;
    for (const id of state.itemIds) {
      const item = state.items[id];
      if (item?.type === 'caption' && t >= item.startMs && t < item.endMs) {
        return item.id;
      }
    }
    return null;
  });

  const activeWordKey = useEditorStore((state) => {
    if (!activeCaptionId) return null;
    const t = state.currentTimeMs;
    const caption = state.items[activeCaptionId];
    if (!caption) return null;
    const data = caption.data as CaptionItemData;
    if (!data.words?.length) return null;
    const idx = data.words.findIndex((w) => {
      const absoluteStart = caption.startMs + w.startMs;
      const absoluteEnd = caption.startMs + w.endMs;
      return t >= absoluteStart && t < absoluteEnd;
    });
    return idx >= 0 ? `${activeCaptionId}:${idx}` : null;
  });

  useEffect(() => {
    if (project?.id) {
      api.getScenes(project.id)
        .then((data) => setScenes(data.scenes))
        .catch((err) => console.warn('Failed to fetch scenes:', err));
    }
  }, [project?.id]);

  useEffect(() => {
    if (!project?.id) { setTranscriptPhrases([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${project.id}`, { credentials: 'include' });
        if (!res.ok) return;
        const body = await res.json();
        const words: Array<{ text: string; startMs: number; endMs: number }> =
          body?.transcript?.words ?? [];
        if (!words.length || cancelled) return;
        const phrases: Array<{ text: string; startMs: number; endMs: number }> = [];
        let buf: typeof words = [];
        const flush = () => {
          if (!buf.length) return;
          phrases.push({
            text: buf.map(w => w.text).join(' '),
            startMs: buf[0].startMs,
            endMs: buf[buf.length - 1].endMs,
          });
          buf = [];
        };
        for (let i = 0; i < words.length; i++) {
          const w = words[i];
          if (buf.length > 0) {
            const prev = buf[buf.length - 1];
            const gap = w.startMs - prev.endMs;
            const spanMs = w.endMs - buf[0].startMs;
            if (gap > 400 || buf.length >= 8 || spanMs > 5000) flush();
          }
          buf.push(w);
        }
        flush();
        if (!cancelled) setTranscriptPhrases(phrases);
      } catch (err) {
        console.warn('Failed to fetch transcript:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [project?.id]);

  const getSceneForCaption = useCallback((startMs: number): SceneInfo | null => {
    return scenes.find(s => startMs >= s.startMs && startMs < s.endMs) || null;
  }, [scenes]);

  const currentScene = useMemo(() => {
    const t = useEditorStore.getState().currentTimeMs;
    return scenes.find(s => t >= s.startMs && t < s.endMs) || null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes, activeCaptionId]);

  const filteredCaptions = useMemo(() => {
    if (!searchQuery) return captionItems;
    const q = searchQuery.toLowerCase();
    return captionItems.filter((item) => {
      const data = item.data as CaptionItemData;
      return data.text.toLowerCase().includes(q);
    });
  }, [captionItems, searchQuery]);

  useEffect(() => {
    if (isFollowing && activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeCaptionId, isFollowing]);

  // Right-click "Edit Text" from the timeline lands us here. We auto-enter
  // edit mode for that caption and scroll it into view so the user doesn't
  // have to find the row themselves.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ captionId: string }>).detail;
      if (!detail?.captionId) return;
      const item = useEditorStore.getState().items[detail.captionId];
      if (!item || item.type !== 'caption') return;
      const data = item.data as CaptionItemData;
      setFocusedId(item.id);
      setEditingId(item.id);
      setEditText(data.text);
      // Scroll into view on next paint
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-caption-row="${item.id}"]`);
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    };
    window.addEventListener('viona:caption-edit-text', handler);
    return () => window.removeEventListener('viona:caption-edit-text', handler);
  }, []);

  const handleStartEdit = useCallback((item: TimelineItem) => {
    const data = item.data as CaptionItemData;
    setEditingId(item.id);
    setEditText(data.text);
  }, []);

  const handleConfirmEdit = useCallback(() => {
    if (editingId && editText.trim()) {
      updateCaptionText(editingId, editText.trim());
    }
    setEditingId(null);
    setEditText('');
  }, [editingId, editText, updateCaptionText]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditText('');
  }, []);

  const handleSeek = useCallback((timeMs: number) => seek(timeMs), [seek]);
  const handleSelect = useCallback((id: string) => select([id], 'replace'), [select]);

  // Row-level actions
  const handleMergeUp = useCallback((item: TimelineItem) => {
    const idx = captionItems.findIndex(c => c.id === item.id);
    if (idx <= 0) return;
    const prev = captionItems[idx - 1];
    mergeCaptions(prev.id, item.id);
  }, [captionItems, mergeCaptions]);

  const handleMergeDown = useCallback((item: TimelineItem) => {
    const idx = captionItems.findIndex(c => c.id === item.id);
    if (idx < 0 || idx >= captionItems.length - 1) return;
    const next = captionItems[idx + 1];
    mergeCaptions(item.id, next.id);
  }, [captionItems, mergeCaptions]);

  const handleSplitAtSelectedWord = useCallback((item: TimelineItem) => {
    const data = item.data as CaptionItemData;
    // Prefer the selected word; else split at the active word; else split in half.
    let wordIndex = selectedWord?.captionId === item.id ? selectedWord.wordIndex : -1;
    if (wordIndex < 0 && activeWordKey?.startsWith(`${item.id}:`)) {
      wordIndex = Number(activeWordKey.split(':')[1]);
    }
    if (wordIndex <= 0) wordIndex = Math.floor((data.words?.length ?? 0) / 2);
    if (wordIndex <= 0 || wordIndex >= (data.words?.length ?? 0)) return;
    splitCaption(item.id, wordIndex);
  }, [selectedWord, activeWordKey, splitCaption]);

  const handleDelete = useCallback((item: TimelineItem) => {
    deleteItems([item.id]);
  }, [deleteItems]);

  // Find & replace
  const handleReplaceAll = useCallback(() => {
    if (!searchQuery) return;
    const q = searchQuery;
    const r = replaceQuery;
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    for (const item of captionItems) {
      const data = item.data as CaptionItemData;
      if (!re.test(data.text)) { re.lastIndex = 0; continue; }
      re.lastIndex = 0;
      const newText = data.text.replace(re, r);
      if (newText !== data.text) updateCaptionText(item.id, newText);
    }
  }, [searchQuery, replaceQuery, captionItems, updateCaptionText]);

  // Keyboard nav — arrow up/down between rows, Enter to edit, Delete to remove
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (editingId) return; // editing captures its own keys
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      setShowSearch(true);
      setTimeout(() => searchInputRef.current?.focus(), 0);
      return;
    }
    const idx = filteredCaptions.findIndex(c => c.id === focusedId);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = filteredCaptions[Math.min(filteredCaptions.length - 1, Math.max(0, idx + 1))];
      if (next) { setFocusedId(next.id); handleSeek(next.startMs); handleSelect(next.id); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = filteredCaptions[Math.max(0, idx - 1)];
      if (prev) { setFocusedId(prev.id); handleSeek(prev.startMs); handleSelect(prev.id); }
    } else if (e.key === 'Enter' && focusedId) {
      e.preventDefault();
      const cur = captionItems.find(c => c.id === focusedId);
      if (cur) handleStartEdit(cur);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && focusedId && !editingId) {
      e.preventDefault();
      const cur = captionItems.find(c => c.id === focusedId);
      if (cur) handleDelete(cur);
    }
  }, [editingId, filteredCaptions, focusedId, captionItems, handleSeek, handleSelect, handleStartEdit, handleDelete]);

  return (
    <div
      className="flex flex-col h-full bg-[var(--editor-bg-surface)] focus:outline-none"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--editor-border-subtle)]">
        <div className="flex items-center gap-2">
          <AlignLeft size={14} className="text-[var(--editor-text-muted)]" />
          <span className="text-xs font-normal text-[var(--editor-text-secondary)]">Transcript</span>
          <span className="text-[10px] text-[var(--editor-text-muted)]">{captionItems.length}</span>
        </div>
        <div className="flex items-center gap-1">
          {scenes.length > 0 && (
            <button
              onClick={() => setShowScenes(!showScenes)}
              className={`p-1 rounded transition-colors ${
                showScenes
                  ? 'bg-[var(--editor-accent)]/10 text-[var(--editor-accent)]'
                  : 'text-[var(--editor-text-muted)] hover:bg-[var(--editor-bg-hover)]'
              }`}
              title={showScenes ? 'Hide scene markers' : 'Show scene markers'}
            >
              <Layers size={13} />
            </button>
          )}
          <button
            onClick={() => {
              const next = !showSearch;
              setShowSearch(next);
              if (next) setTimeout(() => searchInputRef.current?.focus(), 0);
            }}
            className={`p-1 rounded transition-colors ${
              showSearch
                ? 'bg-[var(--editor-accent)]/10 text-[var(--editor-accent)]'
                : 'text-[var(--editor-text-muted)] hover:bg-[var(--editor-bg-hover)]'
            }`}
            title="Search / replace (⌘F)"
          >
            <Search size={13} />
          </button>
          <button
            onClick={() => setIsFollowing(!isFollowing)}
            className={`p-1 rounded transition-colors ${
              isFollowing
                ? 'bg-[var(--editor-accent)]/10 text-[var(--editor-accent)]'
                : 'text-[var(--editor-text-muted)] hover:bg-[var(--editor-bg-hover)]'
            }`}
            title={isFollowing ? 'Following playhead' : 'Not following'}
          >
            {isFollowing ? <LocateFixed size={13} /> : <LocateOff size={13} />}
          </button>
        </div>
      </div>

      {selectedIds.length === 0 && captionItems.length > 0 && (
        <div className="px-3 pt-2 text-[10px] text-[var(--editor-text-muted)] uppercase tracking-wide">
          Editing all {captionItems.length} {captionItems.length === 1 ? 'caption' : 'captions'}
        </div>
      )}

      {/* Scene indicator */}
      {showScenes && currentScene && (
        <div className="px-3 py-1.5 bg-[var(--editor-accent)]/5 border-b border-[var(--editor-border-subtle)]">
          <span className="text-[10px] font-normal text-[var(--editor-accent)]">
            Scene {currentScene.id}
          </span>
        </div>
      )}

      {/* Search + replace */}
      {showSearch && (
        <div className="px-3 py-2 border-b border-[var(--editor-border-subtle)] flex flex-col gap-1.5">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--editor-text-muted)]" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find..."
              className="w-full pl-7 pr-7 py-1 text-xs bg-[var(--editor-bg-base)] border border-[var(--editor-border-default)]
                         rounded text-[var(--editor-text-primary)] placeholder:text-[var(--editor-text-muted)]
                         focus:outline-none focus:border-[var(--editor-accent)]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-[var(--editor-text-muted)] hover:text-[var(--editor-text-primary)]"
                title="Clear"
              >
                <X size={11} />
              </button>
            )}
          </div>
          <div className="relative">
            <Replace size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--editor-text-muted)]" />
            <input
              type="text"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleReplaceAll(); }}
              placeholder="Replace with..."
              className="w-full pl-7 pr-16 py-1 text-xs bg-[var(--editor-bg-base)] border border-[var(--editor-border-default)]
                         rounded text-[var(--editor-text-primary)] placeholder:text-[var(--editor-text-muted)]
                         focus:outline-none focus:border-[var(--editor-accent)]"
            />
            <button
              onClick={handleReplaceAll}
              disabled={!searchQuery}
              className="absolute right-1 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] rounded
                         bg-[var(--editor-accent)] text-white disabled:opacity-40 disabled:cursor-not-allowed
                         hover:opacity-90"
            >
              Replace all
            </button>
          </div>
        </div>
      )}

      {/* Caption list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {filteredCaptions.length === 0 ? (
          transcriptPhrases.length === 0 ? (
            <div className="p-4 text-center text-xs text-[var(--editor-text-muted)]">
              {searchQuery ? 'No matches found' : 'No transcript available yet'}
            </div>
          ) : (
            (searchQuery
              ? transcriptPhrases.filter(p => p.text.toLowerCase().includes(searchQuery.toLowerCase()))
              : transcriptPhrases
            ).map((phrase, idx) => (
              <button
                key={`transcript-${idx}`}
                type="button"
                onClick={() => handleSeek(phrase.startMs)}
                className="w-full text-left px-4 py-2 text-sm text-[var(--editor-text)] hover:bg-[var(--editor-hover)] border-b border-[var(--editor-border)]/30 transition-colors"
              >
                <div className="text-[10px] text-[var(--editor-text-muted)] mb-0.5">
                  {formatTime(phrase.startMs)}
                </div>
                <div>{phrase.text}</div>
              </button>
            ))
          )
        ) : (
          filteredCaptions.map((item, index) => {
            const data = item.data as CaptionItemData;
            const isActive = item.id === activeCaptionId;
            const isEditing = item.id === editingId;
            const isFocused = item.id === focusedId;

            const captionScene = showScenes ? getSceneForCaption(item.startMs) : null;
            const prevItem = index > 0 ? filteredCaptions[index - 1] : null;
            const prevScene = prevItem && showScenes ? getSceneForCaption(prevItem.startMs) : null;
            const isNewScene = captionScene && (!prevScene || prevScene.id !== captionScene.id);
            const canMergeUp = index > 0;
            const canMergeDown = index < filteredCaptions.length - 1;

            return (
              <React.Fragment key={item.id}>
                {isNewScene && captionScene && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedScene(selectedSceneId === captionScene.id ? null : captionScene.id);
                      seek(captionScene.startMs);
                    }}
                    className={`sticky top-0 z-10 w-full flex items-center justify-between px-3 py-1.5 border-b transition-colors cursor-pointer
                      ${selectedSceneId === captionScene.id
                        ? 'bg-[var(--editor-accent)]/10 border-[var(--editor-accent)]/30'
                        : 'bg-[var(--editor-bg-base)] border-[var(--editor-border-default)] hover:bg-[var(--editor-bg-hover)]'
                      }`}
                    title="Click to select this scene for AI editing"
                  >
                    <span className={`text-[10px] font-normal ${selectedSceneId === captionScene.id ? 'text-[var(--editor-accent)]' : 'text-[var(--editor-text-secondary)]'}`}>
                      Scene {captionScene.id}
                    </span>
                    <span className="text-[10px] text-[var(--editor-text-muted)] font-mono">
                      {formatTime(captionScene.startMs)}
                    </span>
                  </button>
                )}

                <div
                  ref={isActive ? activeRef : undefined}
                  data-caption-row={item.id}
                  className={`group relative flex items-start gap-2 px-3 py-2 border-b border-[var(--editor-border-subtle)]
                             cursor-pointer transition-colors
                             ${isActive
                               ? 'bg-[var(--editor-accent)]/10 border-l-2 border-l-[var(--editor-accent)]'
                               : isFocused
                                 ? 'bg-[var(--editor-bg-hover)]/70 border-l-2 border-l-[var(--editor-text-muted)]/40'
                                 : 'border-l-2 border-l-transparent hover:bg-[var(--editor-bg-hover)]/50'
                             }`}
                  onClick={() => {
                    handleSelect(item.id);
                    handleSeek(item.startMs);
                    setFocusedId(item.id);
                  }}
                >
                  {/* Timestamp */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSeek(item.startMs);
                    }}
                    className="flex-shrink-0 pt-0.5 text-[10px] text-[var(--editor-text-muted)] hover:text-[var(--editor-accent)]
                               font-mono tabular-nums transition-colors min-w-[34px]"
                    title="Jump to start"
                  >
                    {formatTime(item.startMs)}
                  </button>

                  {/* Text content */}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleConfirmEdit();
                          }
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        onBlur={handleConfirmEdit}
                        className="w-full px-1 py-0.5 text-xs bg-[var(--editor-bg-base)] border border-[var(--editor-accent)]
                                   rounded text-[var(--editor-text-primary)] resize-none focus:outline-none"
                        rows={2}
                        autoFocus
                        onFocus={(e) => e.currentTarget.select()}
                      />
                    ) : (
                      <div
                        className={`text-xs leading-relaxed flex flex-wrap gap-0.5 ${
                          isActive ? 'text-[var(--editor-text-primary)]' : 'text-[var(--editor-text-secondary)]'
                        }`}
                        onClick={(e) => {
                          // Click on empty gap (not on a word chip) → enter edit mode
                          if (e.target === e.currentTarget) {
                            e.stopPropagation();
                            handleStartEdit(item);
                          }
                        }}
                      >
                        {data.words && data.words.length > 0 ? (
                          data.words.map((word, wi) => {
                            const isActiveWord = isActive && activeWordKey === `${item.id}:${wi}`;
                            const hasOverrides = word.styleOverrides && Object.keys(word.styleOverrides).length > 0;
                            const isWordSelected = selectedWord?.captionId === item.id && selectedWord?.wordIndex === wi;

                            return (
                              <span
                                key={wi}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSeek(item.startMs + word.startMs);
                                  handleSelect(item.id);
                                  setSelectedWord({ captionId: item.id, wordIndex: wi });
                                  setFocusedId(item.id);
                                }}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEdit(item);
                                }}
                                className={`cursor-pointer rounded px-0.5 transition-colors ${
                                  isActiveWord ? 'text-[var(--editor-accent)] font-normal' : ''
                                } ${
                                  hasOverrides ? 'underline decoration-dotted underline-offset-2' : ''
                                } ${
                                  isWordSelected
                                    ? 'bg-[var(--editor-accent)]/20 ring-1 ring-[var(--editor-accent)]'
                                    : 'hover:bg-[var(--editor-bg-hover)]'
                                }`}
                              >
                                {word.text}
                              </span>
                            );
                          })
                        ) : (
                          <span onClick={(e) => { e.stopPropagation(); handleStartEdit(item); }}>{data.text}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Hover row actions */}
                  {!isEditing && (
                    <div
                      className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleMergeUp(item)}
                        disabled={!canMergeUp}
                        className="p-1 rounded text-[var(--editor-text-muted)] hover:text-[var(--editor-accent)]
                                   hover:bg-[var(--editor-bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Merge with previous (⌘↑)"
                      >
                        <CornerLeftUp size={12} />
                      </button>
                      <button
                        onClick={() => handleSplitAtSelectedWord(item)}
                        className="p-1 rounded text-[var(--editor-text-muted)] hover:text-[var(--editor-accent)]
                                   hover:bg-[var(--editor-bg-hover)]"
                        title="Split at selected word"
                      >
                        <Scissors size={12} />
                      </button>
                      <button
                        onClick={() => handleMergeDown(item)}
                        disabled={!canMergeDown}
                        className="p-1 rounded text-[var(--editor-text-muted)] hover:text-[var(--editor-accent)]
                                   hover:bg-[var(--editor-bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Merge with next (⌘↓)"
                      >
                        <CornerLeftDown size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-1 rounded text-[var(--editor-text-muted)] hover:text-red-400
                                   hover:bg-[var(--editor-bg-hover)]"
                        title="Delete caption (Del)"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Word style toolbar */}
                {selectedWord?.captionId === item.id && data.words?.[selectedWord.wordIndex] && (
                  <div className="px-3 py-1.5 border-b border-[var(--editor-border-subtle)] bg-[var(--editor-bg-base)]">
                    <WordToolbar
                      captionId={item.id}
                      wordIndex={selectedWord.wordIndex}
                      word={data.words[selectedWord.wordIndex]}
                      onClose={() => setSelectedWord(null)}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Keyboard hint footer */}
      {filteredCaptions.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-1.5 border-t border-[var(--editor-border-subtle)] text-[9px] text-[var(--editor-text-muted)]">
          <span><kbd className="font-mono">↑↓</kbd> nav</span>
          <span><kbd className="font-mono">↵</kbd> edit</span>
          <span><kbd className="font-mono">⌦</kbd> delete</span>
          <span><kbd className="font-mono">⌘F</kbd> find</span>
          <span>click word to seek · dbl-click to edit</span>
        </div>
      )}
    </div>
  );
}
