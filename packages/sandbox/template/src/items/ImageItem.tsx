import React from 'react';
import { Img } from 'remotion';
import { resolveMediaSrc } from './resolveMediaSrc';

interface ImageItemData {
  src: string;
}

interface ImageItemProps {
  data: ImageItemData;
  assets: Record<string, string>;
}

export const ImageItem: React.FC<ImageItemProps> = ({ data, assets }) => {
  const src = resolveMediaSrc(data.src, assets);

  return (
    <Img
      src={src}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      }}
    />
  );
};
