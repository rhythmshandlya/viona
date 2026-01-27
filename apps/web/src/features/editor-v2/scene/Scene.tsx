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
}

export function Scene({ className, activePlatform, overlayMode }: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const project = useProject();
  const [scale, setScale] = useState(1);

  // Calculate scale to fit player in container with generous padding
  const calculateScale = useCallback(() => {
    if (!containerRef.current || !project) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth - 64;
    const containerHeight = container.clientHeight - 64;

    const videoWidth = project.videoSettings.canvasWidth;
    const videoHeight = project.videoSettings.canvasHeight;

    const scaleX = containerWidth / videoWidth;
    const scaleY = containerHeight / videoHeight;
    const newScale = Math.min(scaleX, scaleY, 1);

    setScale(newScale);
  }, [project]);

  useEffect(() => {
    calculateScale();
    const handleResize = () => calculateScale();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateScale]);

  useEffect(() => {
    calculateScale();
  }, [project, calculateScale]);

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
      {/* Player container with scale */}
      <div
        className="relative rounded-lg overflow-hidden shadow-2xl"
        style={{
          width: videoWidth,
          height: videoHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        <Player />

        {/* Social preview overlay - inside scaled container so it matches video exactly */}
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
  );
}
