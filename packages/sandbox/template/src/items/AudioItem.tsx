import React from 'react';
import { Audio } from 'remotion';
import { resolveMediaSrc } from './resolveMediaSrc';

interface AudioItemData {
  src: string;
  startFrom?: number;
  volume?: number;
  playbackRate?: number;
}

interface AudioItemProps {
  data: AudioItemData;
  assets: Record<string, string>;
  fps: number;
}

export const AudioItem: React.FC<AudioItemProps> = ({ data, assets, fps }) => {
  const src = resolveMediaSrc(data.src, assets);

  const startFrom =
    data.startFrom != null
      ? Math.round((data.startFrom / 1000) * fps)
      : undefined;

  return (
    <Audio
      src={src}
      startFrom={startFrom}
      pauseWhenBuffering
      volume={data.volume ?? 1}
      playbackRate={data.playbackRate ?? 1}
    />
  );
};
