import React from 'react';
import { Img } from 'remotion';
import { resolveVideoSrc } from './utils';

interface ImageOverlayProps {
  data: {
    src: string;
  };
}

export const ImageOverlay: React.FC<ImageOverlayProps> = ({ data }) => {
  const src = resolveVideoSrc(data.src);
  if (!src) return null;

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
