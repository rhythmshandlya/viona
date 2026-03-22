import React from 'react';
import { random } from 'remotion';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../../magazine/constants';
import { PaperTexture } from '../../../magazine/textures';
import { TornEdge } from '../../../magazine/effects';
import { CheckMark } from './CheckMark';

const ITEM_W = 900;
const ITEM_H = 140;

export function ChecklistItem({
  text,
  checked,
  index,
  appearFrame,
  checkFrame,
}: {
  text: string;
  checked: boolean;
  index: number;
  appearFrame: number;
  checkFrame: number;
}) {
  const rotation = (random(`check-rot-${index}`) - 0.5) * 4;

  return (
    <div
      style={{
        width: ITEM_W,
        height: ITEM_H,
        transform: `rotate(${rotation}deg)`,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
        position: 'relative',
      }}
    >
      <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={index * 11 + 7} width={ITEM_W} height={ITEM_H}>
        <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <PaperTexture age={0.2 + random(`check-age-${index}`) * 0.3} seed={`check-${index}`} />
          <div style={{
            position: 'relative', zIndex: 1, width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', padding: '0 32px', gap: 20, boxSizing: 'border-box',
          }}>
            <CheckMark appearFrame={checkFrame} checked={checked} />
            {!checked && (
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                border: `2px solid ${MAGAZINE_COLORS.secondary}`, flexShrink: 0,
              }} />
            )}
            <div style={{
              fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.large,
              color: MAGAZINE_COLORS.text, lineHeight: 1.3,
            }}>
              {text}
            </div>
          </div>
        </div>
      </TornEdge>
    </div>
  );
}
