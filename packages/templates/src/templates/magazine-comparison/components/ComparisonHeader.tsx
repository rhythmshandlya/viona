import React from 'react';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../../magazine/constants';
import { PaperTexture } from '../../../magazine/textures';
import { TornEdge } from '../../../magazine/effects';

const HEADER_W = 960;
const HEADER_H = 140;

export function ComparisonHeader({ leftLabel, rightLabel }: { leftLabel: string; rightLabel: string }) {
  return (
    <div style={{
      width: HEADER_W, height: HEADER_H,
      filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
      position: 'relative',
    }}>
      <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={55} width={HEADER_W} height={HEADER_H}>
        <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <PaperTexture age={0.15} seed="comp-header" />
          <div style={{
            position: 'relative', zIndex: 1, width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', padding: '0 40px', boxSizing: 'border-box',
          }}>
            <div style={{
              flex: 1, fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h2,
              fontWeight: 700, color: MAGAZINE_COLORS.text, letterSpacing: '-0.02em',
            }}>{leftLabel}</div>
            <div style={{
              width: 3, height: '60%', backgroundColor: MAGAZINE_COLORS.accent,
              borderRadius: 1.5, flexShrink: 0, margin: '0 20px',
            }} />
            <div style={{
              flex: 1, fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h2,
              fontWeight: 700, color: MAGAZINE_COLORS.text, letterSpacing: '-0.02em', textAlign: 'right',
            }}>{rightLabel}</div>
          </div>
        </div>
      </TornEdge>
    </div>
  );
}
