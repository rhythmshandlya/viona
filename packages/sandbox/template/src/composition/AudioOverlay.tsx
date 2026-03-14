import React from 'react';
import { Audio } from 'remotion';
import { resolveVideoSrc } from './utils';

interface AudioOverlayProps {
  data: {
    src: string;
    volume?: number;
    playbackRate?: number;
  };
}

export const AudioOverlay: React.FC<AudioOverlayProps> = ({ data }) => {
  return (
    <Audio
      src={resolveVideoSrc(data.src)!}
      volume={data.volume ?? 1}
      playbackRate={data.playbackRate ?? 1}
    />
  );
};
