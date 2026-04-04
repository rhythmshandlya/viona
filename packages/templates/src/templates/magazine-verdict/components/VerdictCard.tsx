import React from 'react';
import { PaperTexture } from '../../../magazine/textures';
import { TornEdge } from '../../../magazine/effects';

const CARD_W = 940;
const CARD_H = 1500;

export function VerdictCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: CARD_W, height: CARD_H,
      filter: 'drop-shadow(0 6px 30px rgba(0,0,0,0.5))',
      position: 'relative',
    }}>
      <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.5} seed={230} width={CARD_W} height={CARD_H}>
        <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <PaperTexture age={0.15} seed="verdict" />
          <div style={{
            position: 'relative', zIndex: 1, width: '100%', height: '100%',
            padding: '60px 50px', boxSizing: 'border-box',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            {children}
          </div>
        </div>
      </TornEdge>
    </div>
  );
}
