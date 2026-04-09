import React from 'react';
import { Video, Img } from 'remotion';
import { resolveMediaSrc } from '../resolveMediaSrc';
import type { BrollDisplayProps } from './types';
import { GrainOverlay } from './filters/GrainOverlay';
import { RoughEdgeMask } from './filters/RoughEdgeMask';

export const BrollLetterboxed: React.FC<BrollDisplayProps> = ({ data, assets }) => {
  const src = resolveMediaSrc(data.src, assets);
  const t = data.treatment;
  const borderColor = t.borderColor || '#FFFFFF';
  const clipHeight = '31.6%';
  const barHeight = '34.2%';
  const filterId = 'broll-letterbox-rough';
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: borderColor }}>
      {t.roughEdges && <RoughEdgeMask filterId={filterId} />}
      <div style={{ width: '100%', height: barHeight }} />
      <div
        style={{
          width: '100%', height: clipHeight, position: 'relative', overflow: 'hidden',
          borderRadius: t.borderRadius || 0,
          ...(t.roughEdges ? { filter: `url(#${filterId})` } : {}),
        }}
      >
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
