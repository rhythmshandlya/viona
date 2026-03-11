import React from 'react';
import { useVideoConfig } from 'remotion';
import type { Rect } from './types';

interface VisualsLayerProps {
  rect: Rect;
  opacity: number;
  children: React.ReactNode;
}

export const VisualsLayer: React.FC<VisualsLayerProps> = ({ rect, opacity, children }) => {
  const { width, height } = useVideoConfig();

  if (rect.h <= 1) return null;

  // Use uniform scaling (by width) to prevent aspect ratio distortion.
  // overflow:hidden on the container clips the excess height in stacked mode.
  // During transitions, the container height animates, smoothly revealing more content.
  const scale = rect.w / width;

  return (
    <div
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        overflow: 'hidden',
        opacity,
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width,
          height,
        }}
      >
        {children}
      </div>
    </div>
  );
};
