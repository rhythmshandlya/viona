import React from 'react';
import { OffthreadVideo, staticFile } from 'remotion';
import type { Rect, VideoCropSettings } from './types';

interface SpeakerVideoProps {
  rect: Rect;
  src?: string;
  crop: VideoCropSettings;
}

export const SpeakerVideo: React.FC<SpeakerVideoProps> = ({ rect, src, crop }) => {
  if (!src) return null;

  // Hide when effectively off-canvas (fullscreen mode transitions)
  if (rect.h <= 10) return null;

  const aspectRatio = crop.sourceWidth / crop.sourceHeight;
  const rectAspect = rect.w / Math.max(rect.h, 1); // prevent division by zero

  let scaledW: number;
  let scaledH: number;
  if (aspectRatio > rectAspect) {
    scaledH = rect.h * crop.scale;
    scaledW = scaledH * aspectRatio;
  } else {
    scaledW = rect.w * crop.scale;
    scaledH = scaledW / aspectRatio;
  }

  const maxOffsetX = scaledW - rect.w;
  const maxOffsetY = scaledH - rect.h;
  const offsetX = -(crop.cropX / 100) * maxOffsetX;
  const offsetY = -(crop.cropY / 100) * maxOffsetY;

  return (
    <div
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        overflow: 'hidden',
      }}
    >
      <OffthreadVideo
        src={staticFile(src)}
        style={{
          width: scaledW,
          height: scaledH,
          objectFit: 'cover',
          transform: `translate(${offsetX}px, ${offsetY}px)`,
        }}
      />
    </div>
  );
};
