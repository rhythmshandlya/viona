/**
 * Scene Component
 * Maximized preview area containing the Remotion player
 * with optional social platform preview overlay
 */

'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Player } from '../player/Player';
import { useProject } from '../store/use-editor-store';
import { SocialPreviewOverlay } from './SocialPreviewOverlay';
import { type SocialPlatform, type OverlayMode } from './social-platforms';

interface SceneProps {
  className?: string;
  activePlatform: SocialPlatform | null;
  overlayMode: OverlayMode;
  padding?: number;
}

export function Scene({ className, activePlatform, overlayMode, padding = 64 }: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const project = useProject();
  const [scale, setScale] = useState(1);

  // Calculate scale to fit player in container
  const calculateScale = useCallback(() => {
    if (!containerRef.current || !project) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth - padding;
    const containerHeight = container.clientHeight - padding;

    if (containerWidth <= 0 || containerHeight <= 0) return;

    const videoWidth = project.videoSettings.canvasWidth;
    const videoHeight = project.videoSettings.canvasHeight;

    const scaleX = containerWidth / videoWidth;
    const scaleY = containerHeight / videoHeight;
    setScale(Math.min(scaleX, scaleY));
  }, [project, padding]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    calculateScale();
    const ro = new ResizeObserver(() => calculateScale());
    ro.observe(el);
    return () => ro.disconnect();
  }, [calculateScale]);

  if (!project) {
    return (
      <div className={`flex items-center justify-center bg-[var(--editor-bg-base)] ${className || ''}`}>
        <p className="text-[var(--editor-text-muted)] text-sm">Loading...</p>
      </div>
    );
  }

  const videoWidth = project.videoSettings.canvasWidth;
  const videoHeight = project.videoSettings.canvasHeight;

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center bg-[var(--editor-bg-base)] overflow-hidden ${className || ''}`}
    >
      {/* Outer wrapper with actual display dimensions */}
      <div
        className="relative rounded-lg overflow-hidden shadow-2xl"
        style={{
          width: Math.round(videoWidth * scale),
          height: Math.round(videoHeight * scale),
        }}
      >
        {/* Inner container at native resolution, scaled with CSS transform */}
        <div
          style={{
            width: videoWidth,
            height: videoHeight,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <Player />

          {/* Social preview overlay */}
          {activePlatform && (
            <SocialPreviewOverlay
              platform={activePlatform}
              mode={overlayMode}
              width={videoWidth}
              height={videoHeight}
            />
          )}
        </div>
      </div>
    </div>
  );
}
