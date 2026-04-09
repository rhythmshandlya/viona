import React from 'react';
import { Video, Img } from 'remotion';
import { resolveMediaSrc } from '../resolveMediaSrc';
import type { BrollDisplayProps } from './types';
import { GrainOverlay } from './filters/GrainOverlay';

export const BrollRoundedFloat: React.FC<BrollDisplayProps> = ({ data, assets }) => {
  const src = resolveMediaSrc(data.src, assets);
  const t = data.treatment;
  const borderColor = t.borderColor || '#FFFFFF';
  const borderWidth = t.borderWidth || 6;
  const borderRadius = t.borderRadius || 16;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: borderColor }}>
      <div style={{ width: '90%', height: '55%', position: 'relative', overflow: 'hidden', borderRadius, border: `${borderWidth}px solid ${borderColor}`, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
        {data.mediaType === 'video' ? (
          <Video src={src} volume={0} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        {t.filter === 'grain' && <GrainOverlay intensity={t.filterIntensity} />}
      </div>
    </div>
  );
};
