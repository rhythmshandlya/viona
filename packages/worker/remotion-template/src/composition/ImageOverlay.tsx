import React from 'react';
import { Img } from 'remotion';
import { resolveVideoSrc } from './utils';

interface ImageOverlayProps {
  data: {
    src: string;
  };
}

export const ImageOverlay: React.FC<ImageOverlayProps> = ({ data }) => {
  return (
    <Img
      src={resolveVideoSrc(data.src)!}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
      }}
    />
  );
};
