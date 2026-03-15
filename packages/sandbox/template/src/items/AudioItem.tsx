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
  // Resolve src: check assets map first, handle http(s)/blob URLs directly,
  // fallback to staticFile for local paths
  let src: string;
  if (assets[data.src]) {
    src = assets[data.src];
  } else if (/^https?:\/\/|^blob:/.test(data.src)) {
    src = data.src;
  } else {
    src = staticFile(data.src);
  }

  return (
    <Audio
      src={src}
      volume={data.volume ?? 1}
      playbackRate={data.playbackRate ?? 1}
    />
  );
};
