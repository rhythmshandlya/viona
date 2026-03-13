import React from 'react';
import { Audio, staticFile } from 'remotion';

interface AudioItemData {
  src: string;
  volume?: number;
  playbackRate?: number;
}

interface AudioItemProps {
  data: AudioItemData;
  assets: Record<string, string>;
  fps: number;
}

export const AudioItem: React.FC<AudioItemProps> = ({ data, assets }) => {
  const src = assets[data.src] || staticFile(data.src);

  return (
    <Audio
      src={src}
      volume={data.volume ?? 1}
      playbackRate={data.playbackRate ?? 1}
    />
  );
};
