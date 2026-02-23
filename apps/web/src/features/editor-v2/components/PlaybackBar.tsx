/**
 * PlaybackBar Component
 * Slim playback controls bar between preview and timeline
 */

'use client';

import { useCallback, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Subtitles, MousePointerClick } from 'lucide-react';
import {
  useCurrentTimeMs,
  useIsPlaying,
  useDuration,
  useEditorActions,
  useShowCaptions,
  useInspectModeEnabled,
} from '../store/use-editor-store';
import { sharedPlayerRef } from '../player/player-ref';

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
  const { togglePlayback, seek, setShowCaptions, setInspectModeEnabled, pause } = useEditorActions();
  const showCaptions = useShowCaptions();
  const inspectModeEnabled = useInspectModeEnabled();
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
    <div className="h-12 flex items-center justify-center gap-4 px-6 bg-[var(--editor-bg-surface)] border-t border-[var(--editor-border-subtle)]">
      {/* Time display - left */}
      <span className="text-sm font-mono text-[var(--editor-text-secondary)] w-20 text-right tabular-nums" style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}>
        {formatTime(currentTimeMs)}
      </span>

      {/* Scrubber - increased hit area */}
      <div
        ref={scrubberRef}
        onClick={handleScrubberClick}
        onMouseMove={handleScrubberDrag}
        className="flex-1 max-w-lg h-6 flex items-center cursor-pointer group"
      >
        <div className="w-full h-1.5 bg-[var(--editor-border-subtle)] rounded-full relative">
          <div
            className="h-full bg-[var(--editor-accent)] rounded-full relative transition-all"
            style={{ width: `${progress}%` }}
          >
            {/* Scrubber handle */}
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2
                         w-3.5 h-3.5 bg-white border-2 border-[var(--editor-accent)] rounded-full
                         shadow-md transition-transform group-hover:scale-125"
              style={{ boxShadow: 'var(--editor-shadow-sm), 0 0 0 2px var(--editor-accent-soft)' }}
            />
          </div>
        </div>
      </div>

      {/* Time display - right */}
      <span className="text-sm font-mono text-[var(--editor-text-muted)] w-20 tabular-nums" style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}>
        {formatTime(duration)}
      </span>

      {/* Play controls */}
      <div className="flex items-center gap-2 ml-4">
        <button
          onClick={handleSkipBack}
          className="p-2 rounded-md hover:bg-[var(--editor-bg-hover)] active:scale-[0.97] transition-all"
          aria-label="Skip to start"
        >
          <SkipBack className="w-4 h-4 text-[var(--editor-text-secondary)]" />
        </button>

        <button
          onClickCapture={(e) => {
            const player = sharedPlayerRef.current;
            if (player) {
              if (isPlaying) {
                player.pause();
              } else {
                player.play(e);
              }
            }
            togglePlayback();
          }}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-[var(--editor-accent)] text-white
                     hover:bg-[var(--editor-accent-hover)] active:scale-95 transition-all shadow-sm"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-4.5 h-4.5" />
          ) : (
            <Play className="w-4.5 h-4.5 ml-0.5" />
          )}
        </button>

        <button
          onClick={handleSkipForward}
          className="p-2 rounded-md hover:bg-[var(--editor-bg-hover)] active:scale-[0.97] transition-all"
          aria-label="Skip to end"
        >
          <SkipForward className="w-4 h-4 text-[var(--editor-text-secondary)]" />
        </button>

        <div className="w-px h-5 bg-[var(--editor-border-subtle)] mx-1" />

        <button
          onClick={() => setShowCaptions(!showCaptions)}
          className={`p-2 rounded-md active:scale-[0.97] transition-all ${
            showCaptions
              ? 'text-[var(--editor-accent)] bg-[var(--editor-accent-muted)]'
              : 'text-[var(--editor-text-muted)] hover:bg-[var(--editor-bg-hover)]'
          }`}
          aria-label={showCaptions ? 'Hide captions' : 'Show captions'}
          title={showCaptions ? 'Hide captions' : 'Show captions'}
        >
          <Subtitles className="w-4 h-4" />
        </button>

        <button
          onClick={() => {
            const next = !inspectModeEnabled;
            setInspectModeEnabled(next);
            if (next && isPlaying) pause();
          }}
          className={`p-2 rounded-md active:scale-[0.97] transition-all ${
            inspectModeEnabled
              ? 'text-[var(--editor-accent)] bg-[var(--editor-accent-muted)]'
              : 'text-[var(--editor-text-muted)] hover:bg-[var(--editor-bg-hover)]'
          }`}
          aria-label={inspectModeEnabled ? 'Exit inspect mode' : 'Inspect elements (I)'}
          title={inspectModeEnabled ? 'Exit inspect mode' : 'Inspect elements (I)'}
        >
          <MousePointerClick className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
