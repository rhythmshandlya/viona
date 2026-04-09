import React from 'react';
import { Video, Img } from 'remotion';
import { resolveMediaSrc } from '../resolveMediaSrc';
import type { BrollDisplayProps } from './types';
import { GrainOverlay } from './filters/GrainOverlay';

export const BrollPolaroid: React.FC<BrollDisplayProps> = ({ data, assets }) => {
  const src = resolveMediaSrc(data.src, assets);
  const t = data.treatment;
  const tilt = t.tilt || 0;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f0' }}>
      <div style={{ width: '80%', background: '#FFFFFF', padding: '24px 24px 64px 24px', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', transform: `rotate(${tilt}deg)` }}>
        <div style={{ position: 'relative', overflow: 'hidden', aspectRatio: '4/3' }}>
          {data.mediaType === 'video' ? (
            <Video src={src} volume={0} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          {t.filter === 'grain' && <GrainOverlay intensity={t.filterIntensity} />}
        </div>
      </div>
    </div>
  );
};
