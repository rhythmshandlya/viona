'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Player, type RenderLoading } from '@remotion/player';
import { AbsoluteFill, prefetch } from 'remotion';
import { useWorkspaceComposition, resolvePublicBase, resolveDirectMediaUrl } from './useWorkspaceComposition';

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
      if (e.message?.includes('error while playing the video')) {
        e.preventDefault();
        console.warn('[WorkspacePlayer] Suppressed transient video error');
      }
    };
    window.addEventListener('error', handler);
    return () => window.removeEventListener('error', handler);
  }, []);

  // -----------------------------------------------------------------------
  // Media prefetching via Remotion's prefetch() — downloads full media
  // files into blob URLs in the background.
  //
  // NLE-style timelines create multiple <Video> components for the same
  // source file at different trim points. At cuts, old elements unmount
  // and new ones mount — each needing to seek within the file. With
  // network URLs, this seek requires HTTP range requests and codec init
  // (~300ms+), causing visible lag. With blob URLs the entire file is in
  // memory, so seeks are instant.
  //
  // Trade-off: blob download runs alongside the Player's native streaming
  // during initial playback (minor bandwidth competition). Once complete,
  // all subsequent cuts/seeks are lag-free.
  // -----------------------------------------------------------------------
  const prefetchHandlesRef = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    const m = manifest as any;
    if (!m?.items || !bundleUrl) return;

    const publicBase = resolvePublicBase(bundleUrl);

    // Collect unique media URLs
    const currentMedia = new Set<string>();
    const resolveMedia = (src: string) => {
      if (/^https?:\/\/|^blob:/.test(src)) return src;
      // Already a resolved absolute path — don't double-resolve
      if (src.startsWith('/api/')) return src;
      const cleanPath = src.startsWith('/') ? src.slice(1) : src;
      return resolveDirectMediaUrl(bundleUrl, cleanPath) ?? `${publicBase}/${cleanPath}`;
    };
    for (const item of m.items) {
      if ((item.type === 'video' || item.type === 'audio') && item.data?.src) {
        currentMedia.add(resolveMedia(item.data.src as string));
      }
      // Prefetch matte item videos for depth compositing
      if (item.type === 'matte') {
        if (item.data?.fgrSrc) currentMedia.add(resolveMedia(item.data.fgrSrc as string));
        if (item.data?.matteSrc) currentMedia.add(resolveMedia(item.data.matteSrc as string));
      }
      // Prefetch image sources (background plates)
      if (item.type === 'image' && item.data?.src) {
        currentMedia.add(resolveMedia(item.data.src as string));
      }
    }

    // Prefetch each media URL into a blob. Once downloaded, Remotion
    // internally maps the original URL → blob URL so all <Video>/<Audio>
    // components using that URL get instant seeks from memory.
    for (const url of currentMedia) {
      if (!prefetchHandlesRef.current.has(url)) {
        try {
          const { free, waitUntilDone } = prefetch(url);
          // Catch the async rejection so it doesn't surface as an unhandled
          // promise rejection (Remotion rejects waitUntilDone on HTTP errors).
          waitUntilDone().catch(() => {});
          prefetchHandlesRef.current.set(url, free);
        } catch {
          // prefetch may fail for blob: or invalid URLs — fall back silently
        }
      }
    }

    // Free prefetches no longer in the manifest
    for (const [url, free] of prefetchHandlesRef.current) {
      if (!currentMedia.has(url)) {
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
    // Strip sandbox assets map so resolveMediaSrc always falls through to
    // staticFile(), returning the direct video URL for native streaming.
    const m = manifest as any;
    const cleaned = m?.assets ? { ...m, assets: {} } : { ...m };

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
      numberOfSharedAudioTags={5}
      bufferStateDelayInMilliseconds={300}
    />
  );
});
