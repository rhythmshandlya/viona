import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  AbsoluteFill,
  Video,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Sequence,
  continueRender,
  delayRender,
} from 'remotion';
import { useScale } from '../../use-scale';
import type { YouTubeClipProps } from './schema';

/* ── Border Thickness Constants ─────────────────────────────────── */

const BORDER_WIDTHS = {
  none: 0,
  thin: 2,
  medium: 4,
  thick: 8,
};

/* ── Shadow Styles ──────────────────────────────────────────────── */

const SHADOWS = {
  none: 'none',
  subtle: '0 4px 12px rgba(0, 0, 0, 0.15)',
  medium: '0 8px 24px rgba(0, 0, 0, 0.25)',
  strong: '0 12px 40px rgba(0, 0, 0, 0.4)',
};

/* ── Frame Components ───────────────────────────────────────────── */

interface FrameProps {
  children: React.ReactNode;
  width: number;
  height: number;
  s: (px: number) => number;
}

const PhoneFrame: React.FC<FrameProps> = ({ children, width, height, s }) => {
  const frameWidth = s(320);
  const frameHeight = s(640);
  const bezelWidth = s(12);
  const notchHeight = s(24);
  const cornerRadius = s(36);

  return (
    <div
      style={{
        width: frameWidth + bezelWidth * 2,
        height: frameHeight + bezelWidth * 2,
        backgroundColor: '#1a1a1a',
        borderRadius: cornerRadius,
        padding: bezelWidth,
        boxShadow: SHADOWS.strong,
        position: 'relative',
      }}
    >
      {/* Notch */}
      <div
        style={{
          position: 'absolute',
          top: bezelWidth,
          left: '50%',
          transform: 'translateX(-50%)',
          width: s(80),
          height: notchHeight,
          backgroundColor: '#1a1a1a',
          borderRadius: `0 0 ${s(12)}px ${s(12)}px`,
          zIndex: 10,
        }}
      />
      <div
        style={{
          width: frameWidth,
          height: frameHeight,
          borderRadius: cornerRadius - bezelWidth,
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
};

const LaptopFrame: React.FC<FrameProps> = ({ children, width, height, s }) => {
  const screenWidth = s(800);
  const screenHeight = s(500);
  const bezelWidth = s(16);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Screen */}
      <div
        style={{
          width: screenWidth + bezelWidth * 2,
          backgroundColor: '#2a2a2a',
          borderRadius: `${s(12)}px ${s(12)}px 0 0`,
          padding: bezelWidth,
          paddingBottom: s(8),
        }}
      >
        <div
          style={{
            width: screenWidth,
            height: screenHeight,
            borderRadius: s(4),
            overflow: 'hidden',
            backgroundColor: '#000',
          }}
        >
          {children}
        </div>
      </div>
      {/* Base */}
      <div
        style={{
          width: screenWidth + bezelWidth * 4,
          height: s(20),
          backgroundColor: '#3a3a3a',
          borderRadius: `0 0 ${s(8)}px ${s(8)}px`,
        }}
      />
    </div>
  );
};

const BrowserFrame: React.FC<FrameProps> = ({ children, width, height, s }) => {
  const frameWidth = s(900);
  const frameHeight = s(540);
  const toolbarHeight = s(36);

  return (
    <div
      style={{
        width: frameWidth,
        backgroundColor: '#2a2a2a',
        borderRadius: s(8),
        overflow: 'hidden',
        boxShadow: SHADOWS.medium,
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          height: toolbarHeight,
          backgroundColor: '#3a3a3a',
          display: 'flex',
          alignItems: 'center',
          padding: `0 ${s(12)}px`,
          gap: s(8),
        }}
      >
        {/* Traffic lights */}
        <div style={{ display: 'flex', gap: s(6) }}>
          <div style={{ width: s(12), height: s(12), borderRadius: '50%', backgroundColor: '#ff5f57' }} />
          <div style={{ width: s(12), height: s(12), borderRadius: '50%', backgroundColor: '#febc2e' }} />
          <div style={{ width: s(12), height: s(12), borderRadius: '50%', backgroundColor: '#28c840' }} />
        </div>
        {/* URL bar */}
        <div
          style={{
            flex: 1,
            height: s(24),
            backgroundColor: '#1a1a1a',
            borderRadius: s(4),
            marginLeft: s(20),
          }}
        />
      </div>
      {/* Content */}
      <div style={{ width: frameWidth, height: frameHeight, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
};

const PolaroidFrame: React.FC<FrameProps> = ({ children, width, height, s }) => {
  const photoWidth = s(400);
  const photoHeight = s(400);
  const padding = s(16);
  const bottomPadding = s(60);

  return (
    <div
      style={{
        backgroundColor: '#fafafa',
        padding: `${padding}px ${padding}px ${bottomPadding}px ${padding}px`,
        boxShadow: SHADOWS.medium,
        transform: 'rotate(-2deg)',
      }}
    >
      <div
        style={{
          width: photoWidth,
          height: photoHeight,
          overflow: 'hidden',
          backgroundColor: '#000',
        }}
      >
        {children}
      </div>
    </div>
  );
};

const FilmFrame: React.FC<FrameProps> = ({ children, width, height, s }) => {
  const frameWidth = s(600);
  const frameHeight = s(400);
  const sprocketSize = s(20);
  const sprocketGap = s(30);
  const sprocketCount = Math.floor(frameHeight / sprocketGap);

  const sprockets = Array.from({ length: sprocketCount }, (_, i) => (
    <div
      key={i}
      style={{
        width: sprocketSize,
        height: sprocketSize * 0.6,
        backgroundColor: '#1a1a1a',
        borderRadius: s(2),
      }}
    />
  ));

  return (
    <div
      style={{
        display: 'flex',
        backgroundColor: '#2a2a2a',
        padding: s(8),
        gap: s(8),
      }}
    >
      {/* Left sprockets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: sprocketGap - sprocketSize * 0.6, justifyContent: 'center' }}>
        {sprockets}
      </div>
      {/* Video */}
      <div style={{ width: frameWidth, height: frameHeight, overflow: 'hidden', backgroundColor: '#000' }}>
        {children}
      </div>
      {/* Right sprockets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: sprocketGap - sprocketSize * 0.6, justifyContent: 'center' }}>
        {sprockets}
      </div>
    </div>
  );
};

/* ── Video Preload Cache ─────────────────────────────────────────── */

// Global cache of preloaded video URLs with their seek positions
// This persists across component remounts so videos stay ready
const preloadedVideos = new Map<string, { ready: boolean; element?: HTMLVideoElement }>();

// Create a cache key that includes the seek position
function getPreloadCacheKey(src: string, startSeconds: number): string {
  return `${src}@${Math.floor(startSeconds)}`;
}

/* ── Video with Preload Component ────────────────────────────────── */

interface PreloadedVideoProps {
  src: string;
  startFromSeconds: number;
  endAtSeconds?: number;
  volume: number;
  playbackRate: number;
  loop: boolean;
  muted: boolean;
  style?: React.CSSProperties;
  onReady?: () => void;
}

const PreloadedVideo: React.FC<PreloadedVideoProps> = ({
  src,
  startFromSeconds,
  endAtSeconds,
  volume,
  playbackRate,
  loop,
  muted,
  style,
  onReady,
}) => {
  const { fps } = useVideoConfig();
  const videoRef = useRef<HTMLVideoElement>(null);
  const readyCalledRef = useRef(false);

  // Reject raw YouTube page URLs — they can't be played as video
  const isRawYouTubeUrl = /youtube\.com|youtu\.be/.test(src);

  // Check if this is a streaming URL (proxy URL that needs seek)
  const isStreamingUrl = src.includes('/api/youtube/proxy/') || src.includes('/youtube/proxy/');
  const cacheKey = getPreloadCacheKey(src, startFromSeconds);

  // Check cache for already-preloaded state
  const cachedState = preloadedVideos.get(cacheKey);
  const initialReady = cachedState?.ready ?? false;

  const [isReady, setIsReady] = useState(initialReady);
  const [hasError, setHasError] = useState(false);

  // If already cached as ready, signal immediately
  useEffect(() => {
    if (initialReady && !readyCalledRef.current) {
      readyCalledRef.current = true;
      onReady?.();
    }
  }, [initialReady, onReady]);

  const handleCanPlay = useCallback(() => {
    if (readyCalledRef.current) return;

    const video = videoRef.current;
    if (!video) return;

    // For streaming URLs, we need to seek first then wait for buffer
    if (isStreamingUrl && startFromSeconds > 0) {
      // Only seek if not already at the right position
      if (Math.abs(video.currentTime - startFromSeconds) > 0.5) {
        video.currentTime = startFromSeconds;
        return; // Wait for another canplay after seek
      }
    }

    // Check if we have enough buffer
    const buffered = video.buffered;
    let hasEnoughBuffer = false;
    for (let i = 0; i < buffered.length; i++) {
      if (buffered.start(i) <= startFromSeconds && buffered.end(i) >= startFromSeconds + 1) {
        hasEnoughBuffer = true;
        break;
      }
    }

    if (hasEnoughBuffer || !isStreamingUrl) {
      readyCalledRef.current = true;
      // Update global cache so future mounts are instant
      preloadedVideos.set(cacheKey, { ready: true, element: video });
      setIsReady(true);
      onReady?.();
    }
  }, [isStreamingUrl, startFromSeconds, onReady, cacheKey]);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  // Start preloading in the background when mounted (even if cached)
  useEffect(() => {
    if (!isStreamingUrl || isReady) return;

    // Check if we have a cached video element that's still valid
    const cached = preloadedVideos.get(cacheKey);
    if (cached?.element && cached.ready) {
      setIsReady(true);
      return;
    }

    // Start preloading immediately in the background
    const preloadVideo = document.createElement('video');
    preloadVideo.src = src;
    preloadVideo.preload = 'auto';
    preloadVideo.muted = true;

    const handlePreloadCanPlay = () => {
      if (startFromSeconds > 0 && Math.abs(preloadVideo.currentTime - startFromSeconds) > 0.5) {
        preloadVideo.currentTime = startFromSeconds;
        return;
      }
      preloadedVideos.set(cacheKey, { ready: true, element: preloadVideo });
      setIsReady(true);
    };

    preloadVideo.addEventListener('canplay', handlePreloadCanPlay);
    preloadVideo.addEventListener('canplaythrough', handlePreloadCanPlay);
    preloadVideo.load();

    return () => {
      preloadVideo.removeEventListener('canplay', handlePreloadCanPlay);
      preloadVideo.removeEventListener('canplaythrough', handlePreloadCanPlay);
    };
  }, [src, startFromSeconds, isStreamingUrl, isReady, cacheKey]);

  // Raw YouTube URLs can't be played as video — show error immediately
  if (isRawYouTubeUrl) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1a1a',
          color: '#666',
          fontSize: 14,
          ...style,
        }}
      >
        Video loading...
      </div>
    );
  }

  // For streaming URLs, we render a native video with preload
  // For regular URLs (downloaded files), use Remotion's Video directly
  if (!isStreamingUrl) {
    return (
      <Video
        src={src}
        startFrom={Math.floor(startFromSeconds * fps)}
        endAt={endAtSeconds ? Math.floor(endAtSeconds * fps) : undefined}
        volume={muted ? 0 : volume}
        playbackRate={playbackRate}
        loop={loop}
        style={style}
      />
    );
  }

  // For streaming URLs, use a combination approach:
  // Show loading state while buffering, then switch to Remotion Video
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Hidden preload video (backup to background preload) */}
      {!isReady && (
        <video
          ref={videoRef}
          src={src}
          preload="auto"
          muted
          onCanPlay={handleCanPlay}
          onCanPlayThrough={handleCanPlay}
          onError={handleError}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1 }}
        />
      )}

      {/* Loading state */}
      {!isReady && !hasError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000',
            ...style,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              border: '3px solid rgba(255,255,255,0.2)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1a1a1a',
            color: '#666',
            fontSize: 14,
            ...style,
          }}
        >
          Failed to load video
        </div>
      )}

      {/* Actual video once ready */}
      {isReady && (
        <Video
          src={src}
          startFrom={Math.floor(startFromSeconds * fps)}
          endAt={endAtSeconds ? Math.floor(endAtSeconds * fps) : undefined}
          volume={muted ? 0 : volume}
          playbackRate={playbackRate}
          loop={loop}
          style={style}
        />
      )}
    </div>
  );
};

/* ── Main Component ─────────────────────────────────────────────── */

const YouTubeClip: React.FC<YouTubeClipProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const s = useScale();

  const {
    clipUrl,
    trimStartSeconds,
    trimEndSeconds,
    volume,
    border,
    borderColor,
    borderRadius = 0,
    frame: frameStyle,
    shadowIntensity,
    scale,
    offsetX,
    offsetY,
    backgroundColor,
    playbackRate,
    loop,
    muted,
  } = props;

  // If no clip URL, show placeholder
  if (!clipUrl) {
    return (
      <AbsoluteFill style={{ backgroundColor, justifyContent: 'center', alignItems: 'center' }}>
        <div
          style={{
            color: '#666',
            fontSize: s(24),
            fontFamily: 'system-ui, sans-serif',
            textAlign: 'center',
          }}
        >
          No video clip loaded
        </div>
      </AbsoluteFill>
    );
  }

  // Calculate video styles
  const borderWidth = BORDER_WIDTHS[border];
  const shadow = SHADOWS[shadowIntensity];

  const videoContainerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    border: borderWidth > 0 ? `${s(borderWidth)}px solid ${borderColor}` : 'none',
    borderRadius: s(borderRadius || 0),
    boxShadow: shadow,
    overflow: 'hidden',
    boxSizing: 'border-box',
  };

  const videoStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  };

  const videoElement = (
    <div style={videoContainerStyle}>
      <PreloadedVideo
        src={clipUrl}
        startFromSeconds={trimStartSeconds}
        endAtSeconds={trimEndSeconds}
        volume={volume}
        playbackRate={playbackRate}
        loop={loop}
        muted={muted}
        style={videoStyle}
      />
    </div>
  );

  // Wrap in frame if needed
  let content: React.ReactNode = videoElement;

  if (frameStyle !== 'none') {
    const frameProps: FrameProps = {
      children: (
        <PreloadedVideo
          src={clipUrl}
          startFromSeconds={trimStartSeconds}
          endAtSeconds={trimEndSeconds}
          volume={volume}
          playbackRate={playbackRate}
          loop={loop}
          muted={muted}
          style={videoStyle}
        />
      ),
      width,
      height,
      s,
    };

    switch (frameStyle) {
      case 'phone':
        content = <PhoneFrame {...frameProps} />;
        break;
      case 'laptop':
        content = <LaptopFrame {...frameProps} />;
        break;
      case 'browser':
        content = <BrowserFrame {...frameProps} />;
        break;
      case 'polaroid':
        content = <PolaroidFrame {...frameProps} />;
        break;
      case 'film':
        content = <FilmFrame {...frameProps} />;
        break;
    }
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          transform: `scale(${scale}) translate(${s(offsetX)}px, ${s(offsetY)}px)`,
          transformOrigin: 'center center',
        }}
      >
        {content}
      </div>
    </AbsoluteFill>
  );
};

export default YouTubeClip;
