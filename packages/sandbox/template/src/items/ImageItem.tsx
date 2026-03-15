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
  let src: string;
  if (assets[data.src]) {
    src = assets[data.src];
  } else if (/^https?:\/\/|^blob:/.test(data.src)) {
    src = data.src;
  } else {
    src = staticFile(data.src);
  }

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
