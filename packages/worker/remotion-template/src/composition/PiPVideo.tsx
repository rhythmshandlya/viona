import React from 'react';
import { OffthreadVideo, staticFile } from 'remotion';
import type { PiPSettings, VideoCropSettings } from './types';

interface PiPVideoProps {
  src: string;
  pip: PiPSettings;
  crop: VideoCropSettings;
  canvasWidth: number;
  canvasHeight: number;
}

export const PiPVideo: React.FC<PiPVideoProps> = ({
  src, pip, crop, canvasWidth,
}) => {
  const sizePx = Math.round(canvasWidth * pip.size / 100);

  // Position
  const positionStyle: React.CSSProperties = {};
  switch (pip.position) {
    case 'top-left':
      positionStyle.top = pip.offsetY;
      positionStyle.left = pip.offsetX;
      break;
    case 'top-right':
      positionStyle.top = pip.offsetY;
      positionStyle.right = pip.offsetX;
      break;
    case 'bottom-left':
      positionStyle.bottom = pip.offsetY;
      positionStyle.left = pip.offsetX;
      break;
    case 'bottom-right':
    default:
      positionStyle.bottom = pip.offsetY;
      positionStyle.right = pip.offsetX;
      break;
  }

  const borderRadius = pip.shape === 'circle'
    ? '50%'
    : pip.shape === 'square'
      ? 0
      : pip.borderRadius;

  const boxShadow = pip.shadowEnabled
    ? `0 4px ${pip.shadowBlur}px ${pip.shadowColor}`
    : 'none';

  // Crop math (same as SpeakerVideo.tsx)
  const aspectRatio = crop.sourceWidth / crop.sourceHeight;
  const scaledW = sizePx * crop.scale;
  const scaledH = scaledW / aspectRatio;
  const maxOffsetX = scaledW - sizePx;
  const maxOffsetY = scaledH - sizePx;
  const offsetX = -(crop.cropX / 100) * maxOffsetX;
  const offsetY = -(crop.cropY / 100) * maxOffsetY;

  return (
    <div
      style={{
        position: 'absolute',
        width: sizePx,
        height: sizePx,
        ...positionStyle,
        borderRadius,
        overflow: 'hidden',
        boxShadow,
        border: pip.borderWidth > 0
          ? `${pip.borderWidth}px solid ${pip.borderColor}`
          : 'none',
        opacity: pip.opacity,
        transform: pip.rotation ? `rotate(${pip.rotation}deg)` : undefined,
        zIndex: 10,
      }}
    >
      <OffthreadVideo
        muted
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
