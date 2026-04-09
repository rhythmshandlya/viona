import React from 'react';
import { Video, Img } from 'remotion';
import { resolveMediaSrc } from '../resolveMediaSrc';
import type { BrollDisplayProps } from './types';
import { GrainOverlay } from './filters/GrainOverlay';
import { VhsEffect } from './filters/VhsEffect';

export const BrollFilmTreatment: React.FC<BrollDisplayProps> = ({ data, assets }) => {
  const src = resolveMediaSrc(data.src, assets);
  const t = data.treatment;
  const filterType = t.filter || 'grain';
  const intensity = t.filterIntensity ?? 0.3;
  let cssFilter = '';
  if (filterType === 'desaturated') cssFilter = `saturate(${1 - intensity})`;
  if (filterType === 'duotone') cssFilter = `saturate(0) sepia(${intensity}) hue-rotate(180deg)`;
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <div style={{ width: '100%', height: '100%', filter: cssFilter || undefined }}>
        {data.mediaType === 'video' ? (
          <Video src={src} volume={0} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>
      {filterType === 'grain' && <GrainOverlay intensity={intensity} />}
      {filterType === 'vhs' && <VhsEffect intensity={intensity} />}
    </div>
  );
};
