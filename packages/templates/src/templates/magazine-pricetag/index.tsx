import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { MagazinePricetagProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SectionLabel } from '../../magazine/typography';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const CARD_W = 940;
const CARD_H = 1400;
const ITEM_STAGGER = 8;

const MagazinePricetag: React.FC<MagazinePricetagProps> = ({ label, price, breakdown = [] }) => {
  const frame = useCurrentFrame();

  const cardSlide = paperSlide(frame, 0, 20, 'up');
  const labelReveal = editorialReveal(frame, 15, 12);

  // Price snaps in with scale
  const priceScale = interpolate(frame, [22, 34], [1.4, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  const priceOpacity = interpolate(frame, [22, 28], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Rule draws
  const ruleProgress = interpolate(frame, [35, 48], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  const cardX = (CANVAS_W - CARD_W) / 2 + cardSlide.translateX;
  const cardY = (CANVAS_H - CARD_H) / 2 + cardSlide.translateY;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{ position: 'absolute', left: cardX, top: cardY, opacity: cardSlide.opacity }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.5} seed={330} width={CARD_W} height={CARD_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.15} seed="pricetag" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '60px 50px', boxSizing: 'border-box',
              display: 'flex', flexDirection: 'column',
            }}>
              {/* Label */}
              <div style={{
                opacity: labelReveal.opacity,
                transform: `translateY(${labelReveal.translateY}px)`,
              }}>
                <SectionLabel label={label} />
              </div>

              {/* Large price figure */}
              <div style={{
                marginTop: 50, alignSelf: 'center',
                transform: `scale(${priceScale})`, opacity: priceOpacity,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.hero,
                  fontWeight: 900, color: MAGAZINE_COLORS.accent,
                  lineHeight: 1.05, letterSpacing: '-0.03em', textAlign: 'center',
                }}>
                  {price}
                </div>
              </div>

              {/* Accent rule */}
              <div style={{
                marginTop: 45, marginBottom: 45, alignSelf: 'center',
                width: `${ruleProgress * 30}%`, height: 3,
                backgroundColor: MAGAZINE_COLORS.accent, borderRadius: 1.5,
              }} />

              {/* Breakdown items */}
              {breakdown.map((item, i) => {
                const reveal = editorialReveal(frame, 48 + i * ITEM_STAGGER, 12);
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 18, marginBottom: 22,
                    opacity: reveal.opacity,
                    transform: `translateY(${reveal.translateY}px)`,
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      backgroundColor: MAGAZINE_COLORS.accent, flexShrink: 0,
                      marginTop: 10,
                    }} />
                    <div style={{
                      fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h3,
                      color: MAGAZINE_COLORS.text, lineHeight: 1.4,
                    }}>
                      {item}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TornEdge>
      </div>
    </AbsoluteFill>
  );
};

export default MagazinePricetag;
