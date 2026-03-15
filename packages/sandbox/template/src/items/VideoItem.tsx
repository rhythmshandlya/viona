import React from 'react';
import { Video, staticFile } from 'remotion';

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
  // Resolve src: check assets map first (e.g. "source.mp4" → presigned URL),
  // then handle http(s)/blob URLs directly, fallback to staticFile for local paths
  let src: string;
  if (assets[data.src]) {
    src = assets[data.src];
  } else if (/^https?:\/\/|^blob:/.test(data.src)) {
    src = data.src;
  } else {
    src = staticFile(data.src);
  }
  const startFrom = data.startFrom
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
