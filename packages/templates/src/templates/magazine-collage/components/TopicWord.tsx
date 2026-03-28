import React from 'react';
import { FONT_SIZES } from '../../../magazine/constants';
import { PaperTexture } from '../../../magazine/textures';
import { TornEdge } from '../../../magazine/effects';
import { SerifHeadline } from '../../../magazine/typography';

/**
 * The central topic text on the largest paper scrap.
 * Uses SerifHeadline at hero * 1.5 size, wrapped in TornEdge with PaperTexture.
 */
export function TopicWord({
  topic,
  width,
  height,
}: {
  topic: string;
  width: number;
  height: number;
}) {
  return (
    <div
      style={{
        width,
        height,
        filter: 'drop-shadow(0 6px 30px rgba(0,0,0,0.5))',
        position: 'relative',
      }}
    >
      <TornEdge
        edges={['top', 'bottom', 'left', 'right']}
        roughness={0.7}
        seed={999}
        width={width}
        height={height}
      >
        <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <PaperTexture age={0.2} seed="topic" />
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 32,
              boxSizing: 'border-box',
            }}
          >
            <SerifHeadline
              text={topic}
              size={Math.round(FONT_SIZES.hero * 1.5)}
            />
          </div>
        </div>
      </TornEdge>
    </div>
  );
}
