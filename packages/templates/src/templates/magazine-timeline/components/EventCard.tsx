import React from 'react';
import { random } from 'remotion';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../../magazine/constants';
import { PaperTexture } from '../../../magazine/textures';
import { TornEdge } from '../../../magazine/effects';

const CARD_W = 440;
const CARD_H = 200;

export function EventCard({ year, text, index }: { year: string; text: string; index: number }) {
  const rotation = (random(`event-rot-${index}`) - 0.5) * 6;
  return (
    <div style={{
      width: CARD_W, height: CARD_H,
      transform: `rotate(${rotation}deg)`,
      filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
      position: 'relative',
    }}>
      <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.5} seed={index * 13 + 5} width={CARD_W} height={CARD_H}>
        <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <PaperTexture age={0.25 + random(`event-age-${index}`) * 0.35} seed={`event-${index}`} />
          <div style={{
            position: 'relative', zIndex: 1, width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            padding: 24, boxSizing: 'border-box',
          }}>
            <div style={{
              fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h1,
              fontWeight: 900, color: MAGAZINE_COLORS.stamp,
              lineHeight: 1.0, letterSpacing: '-0.02em',
            }}>{year}</div>
            <div style={{
              fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.large,
              color: MAGAZINE_COLORS.text, lineHeight: 1.3, marginTop: 8,
            }}>{text}</div>
          </div>
        </div>
      </TornEdge>
    </div>
  );
}
