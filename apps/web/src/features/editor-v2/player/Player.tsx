/**
 * Player Component
 * WorkspacePlayer wrapper with two-way sync to editor store
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { PlayerRef, CallbackListener } from '@remotion/player';
import { WorkspacePlayer } from './WorkspacePlayer';
import {
  useProject,
  useDuration,
  useFps,
  useIsPlaying,
  usePlaybackActions,
  useSafeZonePlatform,
  useWorkspaceManifest,
  useWorkspaceBundleUrl,
  useWorkspaceBundleVersion,
  useEditorStore,
} from '../store/use-editor-store';
import { SafeZoneOverlay } from '../components/SafeZoneOverlay';
import { sharedPlayerRef } from './player-ref';

interface PlayerProps {
  className?: string;
}

export function Player({ className }: PlayerProps) {
  const isInternalUpdate = useRef(false);
  // State counter that increments when the Remotion Player mounts/unmounts.
  // This forces the event-listener effects to re-run.
  const [playerInstance, setPlayerInstance] = useState<PlayerRef | null>(null);

  // Callback ref: updates sharedPlayerRef AND triggers a state change so
  // effects that depend on `playerInstance` re-run.
  const playerCallbackRef = useCallback((node: PlayerRef | null) => {
    sharedPlayerRef.current = node;
    setPlayerInstance(node);
  }, []);

  // State
  const project = useProject();
  const duration = useDuration();
  const fps = useFps();
  const isPlaying = useIsPlaying();
  const safeZonePlatform = useSafeZonePlatform();
  const manifest = useWorkspaceManifest();
  const bundleUrl = useWorkspaceBundleUrl();
  const bundleVersion = useWorkspaceBundleVersion();

  // Actions
  const { setCurrentTime, play, pause } = usePlaybackActions();
  const setCurrentTimeRef = useRef(setCurrentTime);
  const playRef = useRef(play);
  const pauseRef = useRef(pause);
  useEffect(() => { setCurrentTimeRef.current = setCurrentTime; }, [setCurrentTime]);
  useEffect(() => { playRef.current = play; }, [play]);
  useEffect(() => { pauseRef.current = pause; }, [pause]);

  // Sync store currentTimeMs → Remotion player (user drags timeline).
  // Uses a store subscription so frame updates don't trigger re-renders.
  useEffect(() => {
    if (!playerInstance) return;

    let prevTimeMs = useEditorStore.getState().currentTimeMs;
    const unsub = useEditorStore.subscribe((state) => {
      const timeMs = state.currentTimeMs;
      if (timeMs === prevTimeMs) return;
      prevTimeMs = timeMs;
      if (isInternalUpdate.current) return;
      const frame = Math.round((timeMs / 1000) * fps);
      playerInstance.seekTo(frame);
    });

    return unsub;
  }, [playerInstance, fps]);

  // Sync playback state to Remotion player
  useEffect(() => {
    if (!playerInstance) return;

    if (isPlaying) {
      playerInstance.play();
    } else {
      playerInstance.pause();
    }
  }, [isPlaying, playerInstance]);

  // Listen to Remotion player events
  useEffect(() => {
    if (!playerInstance) return;

    const handleFrameChange: CallbackListener<'frameupdate'> = (data) => {
      const frame = data.detail.frame;
      const timeMs = (frame / fps) * 1000;
      isInternalUpdate.current = true;
      // Direct setState with clamping — bypasses React subscription churn
      const { duration } = useEditorStore.getState();
      useEditorStore.setState({ currentTimeMs: Math.max(0, Math.min(timeMs, duration)) });
      requestAnimationFrame(() => {
        isInternalUpdate.current = false;
      });
    };

    const handlePlay: CallbackListener<'play'> = () => playRef.current();
    const handlePause: CallbackListener<'pause'> = () => pauseRef.current();
    const handleEnded: CallbackListener<'ended'> = () => {
      pauseRef.current();
    };

    playerInstance.addEventListener('frameupdate', handleFrameChange);
    playerInstance.addEventListener('play', handlePlay);
    playerInstance.addEventListener('pause', handlePause);
    playerInstance.addEventListener('ended', handleEnded);

    return () => {
      playerInstance.removeEventListener('frameupdate', handleFrameChange);
      playerInstance.removeEventListener('play', handlePlay);
      playerInstance.removeEventListener('pause', handlePause);
      playerInstance.removeEventListener('ended', handleEnded);
    };
  }, [playerInstance, fps]); // Only re-run when player or fps changes

  if (!project) {
    return (
      <div className={`flex items-center justify-center bg-black ${className || ''}`}>
        <p className="text-zinc-500">No project loaded</p>
      </div>
    );
  }

  // Use canvas dimensions from videoSettings (9:16 for reels)
  const compositionWidth = project.videoSettings?.canvasWidth || 1080;
  const compositionHeight = project.videoSettings?.canvasHeight || 1920;

  if (!manifest) {
    return (
      <div className={`relative w-full h-full ${className || ''}`}>
        <div className="flex items-center justify-center h-full bg-slate-950">
          <span className="text-slate-400 text-sm">Waiting for workspace...</span>
        </div>
        <SafeZoneOverlay platform={safeZonePlatform} />
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full ${className || ''}`}>
      <WorkspacePlayer
        manifest={manifest}
        bundleUrl={bundleUrl}
        bundleVersion={bundleVersion}
        compositionWidth={compositionWidth}
        compositionHeight={compositionHeight}
        durationMs={duration}
        fps={fps}
        playerRef={playerCallbackRef}
        className="w-full h-full"
      />
      <SafeZoneOverlay platform={safeZonePlatform} />
    </div>
  );
}
