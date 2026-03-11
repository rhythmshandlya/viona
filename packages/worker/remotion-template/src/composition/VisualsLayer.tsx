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

  const scaleX = rect.w / width;
  const scaleY = rect.h / height;

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
          transform: `scale(${scaleX}, ${scaleY})`,
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
