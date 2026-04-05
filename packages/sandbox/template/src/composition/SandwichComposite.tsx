import React, { useRef, useEffect, useCallback } from 'react';
import {
  AbsoluteFill,
  Video,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { resolveMediaSrc } from '../items/resolveMediaSrc';

interface SandwichCompositeProps {
  videoSrc: string;
  matteSrc: string;
  startFrom: number;
  children: React.ReactNode;
  backgroundless?: boolean;
  assets?: Record<string, string>;
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
 * Canvas approach (temp canvas):
 *   The RGB matte (H.264) has alpha=255 everywhere — 'destination-in' on the
 *   matte video directly has no effect. Instead:
 *   1. Draw source video onto main canvas (source-over)
 *   2. On temp canvas: draw matte video, getImageData, copy red channel → alpha
 *      channel, putImageData back — temp canvas now has correct alpha mask
 *   3. On main canvas: set destination-in, drawImage(tempCanvas) — keeps source
 *      pixels only where temp canvas alpha > 0 (i.e. where person is present)
 *   4. Reset composite operation to source-over
 */
export const SandwichComposite: React.FC<SandwichCompositeProps> = ({
  videoSrc,
  matteSrc,
  startFrom,
  children,
  backgroundless = false,
  assets = {},
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceVideoRef = useRef<HTMLVideoElement>(null);
  const matteVideoRef = useRef<HTMLVideoElement>(null);

  const resolvedVideoSrc = resolveMediaSrc(videoSrc, assets);
  const resolvedMatteSrc = resolveMediaSrc(matteSrc, assets);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const tempCanvas = tempCanvasRef.current;
    const sourceVideo = sourceVideoRef.current;
    const matteVideo = matteVideoRef.current;
    if (!canvas || !tempCanvas || !sourceVideo || !matteVideo) return;
    if (sourceVideo.readyState < 2 || matteVideo.readyState < 2) return;

    const ctx = canvas.getContext('2d');
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || !tempCtx) return;

    // Step 1: Draw source video onto main canvas
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(sourceVideo, 0, 0, width, height);

    // Step 2: Build alpha mask on temp canvas from matte red channel.
    // H.264 RGB matte always has alpha=255 — we must promote the red channel
    // to alpha so that destination-in produces the correct cutout.
    tempCtx.clearRect(0, 0, width, height);
    tempCtx.drawImage(matteVideo, 0, 0, width, height);
    const imageData = tempCtx.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i + 3] = pixels[i]; // alpha = red channel value
    }
    tempCtx.putImageData(imageData, 0, 0);

    // Step 3: Apply temp canvas as alpha mask onto main canvas
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(tempCanvas, 0, 0, width, height);

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
      {!backgroundless && (
        <AbsoluteFill>
          <Video
            src={resolvedVideoSrc}
            startFrom={startFromFrames}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </AbsoluteFill>
      )}

      {/* Layer 1: Mid-layer children (animations behind the person) */}
      {!backgroundless && (
        <AbsoluteFill>
          {children}
        </AbsoluteFill>
      )}

      {/* Layer 2: Person extracted via canvas matte */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <Video
          ref={sourceVideoRef}
          src={resolvedVideoSrc}
          startFrom={startFromFrames}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
          muted
          onLoadedData={renderCanvas}
        />
        <Video
          ref={matteVideoRef}
          src={resolvedMatteSrc}
          startFrom={startFromFrames}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
          muted
          onLoadedData={renderCanvas}
        />
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{ width: '100%', height: '100%' }}
        />
        <canvas
          ref={tempCanvasRef}
          width={width}
          height={height}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default SandwichComposite;
