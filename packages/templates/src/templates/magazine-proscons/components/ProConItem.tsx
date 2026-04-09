import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../../magazine/constants';
import { magazineEasing } from '../../../magazine/animations';
import { PaperTexture } from '../../../magazine/textures';
import { TornEdge } from '../../../magazine/effects';

const PRO_COLOR = '#16a34a';

export function ProConItem({
  text, type, revealFrame, width, index,
}: {
  text: string; type: 'pro' | 'con'; revealFrame: number; width: number; index: number;
}) {
  const frame = useCurrentFrame();
  const isPro = type === 'pro';
  const color = isPro ? PRO_COLOR : MAGAZINE_COLORS.accent;
  const icon = isPro ? '\u2713' : '\u2717';

  const opacity = interpolate(frame, [revealFrame, revealFrame + 12], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  const translateX = interpolate(
    frame,
    [revealFrame, revealFrame + 14],
    [isPro ? -60 : 60, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing },
  );

  return (
    <div style={{
      opacity,
      transform: `translateX(${translateX}px)`,
      marginBottom: 16,
      filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.15))',
    }}>
      <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.3} seed={300 + index + (isPro ? 0 : 50)} width={width} height={100}>
        <div style={{ width, height: 100, position: 'relative', overflow: 'hidden' }}>
          <PaperTexture age={0.08} seed={`${type}-${index}`} />
          <div style={{
            position: 'relative', zIndex: 1, width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', gap: 20,
            padding: '0 28px', boxSizing: 'border-box',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              backgroundColor: color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <div style={{
                fontFamily: MAGAZINE_FONTS.accent, fontSize: 24,
                fontWeight: 700, color: '#ffffff', lineHeight: 1,
              }}>
                {icon}
              </div>
            </div>
            <div style={{
              fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.body,
              color: MAGAZINE_COLORS.text, lineHeight: 1.35,
            }}>
              {text}
            </div>
          </div>
        </div>
      </TornEdge>
    </div>
  );
}
