import React from 'react';
import { Video, Img } from 'remotion';
import { resolveMediaSrc } from '../resolveMediaSrc';
import type { BrollDisplayProps } from './types';
import { GrainOverlay } from './filters/GrainOverlay';

export const BrollSpeakerPip: React.FC<BrollDisplayProps> = ({ data, assets }) => {
  const src = resolveMediaSrc(data.src, assets);
  const t = data.treatment;
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {data.mediaType === 'video' ? (
        <Video src={src} volume={0} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      {t.filter === 'grain' && <GrainOverlay intensity={t.filterIntensity} />}
    </div>
  );
};
