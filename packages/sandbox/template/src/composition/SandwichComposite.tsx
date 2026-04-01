import React, { useRef, useEffect, useCallback } from 'react';
import {
  AbsoluteFill,
  Video,
  useCurrentFrame,
  useVideoConfig,
  getRemotionEnvironment,
  staticFile,
} from 'remotion';

interface SandwichCompositeProps {
  videoSrc: string;
  matteSrc: string;
  startFrom: number;
  children: React.ReactNode;
}

/**
 * Three-layer sandwich composite:
 *   Layer 0: Original video (background) — fills entire canvas
 *   Layer 1: {children} — mid-layer animations (behind person)
 *   Layer 2: Person extracted via canvas matte compositing (on top)
 *
 * Video sync strategy:
 *   Both the source and matte videos render as Remotion <Video> components
 *   inside hidden (opacity: 0) divs. Remotion's <Video> handles frame-seeking
 *   during both preview playback and server-side rendering. The canvas reads
 *   pixel data from these DOM <video> elements on every frame tick, ensuring
 *   the composite is always frame-accurate.
 *
 * Canvas approach:
 *   1. Draw source video frame onto canvas
 *   2. Set globalCompositeOperation to 'destination-in'
 *   3. Draw matte frame — white pixels = keep, black = discard
 *   4. Result: person-only pixels on transparent background
 */
export const SandwichComposite: React.FC<SandwichCompositeProps> = ({
  videoSrc,
  matteSrc,
  startFrom,
  children,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceVideoRef = useRef<HTMLVideoElement>(null);
  const matteVideoRef = useRef<HTMLVideoElement>(null);

  const resolvedVideoSrc = resolveSrc(videoSrc);
  const resolvedMatteSrc = resolveSrc(matteSrc);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const sourceVideo = sourceVideoRef.current;
    const matteVideo = matteVideoRef.current;
    if (!canvas || !sourceVideo || !matteVideo) return;
    if (sourceVideo.readyState < 2 || matteVideo.readyState < 2) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Step 1: Draw source video frame (person + background)
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(sourceVideo, 0, 0, width, height);

    // Step 2: Apply matte as alpha mask
    // 'destination-in' keeps existing pixels only where the new draw is opaque.
    // The matte is white (opaque) where the person is, black (transparent) elsewhere.
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(matteVideo, 0, 0, width, height);

    // Reset composite operation
    ctx.globalCompositeOperation = 'source-over';
  }, [width, height]);

  // Re-render canvas every frame — Remotion <Video> handles seeking,
  // so by the time useEffect fires the video elements are at the correct frame.
  useEffect(() => {
    renderCanvas();
  }, [frame, renderCanvas]);

  const startFromFrames = Math.round((startFrom / 1000) * fps);

  return (
    <AbsoluteFill>
      {/* Layer 0: Original video (background — visible through gaps) */}
      <AbsoluteFill>
        <Video
          src={resolvedVideoSrc}
          startFrom={startFromFrames}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          pauseWhenBuffering
        />
      </AbsoluteFill>

      {/* Layer 1: Mid-layer children (animations behind the person) */}
      <AbsoluteFill>
        {children}
      </AbsoluteFill>

      {/* Layer 2: Person extracted via canvas matte */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        {/*
         * Hidden Remotion <Video> elements for canvas reads.
         * Using Remotion's <Video> (not raw <video>) ensures frame-accurate
         * seeking during both preview and server-side rendering. The elements
         * are visually hidden (opacity: 0) but remain in the DOM so the canvas
         * can drawImage() from them.
         *
         * We attach refs via the callback pattern to capture the underlying
         * <video> DOM element that Remotion's <Video> renders.
         */}
        <Video
          ref={sourceVideoRef}
          src={resolvedVideoSrc}
          startFrom={startFromFrames}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
          pauseWhenBuffering
          muted
          onLoadedData={renderCanvas}
        />
        <Video
          ref={matteVideoRef}
          src={resolvedMatteSrc}
          startFrom={startFromFrames}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
          pauseWhenBuffering
          muted
          onLoadedData={renderCanvas}
        />
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{ width: '100%', height: '100%' }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Resolve src path — in render mode use staticFile, otherwise pass through */
function resolveSrc(src: string): string {
  if (/^https?:\/\/|^blob:/.test(src)) return src;
  const { isRendering } = getRemotionEnvironment();
  if (isRendering) return staticFile(src);
  return src;
}

export default SandwichComposite;
