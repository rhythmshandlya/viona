import React from 'react';
import { random } from 'remotion';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../../magazine/constants';
import { PaperTexture } from '../../../magazine/textures';
import { TornEdge } from '../../../magazine/effects';

const ITEM_W = 920;
const ITEM_H = 160;

export function RankItem({
  rank, text, detail, index,
}: {
  rank: number; text: string; detail?: string; index: number;
}) {
  const rotation = (random(`rank-rot-${index}`) - 0.5) * 3;

  return (
    <div style={{
      width: ITEM_W, height: ITEM_H,
      transform: `rotate(${rotation}deg)`,
      filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
      position: 'relative',
    }}>
      <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={index * 13 + 5} width={ITEM_W} height={ITEM_H}>
        <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <PaperTexture age={0.15 + random(`rank-age-${index}`) * 0.2} seed={`rank-${index}`} />
          <div style={{
            position: 'relative', zIndex: 1, width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', padding: '0 32px', gap: 24, boxSizing: 'border-box',
          }}>
            <div style={{
              fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.hero,
              fontWeight: 900, color: MAGAZINE_COLORS.accent,
              lineHeight: 1, minWidth: 80, textAlign: 'center',
              letterSpacing: '-0.02em',
            }}>
              {rank}
            </div>
            <div style={{
              width: 2, height: ITEM_H * 0.5,
              backgroundColor: MAGAZINE_COLORS.accent, opacity: 0.3,
              borderRadius: 1, flexShrink: 0,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h3,
                fontWeight: 700, color: MAGAZINE_COLORS.text,
                lineHeight: 1.2, letterSpacing: '-0.01em',
              }}>
                {text}
              </div>
              {detail && (
                <div style={{
                  fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.small,
                  color: MAGAZINE_COLORS.secondary, marginTop: 4, lineHeight: 1.3,
                }}>
                  {detail}
                </div>
              )}
            </div>
          </div>
        </div>
      </TornEdge>
    </div>
  );
}
