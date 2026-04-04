import React from 'react';
import { OffthreadVideo, useVideoConfig } from 'remotion';
import { resolveVideoSrc } from './utils';

interface VideoOverlayProps {
  data: {
    src: string;
    startFrom?: number;
    volume?: number;
    playbackRate?: number;
  };
}

export const VideoOverlay: React.FC<VideoOverlayProps> = ({ data }) => {
  const { fps } = useVideoConfig();
  const src = resolveVideoSrc(data.src);
  if (!src) return null;

  const startFromFrames = data.startFrom != null
    ? Math.round((data.startFrom / 1000) * fps)
    : 0;

  return (
    <OffthreadVideo
      src={src}
      startFrom={startFromFrames}
      crossOrigin="anonymous"
      pauseWhenBuffering
      volume={data.volume ?? 1}
      playbackRate={data.playbackRate ?? 1}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      }}
    />
  );
};
