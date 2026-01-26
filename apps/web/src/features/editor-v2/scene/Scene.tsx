/**
 * Scene Component
 * Maximized preview area containing the Remotion player
 */

'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Player } from '../player/Player';
import { useProject } from '../store/use-editor-store';

interface SceneProps {
  className?: string;
}

export function Scene({ className }: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const project = useProject();
  const [scale, setScale] = useState(1);

  // Calculate scale to fit player in container with generous padding
  const calculateScale = useCallback(() => {
    if (!containerRef.current || !project) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth - 64; // padding
    const containerHeight = container.clientHeight - 64;

    const videoWidth = project.videoSettings.canvasWidth;
    const videoHeight = project.videoSettings.canvasHeight;

    const scaleX = containerWidth / videoWidth;
    const scaleY = containerHeight / videoHeight;
    const newScale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 1

    setScale(newScale);
  }, [project]);

  // Recalculate on resize
  useEffect(() => {
    calculateScale();

    const handleResize = () => {
      calculateScale();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateScale]);

  // Also recalculate when project changes
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

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center bg-[var(--editor-bg-base)] overflow-hidden ${className || ''}`}
    >
      {/* Player container with scale */}
      <div
        className="rounded-lg overflow-hidden shadow-2xl"
        style={{
          width: project.videoSettings.canvasWidth,
          height: project.videoSettings.canvasHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        <Player />
      </div>

      {/* Scale indicator - subtle, bottom right */}
      <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-[var(--editor-bg-surface)]/80
                      text-[10px] text-[var(--editor-text-muted)] font-mono">
        {Math.round(scale * 100)}%
      </div>
    </div>
  );
}
