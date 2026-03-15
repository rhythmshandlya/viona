/**
 * PreviewControls Component
 * Cardboard-style two-row controls inside the preview box.
 * Row 1: Zoom slider + play/skip + volume + fullscreen
 * Row 2: Tool buttons + time display + undo/redo + expand
 */

'use client';

import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Subtitles,
  MousePointerClick,
  Scissors,
  Trash2,
  Shuffle,
  Maximize,
  Undo2,
  Redo2,
} from 'lucide-react';
import {
  useCurrentTimeMs,
  useIsPlaying,
  useDuration,
  useEditorActions,
  useShowCaptions,
  useInspectModeEnabled,
  useSplitMode,
} from '../store/use-editor-store';
import { sharedPlayerRef } from '../player/player-ref';

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

const BTN = "p-2 rounded-[10px] glass-btn text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)]";
const BTN_ACTIVE = "p-2 rounded-[10px] glass-btn active";

export function PreviewControls() {
  const currentTimeMs = useCurrentTimeMs();
  const isPlaying = useIsPlaying();
  const duration = useDuration();
  const { togglePlayback, seek, setShowCaptions, setInspectModeEnabled, pause, splitAllAtPlayhead } = useEditorActions();
  const showCaptions = useShowCaptions();
  const inspectModeEnabled = useInspectModeEnabled();
  const splitMode = useSplitMode();
  return (
    <div className="flex flex-col flex-shrink-0">
      {/* Row 1: Play controls + Volume/Fullscreen */}
      <div className="h-10 flex items-center justify-center gap-6 px-3">
        {/* Play controls — centered */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => seek(Math.max(0, currentTimeMs - 5000))}
            className={BTN}
            aria-label="Rewind 5s"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClickCapture={(e) => {
              const player = sharedPlayerRef.current;
              if (player) {
                if (isPlaying) { player.pause(); } else { player.play(e); }
              }
              togglePlayback();
            }}
            className="w-9 h-9 flex items-center justify-center rounded-full
                       bg-white/90 text-black backdrop-blur-sm
                       hover:bg-white active:scale-95 transition-all mx-1
                       shadow-[0_2px_12px_rgba(255,255,255,0.15),inset_0_1px_0_rgba(255,255,255,0.3)]"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" />
            )}
          </button>

          <button
            onClick={() => seek(Math.min(duration, currentTimeMs + 5000))}
            className={BTN}
            aria-label="Forward 5s"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Row 2: Tools + Time + Undo/Redo */}
      <div className="h-9 flex items-center justify-between px-3 border-t border-white/[0.04]">
        {/* Left: tool buttons */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => {
              const next = !inspectModeEnabled;
              setInspectModeEnabled(next);
              if (next && isPlaying) pause();
            }}
            className={inspectModeEnabled ? BTN_ACTIVE : BTN}
            title="Select / Inspect (I)"
          >
            <MousePointerClick className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => splitAllAtPlayhead()}
            className={splitMode ? BTN_ACTIVE : BTN}
            title="Split at Playhead (S)"
          >
            <Scissors className="w-3.5 h-3.5" />
          </button>
          <button className={BTN} title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowCaptions(!showCaptions)}
            className={showCaptions ? BTN_ACTIVE : BTN}
            title={showCaptions ? 'Hide captions' : 'Show captions'}
          >
            <Subtitles className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: time display */}
        <div className="flex items-center gap-1.5" style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}>
          <span className="text-xs font-mono text-[var(--editor-text-primary)]">
            {formatTime(currentTimeMs)}
          </span>
          <span className="text-xs text-[var(--editor-text-muted)]">/</span>
          <span className="text-xs font-mono text-[var(--editor-text-muted)]">
            {formatTime(duration)}
          </span>
        </div>

        {/* Right: undo/redo + expand */}
        <div className="flex items-center gap-0.5">
          <button className={BTN} title="Undo (⌘Z)">
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button className={BTN} title="Redo (⌘⇧Z)">
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <button className={BTN} title="Expand">
            <Maximize className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
