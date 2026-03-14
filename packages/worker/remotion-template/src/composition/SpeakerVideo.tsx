import React from 'react';
import { OffthreadVideo } from 'remotion';
import { resolveVideoSrc } from './utils';
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
        src={resolveVideoSrc(src)!}
        crossOrigin="anonymous"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    </div>
  );
};
