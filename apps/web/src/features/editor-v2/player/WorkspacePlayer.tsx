'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Player, type RenderLoading } from '@remotion/player';
import { AbsoluteFill, prefetch } from 'remotion';
import { preloadVideo, preloadAudio } from '@remotion/preload';
import { useWorkspaceComposition, resolvePublicBase, resolveDirectMediaUrl } from './useWorkspaceComposition';

// Proxy key derivation (matches resolveMediaSrc.ts PROXY_EXTENSIONS)
const PROXY_SUFFIXES: Record<string, string> = {
  '.mp4': '-proxy.mp4', '.webm': '-proxy.mp4',
  '.aac': '-proxy.aac', '.mp3': '-proxy.aac', '.wav': '-proxy.aac', '.m4a': '-proxy.aac',
  '.png': '-proxy.webp', '.jpg': '-proxy.webp', '.jpeg': '-proxy.webp', '.webp': '-proxy.webp',
};

// Mirrors deriveProxyKey from packages/sandbox/template/src/items/resolveMediaSrc.ts
function deriveProxyKey(src: string): string | null {
  if (!src || src.includes('-proxy.')) return null;
  const ext = src.match(/\.\w+$/)?.[0]?.toLowerCase();
  if (!ext || !PROXY_SUFFIXES[ext]) return null;
  return src.replace(/\.\w+$/, PROXY_SUFFIXES[ext]);
}

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
  // Suppress Remotion's uncatchable video errors.
  //
  // Remotion's <Video> throws from a DOM event listener when the <video>
  // element fails to load — this cannot be caught by React error boundaries
  // or the onError prop (Remotion always throws when error details exist).
  // During sandbox init, media files may not be available yet, causing
  // transient errors. Suppress them so Next.js dev overlay doesn't block.
  // -----------------------------------------------------------------------
  useEffect(() => {
    const handler = (e: ErrorEvent) => {
      if (e.message?.includes('error while playing the video') ||
          e.message?.includes('cross-origin data') ||
          e.message?.includes('texImage2D')) {
        e.preventDefault();
        console.warn('[WorkspacePlayer] Suppressed video error:', e.message?.substring(0, 80));
      }
    };
    window.addEventListener('error', handler);
    return () => window.removeEventListener('error', handler);
  }, []);

  // -----------------------------------------------------------------------
  // Media loading strategy:
  //
  // - Video/Audio: use @remotion/preload (preloadVideo/preloadAudio).
  //   These add <link rel="preload"> hints so the browser starts loading
  //   the file in the background using native HTTP range requests. This
  //   does NOT download the full file or create blob URLs — the browser
  //   manages buffering naturally, which is critical for large source
  //   videos (100MB+). Blob URLs from prefetch() would compete with the
  //   <video> element's native streaming and don't support range requests,
  //   causing playback to stall after the initial buffer runs out.
  //
  // - Images: use prefetch() to download fully into blob URLs. Images are
  //   small and benefit from guaranteed instant availability.
  //
  // - Matte videos: use preloadVideo() since they're large video files.
  // -----------------------------------------------------------------------
  const preloadedRef = useRef<Set<string>>(new Set());
  const prefetchHandlesRef = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    const m = manifest as any;
    if (!m?.items || !bundleUrl) return;

    const publicBase = resolvePublicBase(bundleUrl);

    // Resolve media URLs exactly like customStaticFile() in useWorkspaceComposition
    // so that preload hints match the actual <video>/<audio> element src.
    // URL mismatch between preload and element causes browser to ignore preloaded data.
    const assets = (m as any)?.assets || {};
    const resolveMedia = (src: string) => {
      // Try proxy first for editor preview
      const proxyKey = deriveProxyKey(src);
      if (proxyKey && assets[proxyKey]) return assets[proxyKey];
      // For video/audio not in assets (e.g. matte files), use proxy path via same-origin
      if (proxyKey && /\.(mp4|webm|aac|mp3|wav|m4a)$/i.test(proxyKey) && !assets[src]) {
        const cleanProxy = proxyKey.startsWith('/') ? proxyKey.slice(1) : proxyKey;
        return `${publicBase}/${cleanProxy}`;
      }
      // Fall back to full-res
      if (assets[src]) return assets[src];
      if (/^https?:\/\/|^blob:/.test(src)) return src;
      if (src.startsWith('/api/')) return src;
      const cleanPath = src.startsWith('/') ? src.slice(1) : src;
      return `${publicBase}/${cleanPath}`;
    };

    // Collect media URLs by type
    const videoUrls = new Set<string>();
    const audioUrls = new Set<string>();
    const imageUrls = new Set<string>();

    for (const item of m.items) {
      if (item.type === 'video' && item.data?.src) {
        videoUrls.add(resolveMedia(item.data.src as string));
      }
      if (item.type === 'audio' && item.data?.src) {
        audioUrls.add(resolveMedia(item.data.src as string));
      }
      if (item.type === 'matte') {
        if (item.data?.fgrSrc) videoUrls.add(resolveMedia(item.data.fgrSrc as string));
        if (item.data?.matteSrc) videoUrls.add(resolveMedia(item.data.matteSrc as string));
      }
      if (item.type === 'image' && item.data?.src) {
        imageUrls.add(resolveMedia(item.data.src as string));
      }
    }

    // Prefetch proxy files into blob URLs for instant seek (small files, ~5MB total).
    // For full-res files (no proxy available), use preloadVideo/preloadAudio hints instead.
    // Remotion auto-swaps original URLs with blob URLs when prefetch is used.
    for (const url of videoUrls) {
      if (!prefetchHandlesRef.current.has(url) && !preloadedRef.current.has(url)) {
        if (url.includes('-proxy.') || url.includes('localhost:9000')) {
          // Small proxy/MinIO files: full prefetch into blob URL for instant seeking
          try {
            const { free } = prefetch(url);
            prefetchHandlesRef.current.set(url, free);
          } catch { /* ignore */ }
        } else {
          // Large files: just hint, let browser manage buffering
          try { preloadVideo(url); } catch { /* ignore */ }
          preloadedRef.current.add(url);
        }
      }
    }
    for (const url of audioUrls) {
      if (!prefetchHandlesRef.current.has(url) && !preloadedRef.current.has(url)) {
        if (url.includes('-proxy.') || url.includes('localhost:9000')) {
          try {
            const { free } = prefetch(url);
            prefetchHandlesRef.current.set(url, free);
          } catch { /* ignore */ }
        } else {
          try { preloadAudio(url); } catch { /* ignore */ }
          preloadedRef.current.add(url);
        }
      }
    }

    // Prefetch images into blob URLs (small files, instant availability)
    for (const url of imageUrls) {
      if (!prefetchHandlesRef.current.has(url)) {
        try {
          const { free, waitUntilDone } = prefetch(url);
          // Catch the async rejection so it doesn't surface as an unhandled
          // promise rejection (Remotion rejects waitUntilDone on HTTP errors).
          waitUntilDone().catch(() => {});
          prefetchHandlesRef.current.set(url, free);
        } catch { /* ignore */ }
      }
    }

    // Free prefetches no longer in the manifest
    for (const [url, free] of prefetchHandlesRef.current) {
      if (!imageUrls.has(url)) {
        free();
        prefetchHandlesRef.current.delete(url);
      }
    }
  }, [manifest, bundleUrl]);

  // Cleanup prefetches on unmount
  useEffect(() => {
    return () => {
      for (const [, free] of prefetchHandlesRef.current) {
        free();
      }
      prefetchHandlesRef.current.clear();
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
    const m = manifest as any;
    const cleaned = { ...m };

    // Phrase/karaoke/DH modes need multi-word caption items.
    // Merge single-word items into phrase groups right before passing to Player.
    const cp = cleaned.captionPreset ?? cleaned.captionStyle;
    const needsMergePlayer = cp?.typographyPairingId ||
      cp?.displayMode === 'phrase' ||
      cp?.displayMode === 'karaoke';
    if (needsMergePlayer && Array.isArray(cleaned.items)) {
      const wpp = cp.wordsPerPhrase || 6;
      const captions = cleaned.items.filter((i: any) => i.type === 'caption');
      const nonCaptions = cleaned.items.filter((i: any) => i.type !== 'caption');
      if (captions.length > 1 && captions[0]?.data?.words?.length <= 1) {
        const merged: any[] = [];
        for (let i = 0; i < captions.length; i += wpp) {
          const group = captions.slice(i, i + wpp);
          const allWords = group.flatMap((it: any) => it.data?.words ?? []);
          if (allWords.length === 0) continue;
          merged.push({
            ...group[0],
            id: group[0].id + '-merged',
            endMs: group[group.length - 1].endMs,
            data: { words: allWords },
          });
        }
        cleaned.items = [...nonCaptions, ...merged];
      }
    }

    return { manifest: cleaned };
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
      numberOfSharedAudioTags={0}
      bufferStateDelayInMilliseconds={300}
      logLevel="trace"
    />
  );
});
