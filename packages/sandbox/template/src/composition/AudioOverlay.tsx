import React from 'react';
import { Audio, useVideoConfig } from 'remotion';
import { resolveVideoSrc } from './utils';

interface AudioOverlayProps {
  data: {
    src: string;
    startFrom?: number;
    volume?: number;
    playbackRate?: number;
  };
}

export const AudioOverlay: React.FC<AudioOverlayProps> = ({ data }) => {
  const { fps } = useVideoConfig();
  const startFrom =
    data.startFrom != null
      ? Math.round((data.startFrom / 1000) * fps)
      : undefined;

  return (
    <Audio
      src={resolveVideoSrc(data.src)!}
      startFrom={startFrom}
      pauseWhenBuffering
      volume={data.volume ?? 1}
      playbackRate={data.playbackRate ?? 1}
    />
  );
};
