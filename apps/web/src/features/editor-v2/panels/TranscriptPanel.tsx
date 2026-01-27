'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AlignLeft, Search, LocateFixed, LocateOff } from 'lucide-react';
import {
  useCaptionItems,
  useCurrentTimeMs,
  useEditorActions,
} from '../store/use-editor-store';
import { CaptionItemData, TimelineItem } from '../store/types';

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  const captionItems = useCaptionItems();
  const currentTimeMs = useCurrentTimeMs();
  const { seek, updateItemData, select } = useEditorActions();

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
      updateItemData(editingId, { text: editText.trim() });
    }
    setEditingId(null);
    setEditText('');
  }, [editingId, editText, updateItemData]);

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
          filteredCaptions.map((item) => {
            const data = item.data as CaptionItemData;
            const isActive = item.id === activeCaptionId;
            const isEditing = item.id === editingId;

            return (
              <div
                key={item.id}
                ref={isActive ? activeRef : undefined}
                className={`group flex items-start gap-2 px-3 py-2 border-b border-[var(--editor-border-subtle)]
                           cursor-pointer transition-colors hover:bg-[var(--editor-bg-hover)]/50
                           ${isActive ? 'border-l-2 border-l-[var(--editor-accent)] bg-[var(--editor-accent)]/5' : 'border-l-2 border-l-transparent'}`}
                onClick={() => handleSelect(item.id)}
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
                    <p
                      className={`text-xs leading-relaxed ${
                        isActive
                          ? 'text-[var(--editor-text-primary)]'
                          : 'text-[var(--editor-text-secondary)]'
                      }`}
                      onDoubleClick={() => handleStartEdit(item)}
                    >
                      {data.text}
                    </p>
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
            );
          })
        )}
      </div>
    </div>
  );
}
