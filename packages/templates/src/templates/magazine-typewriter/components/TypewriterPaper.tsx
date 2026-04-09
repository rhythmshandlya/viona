import React from 'react';
import { PaperTexture } from '../../../magazine/textures';
import { TornEdge } from '../../../magazine/effects';
import { MAGAZINE_COLORS } from '../../../magazine/constants';

interface TypewriterPaperProps {
  translateY: number;
  children: React.ReactNode;
}

const CARD_W = 920;
const CARD_H = 1100;
const CANVAS_W = 1080;

export { CARD_W, CARD_H };

/**
 * Torn-edge paper card with texture, red margin line, and hole-punch dots.
 */
export function TypewriterPaper({ translateY, children }: TypewriterPaperProps) {
  return (
    <div style={{
      position: 'absolute',
      left: (CANVAS_W - CARD_W) / 2,
      top: 380 + translateY,
      filter: 'drop-shadow(0 8px 30px rgba(0,0,0,0.25))',
    }}>
      <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.35} seed={500} width={CARD_W} height={CARD_H}>
        <div style={{ width: CARD_W, height: CARD_H, position: 'relative', overflow: 'hidden' }}>
          <PaperTexture age={0.15} seed="typewriter-sheet" />

          {/* Red margin line */}
          <div style={{
            position: 'absolute', left: 90, top: 0, width: 2, height: '100%',
            backgroundColor: MAGAZINE_COLORS.accent, opacity: 0.25,
          }} />

          {/* Horizontal ruled lines */}
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} style={{
              position: 'absolute', left: 0, right: 0,
              top: 60 + i * 58,
              height: 1,
              backgroundColor: '#94a3b8', opacity: 0.12,
            }} />
          ))}

          {/* Hole punches */}
          {[200, 550, 900].map(y => (
            <div key={y} style={{
              position: 'absolute', left: 28, top: y,
              width: 24, height: 24, borderRadius: '50%',
              border: `1px solid rgba(0,0,0,0.08)`,
              backgroundColor: 'rgba(0,0,0,0.03)',
            }} />
          ))}

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
            {children}
          </div>
        </div>
      </TornEdge>
    </div>
  );
}
