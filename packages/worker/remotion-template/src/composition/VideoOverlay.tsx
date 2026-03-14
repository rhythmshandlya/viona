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
  const startFromFrames = Math.round(((data.startFrom || 0) / 1000) * fps);

  return (
    <OffthreadVideo
      src={resolveVideoSrc(data.src)!}
      startFrom={startFromFrames}
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
