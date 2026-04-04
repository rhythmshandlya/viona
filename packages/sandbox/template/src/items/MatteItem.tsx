import React, { useRef, useEffect, useCallback } from "react";
import { Video, useCurrentFrame, useVideoConfig } from "remotion";
import { resolveMediaSrc } from "./resolveMediaSrc";

/**
 * MatteItem — Foreground + Matte compositing
 *
 * Two separate videos:
 *   fgrSrc  = extracted foreground (speaker pixels only, transparent where no speaker)
 *   matteSrc = grayscale alpha mask (white=person, black=transparent)
 *
 * Canvas composites: fgr pixels with matte.red as alpha channel.
 * This produces a clean speaker cutout without background color halos
 * because fgr is RVM's decontaminated foreground output.
 */

interface MatteItemData {
  fgrSrc: string;
  matteSrc: string;
  startFrom?: number;
}

interface MatteItemProps {
  data: MatteItemData;
  assets: Record<string, string>;
}

export const MatteItem: React.FC<MatteItemProps> = React.memo(({ data, assets }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fgrVideoRef = useRef<HTMLVideoElement>(null);
  const matteVideoRef = useRef<HTMLVideoElement>(null);
  const tmpCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastTimeRef = useRef<number>(-1);

  const fgrSrc = resolveMediaSrc(data.fgrSrc, assets);
  const matteSrc = resolveMediaSrc(data.matteSrc, assets);
  const startFromFrames = Math.round(((data.startFrom ?? 0) / 1000) * fps);

  const doRender = useCallback(() => {
    const canvas = canvasRef.current;
    const fgrVideo = fgrVideoRef.current;
    const matteVideo = matteVideoRef.current;
    if (!canvas || !fgrVideo || !matteVideo) return;
    if (fgrVideo.readyState < 2 || matteVideo.readyState < 2) return;
    if (fgrVideo.currentTime === lastTimeRef.current) return;
    lastTimeRef.current = fgrVideo.currentTime;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!tmpCanvasRef.current) tmpCanvasRef.current = document.createElement("canvas");
    const tmp = tmpCanvasRef.current;
    tmp.width = width;
    tmp.height = height;
    const tmpCtx = tmp.getContext("2d", { willReadFrequently: true });
    if (!tmpCtx) return;

    // Draw foreground, read pixels
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(fgrVideo, 0, 0, width, height);
    const fgrData = ctx.getImageData(0, 0, width, height);
    const fgrPx = fgrData.data;

    // Draw matte, read pixels
    tmpCtx.clearRect(0, 0, width, height);
    tmpCtx.drawImage(matteVideo, 0, 0, width, height);
    const matteData = tmpCtx.getImageData(0, 0, width, height);
    const mattePx = matteData.data;

    // Apply matte red channel as alpha
    for (let i = 0; i < fgrPx.length; i += 4) {
      fgrPx[i + 3] = mattePx[i];
    }

    ctx.putImageData(fgrData, 0, 0);
  }, [width, height]);

  useEffect(() => { doRender(); }, [frame, doRender]);

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <Video
        ref={fgrVideoRef}
        src={fgrSrc}
        startFrom={startFromFrames}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
        pauseWhenBuffering
        muted
        onLoadedData={doRender}
        crossOrigin="anonymous"
      />
      <Video
        ref={matteVideoRef}
        src={matteSrc}
        startFrom={startFromFrames}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
        pauseWhenBuffering
        muted
        onLoadedData={doRender}
        crossOrigin="anonymous"
      />
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
});
