import React from 'react';
import { Video, Img } from 'remotion';
import { resolveMediaSrc } from '../resolveMediaSrc';
import type { BrollDisplayProps } from './types';
import { GrainOverlay } from './filters/GrainOverlay';

export const BrollGrid: React.FC<BrollDisplayProps> = ({ data, assets }) => {
  const srcs = [data.src, ...(data.additionalSrcs || [])].slice(0, 4);
  const t = data.treatment;
  const gap = t.borderWidth || 4;
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{ width: '100%', height: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap, background: t.borderColor || '#FFFFFF' }}>
        {srcs.map((s, i) => {
          const resolved = resolveMediaSrc(s, assets);
          return (
            <div key={i} style={{ position: 'relative', overflow: 'hidden', borderRadius: t.borderRadius || 0 }}>
              {data.mediaType === 'video' ? (
                <Video src={resolved} volume={0} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Img src={resolved} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </div>
          );
        })}
      </div>
      {t.filter === 'grain' && <GrainOverlay intensity={t.filterIntensity} />}
    </div>
  );
};
