import React from 'react';
import { Img, staticFile } from 'remotion';

interface ImageItemData {
  src: string;
}

interface ImageItemProps {
  data: ImageItemData;
  assets: Record<string, string>;
}

export const ImageItem: React.FC<ImageItemProps> = ({ data, assets }) => {
  const src = assets[data.src] || staticFile(data.src);

  return (
    <Img
      src={src}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
      }}
    />
  );
};
