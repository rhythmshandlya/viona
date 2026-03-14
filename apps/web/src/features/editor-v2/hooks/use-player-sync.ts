/**
 * Player Sync Hook
 * Handles two-way synchronization between editor store and Remotion player
 */

'use client';

import React, { useEffect, useRef } from 'react';
import { PlayerRef, CallbackListener } from '@remotion/player';
import {
  useCurrentTimeMs,
  useIsPlaying,
  useFps,
  useDuration,
  usePlaybackActions,
} from '../store/use-editor-store';

interface UsePlayerSyncOptions {
  playerRef: React.RefObject<PlayerRef>;
}

export function usePlayerSync({ playerRef }: UsePlayerSyncOptions) {
  const currentTimeMs = useCurrentTimeMs();
  const isPlaying = useIsPlaying();
  const fps = useFps();
  const duration = useDuration();
  const { setCurrentTime, play, pause } = usePlaybackActions();

  // Track if we're updating from player events to avoid loops
  const isPlayerUpdate = useRef(false);
  const lastSyncedFrame = useRef(-1);

  // Sync playback state to player
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    if (isPlaying) {
      player.play();
    } else {
      player.pause();
    }
  }, [isPlaying, playerRef]);

  // Sync time to player (when not playing)
  useEffect(() => {
    const player = playerRef.current;
    if (!player || isPlaying || isPlayerUpdate.current) return;

    const frame = Math.round((currentTimeMs / 1000) * fps);
    if (frame !== lastSyncedFrame.current) {
      player.seekTo(frame);
      lastSyncedFrame.current = frame;
    }
  }, [currentTimeMs, fps, isPlaying, playerRef]);

  // Listen to player events
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const handleTimeUpdate: CallbackListener<'frameupdate'> = (data) => {
      const frame = data.detail.frame;
      const timeMs = (frame / fps) * 1000;

      // Avoid update loops
      isPlayerUpdate.current = true;
      setCurrentTime(timeMs);
      lastSyncedFrame.current = frame;

      requestAnimationFrame(() => {
        isPlayerUpdate.current = false;
      });
    };

    const handlePlay: CallbackListener<'play'> = () => {
      if (!isPlaying) {
        play();
      }
    };

    const handlePause: CallbackListener<'pause'> = () => {
      if (isPlaying) {
        pause();
      }
    };

    const handleEnded: CallbackListener<'ended'> = () => {
      pause();
    };

    player.addEventListener('frameupdate', handleTimeUpdate);
    player.addEventListener('play', handlePlay);
    player.addEventListener('pause', handlePause);
    player.addEventListener('ended', handleEnded);

    return () => {
      player.removeEventListener('frameupdate', handleTimeUpdate);
      player.removeEventListener('play', handlePlay);
      player.removeEventListener('pause', handlePause);
      player.removeEventListener('ended', handleEnded);
    };
  }, [fps, isPlaying, setCurrentTime, play, pause, playerRef]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying) return;

    let animationFrameId: number;
    const startTime = performance.now();
    const startMs = currentTimeMs;

    const tick = () => {
      const elapsed = performance.now() - startTime;
      const newTimeMs = Math.min(startMs + elapsed, duration);

      if (newTimeMs >= duration) {
        pause();
        setCurrentTime(0);
        return;
      }

      if (!isPlayerUpdate.current) {
        setCurrentTime(newTimeMs);
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, duration, pause, setCurrentTime]);

  return {
    currentTimeMs,
    isPlaying,
    fps,
    duration,
  };
}
