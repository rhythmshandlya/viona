import React from 'react';
import { Video } from 'remotion';
import { resolveMediaSrc } from './resolveMediaSrc';

interface VideoCrop {
  x: number;
  y: number;
  scale: number;
}

interface VideoItemData {
  src: string;
  startFrom?: number;
  volume?: number;
  playbackRate?: number;
  crop?: VideoCrop;
}

interface VideoItemProps {
  data: VideoItemData;
  assets: Record<string, string>;
  fps: number;
  durationInFrames: number;
}

export const VideoItem: React.FC<VideoItemProps> = React.memo(({
  data,
  assets,
  fps,
  durationInFrames,
}) => {
  const src = resolveMediaSrc(data.src, assets);
  const startFrom =
    data.startFrom != null
      ? Math.round((data.startFrom / 1000) * fps)
      : undefined;

  const crop = data.crop;
  const hasCrop = crop && (crop.x !== 50 || crop.y !== 50 || crop.scale !== 1);

  if (hasCrop) {
    return (
      <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        <Video
          src={src}
          startFrom={startFrom}
          volume={data.volume ?? 1}
          playbackRate={data.playbackRate ?? 1}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: `${crop.x}% ${crop.y}%`,
            transform: `scale(${crop.scale})`,
          }}
        />
      </div>
    );
  }

  return (
    <Video
      src={src}
      startFrom={startFrom}
      volume={data.volume ?? 1}
      playbackRate={data.playbackRate ?? 1}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      crossOrigin="anonymous"
    />
  );
});
