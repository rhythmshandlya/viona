/**
 * PlaybackBar Component
 * Slim playback controls bar between preview and timeline
 */

'use client';

import { useCallback, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import {
  useCurrentTimeMs,
  useIsPlaying,
  useDuration,
  useEditorActions,
} from '../store/use-editor-store';

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

export function PlaybackBar() {
  const currentTimeMs = useCurrentTimeMs();
  const isPlaying = useIsPlaying();
  const duration = useDuration();
  const { togglePlayback, seek } = useEditorActions();
  const scrubberRef = useRef<HTMLDivElement>(null);

  const progress = duration > 0 ? (currentTimeMs / duration) * 100 : 0;

  const handleScrubberClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!scrubberRef.current || duration === 0) return;

      const rect = scrubberRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const newTime = percentage * duration;
      seek(newTime);
    },
    [duration, seek]
  );

  const handleScrubberDrag = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.buttons !== 1) return; // Only on left mouse button
      handleScrubberClick(e);
    },
    [handleScrubberClick]
  );

  const handleSkipBack = () => {
    seek(0);
  };

  const handleSkipForward = () => {
    seek(duration);
  };

  return (
    <div className="h-10 flex items-center gap-3 px-4 border-b border-[var(--editor-border-subtle)] bg-[var(--editor-bg-surface)]">
      {/* Play controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleSkipBack}
          className="p-1.5 rounded hover:bg-[var(--editor-bg-hover)] transition-colors"
          aria-label="Skip to start"
        >
          <SkipBack className="w-3.5 h-3.5 text-[var(--editor-text-secondary)]" />
        </button>

        <button
          onClick={togglePlayback}
          className="p-2 rounded-md hover:bg-[var(--editor-bg-hover)] transition-colors"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 text-[var(--editor-text-primary)]" />
          ) : (
            <Play className="w-4 h-4 text-[var(--editor-text-primary)]" />
          )}
        </button>

        <button
          onClick={handleSkipForward}
          className="p-1.5 rounded hover:bg-[var(--editor-bg-hover)] transition-colors"
          aria-label="Skip to end"
        >
          <SkipForward className="w-3.5 h-3.5 text-[var(--editor-text-secondary)]" />
        </button>
      </div>

      {/* Time display */}
      <div className="flex items-center gap-1.5 text-xs font-mono">
        <span className="text-[var(--editor-text-primary)]">{formatTime(currentTimeMs)}</span>
        <span className="text-[var(--editor-text-muted)]">/</span>
        <span className="text-[var(--editor-text-muted)]">{formatTime(duration)}</span>
      </div>

      {/* Scrubber */}
      <div
        ref={scrubberRef}
        onClick={handleScrubberClick}
        onMouseMove={handleScrubberDrag}
        className="flex-1 h-1.5 bg-[var(--editor-bg-hover)] rounded-full cursor-pointer group"
      >
        <div
          className="h-full bg-[var(--editor-accent)] rounded-full relative transition-all"
          style={{ width: `${progress}%` }}
        >
          {/* Scrubber handle */}
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2
                       w-3 h-3 bg-[var(--editor-accent)] rounded-full
                       opacity-0 group-hover:opacity-100 transition-opacity
                       shadow-md"
          />
        </div>
      </div>
    </div>
  );
}
