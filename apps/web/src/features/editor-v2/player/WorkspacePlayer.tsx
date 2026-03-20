'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Player } from '@remotion/player';
import { AbsoluteFill, prefetch } from 'remotion';
import { useWorkspaceComposition, setAssetsMap } from './useWorkspaceComposition';

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

  useEffect(() => {
    const assets = (manifest as any)?.assets;
    if (assets) {
      // Don't pass sandbox's Docker-internal presigned URLs to the browser.
      // customStaticFile in useWorkspaceComposition falls back to the API proxy
      // which works for all assets (video, images, etc).
      setAssetsMap({});
    }
  }, [manifest]);

  // Prefetch video sources as blob URLs so <Video> re-mounts at cut boundaries
  // don't trigger network requests — the blob is already in memory.
  const prefetchHandlesRef = useRef<Map<string, { free: () => void }>>(new Map());

  useEffect(() => {
    const m = manifest as any;
    if (!m?.items || !bundleUrl) return;

    // Resolve video source URLs the same way the composition's staticFile shim does
    const projectIdMatch = bundleUrl.match(/\/projects\/([^/]+)\/(workspace|sandbox)\//);
    const publicBase = projectIdMatch
      ? `/api/projects/${projectIdMatch[1]}/${projectIdMatch[2]}/public`
      : `${bundleUrl}/public`;

    const currentSrcs = new Set<string>();
    for (const item of m.items) {
      if ((item.type === 'video' || item.type === 'audio') && item.data?.src) {
        const src = item.data.src as string;
        const resolved = /^https?:\/\/|^blob:/.test(src)
          ? src
          : `${publicBase}/${src.startsWith('/') ? src.slice(1) : src}`;
        currentSrcs.add(resolved);
      }
    }

    // Prefetch new sources
    for (const url of currentSrcs) {
      if (!prefetchHandlesRef.current.has(url)) {
        const handle = prefetch(url, { method: 'blob-url', credentials: 'include' });
        prefetchHandlesRef.current.set(url, handle);
      }
    }

    // Free sources no longer in the manifest
    for (const [url, handle] of prefetchHandlesRef.current) {
      if (!currentSrcs.has(url)) {
        handle.free();
        prefetchHandlesRef.current.delete(url);
      }
    }
  }, [manifest, bundleUrl]);

  // Cleanup all prefetches on unmount
  useEffect(() => {
    return () => {
      for (const [, handle] of prefetchHandlesRef.current) {
        handle.free();
      }
      prefetchHandlesRef.current.clear();
    };
  }, []);

  const inputProps = useMemo(() => {
    // Strip sandbox assets map — composition will use staticFile fallback
    // which resolves to the API proxy URL (browser-accessible)
    const m = manifest as any;
    if (m?.assets) {
      return { manifest: { ...m, assets: {} } };
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
      controls={false}
      loop={false}
      clickToPlay={false}
      acknowledgeRemotionLicense
    />
  );
});
