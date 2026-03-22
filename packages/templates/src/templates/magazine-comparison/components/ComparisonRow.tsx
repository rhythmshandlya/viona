import React from 'react';
import { random } from 'remotion';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../../magazine/constants';
import { PaperTexture } from '../../../magazine/textures';
import { TornEdge } from '../../../magazine/effects';

const ROW_W = 460;
const ROW_H = 180;

export function ComparisonRow({ text, side, index }: { text: string; side: 'left' | 'right'; index: number }) {
  const seedBase = side === 'left' ? index * 2 : index * 2 + 1;
  const rotation = (random(`comp-rot-${seedBase}`) - 0.5) * 4;
  return (
    <div style={{
      width: ROW_W, height: ROW_H,
      transform: `rotate(${rotation}deg)`,
      filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
      position: 'relative',
    }}>
      <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={seedBase * 7 + 11} width={ROW_W} height={ROW_H}>
        <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <PaperTexture age={0.2 + random(`comp-age-${seedBase}`) * 0.3} seed={`comp-${seedBase}`} />
          <div style={{
            position: 'relative', zIndex: 1, width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24, boxSizing: 'border-box',
          }}>
            <div style={{
              fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h3,
              fontWeight: 700, color: MAGAZINE_COLORS.text,
              lineHeight: 1.3, textAlign: 'center',
            }}>{text}</div>
          </div>
        </div>
      </TornEdge>
    </div>
  );
}
