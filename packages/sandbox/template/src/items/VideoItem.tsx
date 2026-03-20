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
  fadeInMs?: number;
  fadeOutMs?: number;
  crop?: VideoCrop;
}

interface VideoItemProps {
  data: VideoItemData;
  assets: Record<string, string>;
  fps: number;
  durationInFrames: number;
}

export const VideoItem: React.FC<VideoItemProps> = ({
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

  const videoElement = (
    <Video
      src={src}
      startFrom={startFrom}
      volume={data.volume ?? 1}
      playbackRate={data.playbackRate ?? 1}
      style={
        data.crop
          ? {
              position: 'absolute',
              width: `${100 * data.crop.scale}%`,
              height: `${100 * data.crop.scale}%`,
              left: `${50 - data.crop.x * data.crop.scale}%`,
              top: `${50 - data.crop.y * data.crop.scale}%`,
            }
          : {
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }
      }
    />
  );

  if (data.crop) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {videoElement}
      </div>
    );
  }

  return videoElement;
};
