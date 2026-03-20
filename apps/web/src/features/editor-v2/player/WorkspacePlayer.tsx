'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Player, type RenderLoading } from '@remotion/player';
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
    if (assets && typeof assets === 'object') {
      // Pass through browser-accessible presigned URLs (https://).
      // Filter out Docker-internal URLs (host.docker.internal, *.railway.internal)
      // which aren't reachable from the browser.
      const browserSafe: Record<string, string> = {};
      for (const [key, url] of Object.entries(assets)) {
        if (typeof url === 'string' && url.startsWith('https://')) {
          browserSafe[key] = url;
        }
      }
      setAssetsMap(browserSafe);
    }
  }, [manifest]);

  // Prefetch video sources as blob URLs so <Video> re-mounts at cut boundaries
  // don't trigger network requests — the blob is already in memory.
  // IMPORTANT: Must match the proxy URL that customStaticFile in
  // useWorkspaceComposition resolves to, otherwise the blob URL won't be
  // intercepted by Remotion's prefetch mechanism.
  const prefetchHandlesRef = useRef<Map<string, { free: () => void }>>(new Map());

  useEffect(() => {
    const m = manifest as any;
    if (!m?.items || !bundleUrl) return;

    // Resolve video source URLs the same way the composition's staticFile shim does
    const projectIdMatch = bundleUrl.match(/\/projects\/([^/]+)\/(workspace|sandbox)\//);
    const publicBase = projectIdMatch
      ? `/api/projects/${projectIdMatch[1]}/${projectIdMatch[2]}/public`
      : `${bundleUrl}/public`;

    // Proxy key derivation — must match useWorkspaceComposition's customStaticFile
    const PROXY_EXTENSIONS: Record<string, string> = {
      '.mp4': '-proxy.mp4',
      '.webm': '-proxy.mp4',
      '.png': '-proxy.webp',
      '.jpg': '-proxy.webp',
      '.jpeg': '-proxy.webp',
      '.webp': '-proxy.webp',
      '.aac': '-proxy.aac',
      '.mp3': '-proxy.aac',
      '.wav': '-proxy.aac',
      '.m4a': '-proxy.aac',
    };

    // Check which assets have presigned S3 URLs (browser-safe)
    const browserAssets: Record<string, string> = {};
    if (m.assets && typeof m.assets === 'object') {
      for (const [key, url] of Object.entries(m.assets)) {
        if (typeof url === 'string' && url.startsWith('https://')) {
          browserAssets[key] = url;
        }
      }
    }

    const currentSrcs = new Set<string>();
    for (const item of m.items) {
      if ((item.type === 'video' || item.type === 'audio') && item.data?.src) {
        const src = item.data.src as string;
        if (/^https?:\/\/|^blob:/.test(src)) {
          currentSrcs.add(src);
        } else {
          const cleanPath = src.startsWith('/') ? src.slice(1) : src;

          // If this asset has a presigned S3 URL, prefetch that (direct, no proxy)
          if (browserAssets[cleanPath]) {
            currentSrcs.add(browserAssets[cleanPath]);
            continue;
          }

          // Otherwise use the API proxy URL — only prefetch the proxy variant
          // (what the composition will actually request), not both proxy + original
          const ext = cleanPath.match(/\.\w+$/)?.[0]?.toLowerCase();
          const proxyKey = ext && PROXY_EXTENSIONS[ext] && !cleanPath.includes('-proxy.')
            ? cleanPath.replace(/\.\w+$/, PROXY_EXTENSIONS[ext])
            : null;
          currentSrcs.add(`${publicBase}/${proxyKey ?? cleanPath}`);
        }
      }
    }

    // Prefetch new sources — use blob-url for proxy/API URLs (same-origin),
    // uncached fetch for presigned S3 URLs (cross-origin, blob would CORS-fail)
    for (const url of currentSrcs) {
      if (!prefetchHandlesRef.current.has(url)) {
        const method = url.startsWith('/') ? 'blob-url' : 'blob-url';
        const handle = prefetch(url, {
          method,
          credentials: url.startsWith('/') ? 'include' : 'omit',
        });
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

  // Show a subtle loading indicator when the Player is paused due to buffering
  // (triggered by pauseWhenBuffering on <Video>/<Audio> components)
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
