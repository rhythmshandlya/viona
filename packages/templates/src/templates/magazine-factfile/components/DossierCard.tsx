import React from 'react';
import { PaperTexture } from '../../../magazine/textures';
import { TornEdge } from '../../../magazine/effects';
import { PaperClip } from './PaperClip';

const CARD_W = 940;
const CARD_H = 1400;

export function DossierCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: CARD_W, height: CARD_H,
      transform: 'rotate(1.5deg)',
      filter: 'drop-shadow(0 6px 30px rgba(0,0,0,0.5))',
      position: 'relative',
    }}>
      <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.6} seed={333} width={CARD_W} height={CARD_H}>
        <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <PaperTexture age={0.2} seed="dossier" />
          <div style={{
            position: 'relative', zIndex: 1, width: '100%', height: '100%',
            padding: '60px 50px', boxSizing: 'border-box',
          }}>
            {children}
          </div>
        </div>
      </TornEdge>
      <PaperClip />
    </div>
  );
}
