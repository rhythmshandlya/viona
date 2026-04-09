import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../../magazine/constants';
import { magazineEasing } from '../../../magazine/animations';
import { PaperTexture } from '../../../magazine/textures';
import { TornEdge } from '../../../magazine/effects';

export function StepCircle({
  stepNumber, label, description, revealFrame, cardWidth,
}: {
  stepNumber: number; label: string; description?: string; revealFrame: number; cardWidth: number;
}) {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [revealFrame, revealFrame + 12], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  const translateY = interpolate(frame, [revealFrame, revealFrame + 14], [30, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  const scaleCircle = interpolate(frame, [revealFrame, revealFrame + 10], [0.3, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  const CARD_H = description ? 160 : 120;

  return (
    <div style={{
      opacity,
      transform: `translateY(${translateY}px)`,
      display: 'flex', alignItems: 'center', gap: 0,
    }}>
      {/* Number circle — overlaps the card edge */}
      <div style={{
        width: 68, height: 68, borderRadius: '50%',
        backgroundColor: MAGAZINE_COLORS.accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, zIndex: 2, position: 'relative',
        transform: `scale(${scaleCircle})`,
        boxShadow: '0 3px 12px rgba(225,29,72,0.35)',
      }}>
        <div style={{
          fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h2,
          fontWeight: 700, color: '#ffffff', lineHeight: 1,
        }}>
          {stepNumber}
        </div>
      </div>

      {/* Card — shifted left so circle overlaps */}
      <div style={{
        marginLeft: -20, flex: 1,
        filter: 'drop-shadow(0 3px 10px rgba(0,0,0,0.12))',
      }}>
        <TornEdge edges={['top', 'bottom', 'right']} roughness={0.3} seed={400 + stepNumber} width={cardWidth} height={CARD_H}>
          <div style={{ width: cardWidth, height: CARD_H, position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.06} seed={`step-${stepNumber}`} />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
              padding: '0 40px 0 50px', boxSizing: 'border-box',
            }}>
              <div style={{
                fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h3,
                fontWeight: 700, color: MAGAZINE_COLORS.text,
                lineHeight: 1.25, letterSpacing: '-0.01em',
              }}>
                {label}
              </div>
              {description && (
                <div style={{
                  fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.body,
                  color: MAGAZINE_COLORS.secondary, marginTop: 8, lineHeight: 1.35,
                }}>
                  {description}
                </div>
              )}
            </div>
          </div>
        </TornEdge>
      </div>
    </div>
  );
}
