import React from 'react';
import { Video, Img } from 'remotion';
import { resolveMediaSrc } from '../resolveMediaSrc';
import type { BrollDisplayProps } from './types';
import { GrainOverlay } from './filters/GrainOverlay';

export const BrollTripleStack: React.FC<BrollDisplayProps> = ({ data, assets }) => {
  const srcs = [data.src, ...(data.additionalSrcs || [])].slice(0, 3);
  const t = data.treatment;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {srcs.map((s, i) => {
        const resolved = resolveMediaSrc(s, assets);
        return (
          <div key={i} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {data.mediaType === 'video' ? (
              <Video src={resolved} volume={0} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Img src={resolved} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </div>
        );
      })}
      {t.filter === 'grain' && <GrainOverlay intensity={t.filterIntensity} />}
    </div>
  );
};
