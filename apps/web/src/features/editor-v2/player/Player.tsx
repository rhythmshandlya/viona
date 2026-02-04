/**
 * Player Component
 * Remotion player wrapper with two-way sync to editor store
 */

'use client';

import { useEffect, useRef } from 'react';
import { Player as RemotionPlayer, PlayerRef, CallbackListener } from '@remotion/player';
import { Composition } from './Composition';
import {
  useProject,
  useDuration,
  useFps,
  useCurrentTimeMs,
  useIsPlaying,
  useEditorActions,
} from '../store/use-editor-store';

interface PlayerProps {
  className?: string;
}

export function Player({ className }: PlayerProps) {
  const playerRef = useRef<PlayerRef>(null);
  const isInternalUpdate = useRef(false);

  // State
  const project = useProject();
  const duration = useDuration();
  const fps = useFps();
  const currentTimeMs = useCurrentTimeMs();
  const isPlaying = useIsPlaying();

  // Actions
  const { setCurrentTime, play, pause } = useEditorActions();

  // Sync playback state to Remotion player
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    if (isPlaying) {
      player.play();
    } else {
      player.pause();
    }
  }, [isPlaying]);

  // Sync current time to Remotion player (only when NOT playing)
  // During playback, the Remotion player drives its own clock via
  // frameupdate events — calling seekTo() on a playing player causes
  // micro-stutters that accumulate and stall playback after ~30 s.
  useEffect(() => {
    const player = playerRef.current;
    if (!player || isPlaying || isInternalUpdate.current) return;

    const frame = Math.round((currentTimeMs / 1000) * fps);
    player.seekTo(frame);
  }, [currentTimeMs, fps, isPlaying]);

  // Listen to Remotion player events
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const handleFrameChange: CallbackListener<'frameupdate'> = (data) => {
      const frame = data.detail.frame;
      const timeMs = (frame / fps) * 1000;

      isInternalUpdate.current = true;
      setCurrentTime(timeMs);

      // Reset flag after a short delay
      requestAnimationFrame(() => {
        isInternalUpdate.current = false;
      });
    };

    const handlePlay: CallbackListener<'play'> = () => {
      play();
    };

    const handlePause: CallbackListener<'pause'> = () => {
      pause();
    };

    const handleEnded: CallbackListener<'ended'> = () => {
      pause();
      setCurrentTime(0);
    };

    player.addEventListener('frameupdate', handleFrameChange);
    player.addEventListener('play', handlePlay);
    player.addEventListener('pause', handlePause);
    player.addEventListener('ended', handleEnded);

    return () => {
      player.removeEventListener('frameupdate', handleFrameChange);
      player.removeEventListener('play', handlePlay);
      player.removeEventListener('pause', handlePause);
      player.removeEventListener('ended', handleEnded);
    };
  }, [fps, setCurrentTime, play, pause]);

  if (!project) {
    return (
      <div className={`flex items-center justify-center bg-black ${className || ''}`}>
        <p className="text-zinc-500">No project loaded</p>
      </div>
    );
  }

  const durationInFrames = Math.max(1, Math.round((duration / 1000) * fps));

  // Use canvas dimensions from videoSettings (9:16 for reels)
  const compositionWidth = project.videoSettings?.canvasWidth || 1080;
  const compositionHeight = project.videoSettings?.canvasHeight || 1920;

  return (
    <RemotionPlayer
      ref={playerRef}
      component={Composition}
      durationInFrames={durationInFrames}
      compositionWidth={compositionWidth}
      compositionHeight={compositionHeight}
      fps={fps}
      className={`w-full h-full ${className || ''}`}
      style={{
        width: '100%',
        height: '100%',
      }}
      controls={false}
      loop={false}
      clickToPlay={false}
    />
  );
}
