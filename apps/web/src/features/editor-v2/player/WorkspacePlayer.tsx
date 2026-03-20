'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Player, type RenderLoading } from '@remotion/player';
import { AbsoluteFill, prefetch } from 'remotion';
import { preloadVideo, preloadAudio } from '@remotion/preload';
import { useWorkspaceComposition, resolvePublicBase } from './useWorkspaceComposition';

interface WorkspacePlayerProps {
  manifest: Record<string, unknown>;
  bundleUrl: string | null;
  bundleVersion: number;
  compositionWidth: number;
  compositionHeight: number;
  durationMs: number;
  fps: number;
  playerRef?: React.Ref<any>;
  className?: string;
}

export const WorkspacePlayer = React.memo(function WorkspacePlayer({
  manifest,
  bundleUrl,
  bundleVersion,
  compositionWidth,
  compositionHeight,
  durationMs,
  fps,
  playerRef,
  className,
}: WorkspacePlayerProps) {
  const { Component, loading, error } = useWorkspaceComposition(bundleUrl, bundleVersion);

  const durationInFrames = Math.max(1, Math.round((durationMs / 1000) * fps));

  // -----------------------------------------------------------------------
  // Blob-based media prefetch
  //
  // Fetch every video/audio src exactly once into a blob URL.
  // Remotion intercepts matching URLs and serves from blob — zero network
  // during playback, instant seeks, no proxy latency after initial load.
  //
  // The URL passed to prefetch() MUST match what customStaticFile() returns
  // in useWorkspaceComposition, which is: `${publicBase}/${cleanPath}`
  // -----------------------------------------------------------------------
  const prefetchHandlesRef = useRef<Map<string, { free: () => void }>>(new Map());
  const preloadHandlesRef = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    const m = manifest as any;
    if (!m?.items || !bundleUrl) return;

    const publicBase = resolvePublicBase(bundleUrl);

    // Collect media URLs with their types
    const currentMedia = new Map<string, 'video' | 'audio'>();
    for (const item of m.items) {
      if ((item.type === 'video' || item.type === 'audio') && item.data?.src) {
        const src = item.data.src as string;
        let resolved: string;
        if (/^https?:\/\/|^blob:/.test(src)) {
          resolved = src;
        } else {
          const cleanPath = src.startsWith('/') ? src.slice(1) : src;
          resolved = `${publicBase}/${cleanPath}`;
        }
        currentMedia.set(resolved, item.type as 'video' | 'audio');
      }
    }

    // Step 1: prefetch() — download as blob URL (guaranteed in-memory)
    // Step 2: preloadVideo/Audio() — create hidden <video>/<audio> element
    //         that pre-parses the container and warms the decoder
    for (const [url, type] of currentMedia) {
      if (!prefetchHandlesRef.current.has(url)) {
        console.log('[WorkspacePlayer] prefetching:', url);
        const handle = prefetch(url, {
          method: 'blob-url',
          credentials: url.startsWith('/') ? 'include' : 'omit',
        });
        handle.waitUntilDone().then(() => {
          console.log('[WorkspacePlayer] prefetch ready:', url);
          // After blob is cached, preload to warm the decoder.
          // Remotion intercepts this URL and uses the blob, so the hidden
          // <video>/<audio> element decodes from memory — no extra fetch.
          if (!preloadHandlesRef.current.has(url)) {
            const freePreload = type === 'video' ? preloadVideo(url) : preloadAudio(url);
            preloadHandlesRef.current.set(url, freePreload);
          }
        }).catch((err) => {
          console.warn('[WorkspacePlayer] prefetch failed:', url, err);
        });
        prefetchHandlesRef.current.set(url, handle);
      }
    }

    // Free sources no longer in the manifest
    const currentUrls = new Set(currentMedia.keys());
    for (const [url, handle] of prefetchHandlesRef.current) {
      if (!currentUrls.has(url)) {
        handle.free();
        prefetchHandlesRef.current.delete(url);
        preloadHandlesRef.current.get(url)?.();
        preloadHandlesRef.current.delete(url);
      }
    }
  }, [manifest, bundleUrl]);

  // Cleanup all prefetches and preloads on unmount
  useEffect(() => {
    return () => {
      for (const [, handle] of prefetchHandlesRef.current) {
        handle.free();
      }
      prefetchHandlesRef.current.clear();
      for (const [, free] of preloadHandlesRef.current) {
        free();
      }
      preloadHandlesRef.current.clear();
    };
  }, []);

  // Buffering indicator
  const renderLoading: RenderLoading = useCallback(() => {
    return (
      <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 6,
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              border: '2px solid #a855f7',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <span style={{ color: '#94a3b8', fontSize: 11 }}>Buffering...</span>
        </div>
      </AbsoluteFill>
    );
  }, []);

  const inputProps = useMemo(() => {
    // Strip sandbox assets map so resolveMediaSrc always falls through to
    // staticFile(), returning the same proxy URL that prefetch() cached as blob.
    const m = manifest as any;
    if (m?.assets) {
      const { assets: _a, ...rest } = m;
      return { manifest: { ...rest, assets: {} } };
    }
    return { manifest };
  }, [manifest]);

  if (loading || (!Component && !error)) {
    return (
      <AbsoluteFill>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            backgroundColor: '#0f172a',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                border: '2px solid #a855f7',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <span style={{ color: '#94a3b8', fontSize: 14 }}>Loading composition...</span>
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  if (error) {
    return (
      <AbsoluteFill>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            backgroundColor: '#1a0a0a',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: 16,
            }}
          >
            <span style={{ color: '#f87171', fontSize: 14, textAlign: 'center' }}>{error}</span>
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <Player
      ref={playerRef}
      component={Component!}
      inputProps={inputProps}
      durationInFrames={durationInFrames}
      compositionWidth={compositionWidth}
      compositionHeight={compositionHeight}
      fps={fps}
      className={className}
      style={{ width: '100%', height: '100%' }}
      renderLoading={renderLoading}
      controls={false}
      loop={false}
      clickToPlay={false}
      acknowledgeRemotionLicense
      numberOfSharedAudioTags={5}
      bufferStateDelayInMilliseconds={300}
    />
  );
});
