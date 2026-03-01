'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AlignLeft, Search, LocateFixed, LocateOff, Layers } from 'lucide-react';
import {
  useCaptionItems,
  useCurrentTimeMs,
  useEditorActions,
  useProject,
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
  const [showSearch, setShowSearch] = useState(false);
  const [scenes, setScenes] = useState<SceneInfo[]>([]);
  const [showScenes, setShowScenes] = useState(true);
  const [selectedWord, setSelectedWord] = useState<{ captionId: string; wordIndex: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  const captionItems = useCaptionItems();
  const currentTimeMs = useCurrentTimeMs();
  const project = useProject();
  const selectedSceneId = useSelectedSceneId();
  const { seek, updateCaptionText, select, setSelectedScene } = useEditorActions();

  // Fetch scenes when project loads
  useEffect(() => {
    if (project?.id) {
      api.getScenes(project.id)
        .then((data) => setScenes(data.scenes))
        .catch((err) => console.warn('Failed to fetch scenes:', err));
    }
  }, [project?.id]);

  // Find which scene a caption belongs to
  const getSceneForCaption = useCallback((startMs: number): SceneInfo | null => {
    return scenes.find(s => startMs >= s.startMs && startMs < s.endMs) || null;
  }, [scenes]);

  // Get current scene based on playhead
  const currentScene = React.useMemo(() => {
    return scenes.find(s => currentTimeMs >= s.startMs && currentTimeMs < s.endMs) || null;
  }, [scenes, currentTimeMs]);

  // Filter by search
  const filteredCaptions = React.useMemo(() => {
    if (!searchQuery) return captionItems;
    const q = searchQuery.toLowerCase();
    return captionItems.filter((item) => {
      const data = item.data as CaptionItemData;
      return data.text.toLowerCase().includes(q);
    });
  }, [captionItems, searchQuery]);

  // Find active caption
  const activeCaptionId = React.useMemo(() => {
    for (const item of captionItems) {
      if (currentTimeMs >= item.startMs && currentTimeMs < item.endMs) {
        return item.id;
      }
    }
    return null;
  }, [captionItems, currentTimeMs]);

  // Auto-follow scroll
  useEffect(() => {
    if (isFollowing && activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeCaptionId, isFollowing]);

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

  const handleSeek = useCallback(
    (timeMs: number) => {
      seek(timeMs);
    },
    [seek]
  );

  const handleSelect = useCallback(
    (id: string) => {
      select([id], 'replace');
    },
    [select]
  );

  return (
    <div className="flex flex-col h-full bg-[var(--editor-bg-surface)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--editor-border-subtle)]">
        <div className="flex items-center gap-2">
          <AlignLeft size={14} className="text-[var(--editor-text-muted)]" />
          <span className="text-xs font-medium text-[var(--editor-text-secondary)]">
            Transcript
          </span>
          <span className="text-[10px] text-[var(--editor-text-muted)]">
            {captionItems.length}
          </span>
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
            onClick={() => setShowSearch(!showSearch)}
            className="p-1 rounded hover:bg-[var(--editor-bg-hover)] text-[var(--editor-text-muted)]"
            title="Search transcript"
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

      {/* Current scene indicator */}
      {showScenes && currentScene && (
        <div className="px-3 py-1.5 bg-[var(--editor-accent)]/5 border-b border-[var(--editor-border-subtle)]">
          <span className="text-[10px] font-medium text-[var(--editor-accent)]">
            Scene {currentScene.id}
          </span>
        </div>
      )}

      {/* Search bar */}
      {showSearch && (
        <div className="px-3 py-2 border-b border-[var(--editor-border-subtle)]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transcript..."
            className="w-full px-2 py-1 text-xs bg-[var(--editor-bg-base)] border border-[var(--editor-border-default)]
                       rounded text-[var(--editor-text-primary)] placeholder:text-[var(--editor-text-muted)]
                       focus:outline-none focus:border-[var(--editor-accent)]"
            autoFocus
          />
        </div>
      )}

      {/* Caption list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {filteredCaptions.length === 0 ? (
          <div className="p-4 text-center text-xs text-[var(--editor-text-muted)]">
            {searchQuery ? 'No matches found' : 'No captions yet'}
          </div>
        ) : (
          filteredCaptions.map((item, index) => {
            const data = item.data as CaptionItemData;
            const isActive = item.id === activeCaptionId;
            const isEditing = item.id === editingId;

            // Check if this caption starts a new scene
            const captionScene = showScenes ? getSceneForCaption(item.startMs) : null;
            const prevItem = index > 0 ? filteredCaptions[index - 1] : null;
            const prevScene = prevItem && showScenes ? getSceneForCaption(prevItem.startMs) : null;
            const isNewScene = captionScene && (!prevScene || prevScene.id !== captionScene.id);

            return (
              <React.Fragment key={item.id}>
                {/* Scene header when entering a new scene - clickable to select for AI editing */}
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
                    <span className={`text-[10px] font-medium ${selectedSceneId === captionScene.id ? 'text-[var(--editor-accent)]' : 'text-[var(--editor-text-secondary)]'}`}>
                      Scene {captionScene.id}
                    </span>
                    <span className="text-[10px] text-[var(--editor-text-muted)] font-mono">
                      {formatTime(captionScene.startMs)}
                    </span>
                  </button>
                )}

                <div
                  ref={isActive ? activeRef : undefined}
                  className={`group flex items-start gap-2 px-3 py-2 border-b border-[var(--editor-border-subtle)]
                             cursor-pointer transition-colors hover:bg-[var(--editor-bg-hover)]/50
                             ${isActive ? 'border-l-2 border-l-[var(--editor-accent)] bg-[var(--editor-accent)]/5' : 'border-l-2 border-l-transparent'}`}
                  onClick={() => { handleSelect(item.id); handleSeek(item.startMs); }}
                >
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
                    />
                  ) : (
                    <div
                      className={`text-xs leading-relaxed flex flex-wrap gap-0.5 ${
                        isActive
                          ? 'text-[var(--editor-text-primary)]'
                          : 'text-[var(--editor-text-secondary)]'
                      }`}
                      onDoubleClick={() => handleStartEdit(item)}
                    >
                      {data.words && data.words.length > 0 ? (
                        data.words.map((word, wi) => {
                          const absoluteStart = item.startMs + word.startMs;
                          const absoluteEnd = item.startMs + word.endMs;
                          const isActiveWord = isActive && currentTimeMs >= absoluteStart && currentTimeMs < absoluteEnd;
                          const hasOverrides = word.styleOverrides && Object.keys(word.styleOverrides).length > 0;
                          const isSelected = selectedWord?.captionId === item.id && selectedWord?.wordIndex === wi;

                          return (
                            <span
                              key={wi}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSeek(absoluteStart);
                                handleSelect(item.id);
                                setSelectedWord({ captionId: item.id, wordIndex: wi });
                              }}
                              className={`cursor-pointer rounded px-0.5 transition-colors ${
                                isActiveWord
                                  ? 'text-[var(--editor-accent)] font-semibold'
                                  : ''
                              } ${
                                hasOverrides ? 'underline decoration-dotted underline-offset-2' : ''
                              } ${
                                isSelected
                                  ? 'bg-[var(--editor-accent)]/20 ring-1 ring-[var(--editor-accent)]'
                                  : 'hover:bg-[var(--editor-bg-hover)]'
                              }`}
                            >
                              {word.text}
                            </span>
                          );
                        })
                      ) : (
                        <span>{data.text}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Timestamp */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSeek(item.startMs);
                  }}
                  className="flex-shrink-0 text-[10px] text-[var(--editor-text-muted)] hover:text-[var(--editor-accent)]
                             font-mono tabular-nums transition-colors"
                >
                  {formatTime(item.startMs)}
                </button>
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
    </div>
  );
}
