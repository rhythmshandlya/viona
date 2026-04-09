import React from 'react';
import { Video, Img } from 'remotion';
import { resolveMediaSrc } from '../resolveMediaSrc';
import type { BrollDisplayProps } from './types';
import { GrainOverlay } from './filters/GrainOverlay';

export const BrollLetterboxedCaptions: React.FC<BrollDisplayProps> = ({ data, assets }) => {
  const src = resolveMediaSrc(data.src, assets);
  const t = data.treatment;
  const borderColor = t.borderColor || '#FFFFFF';
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: borderColor }}>
      <div style={{ width: '100%', height: '25%' }} />
      <div style={{ width: '100%', height: '40%', position: 'relative', overflow: 'hidden', borderRadius: t.borderRadius || 0 }}>
        {data.mediaType === 'video' ? (
          <Video src={src} volume={0} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        {t.filter === 'grain' && <GrainOverlay intensity={t.filterIntensity} />}
      </div>
      <div style={{ width: '100%', height: '35%' }} />
    </div>
  );
};
