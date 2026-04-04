import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { MagazineWarningProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const CARD_W = 940;
const CARD_H = 1400;
const ITEM_STAGGER = 10;

const MagazineWarning: React.FC<MagazineWarningProps> = ({ title, items = [] }) => {
  const frame = useCurrentFrame();

  const cardSlide = paperSlide(frame, 0, 20, 'up');

  // Warning badge slams in
  const badgeScale = interpolate(frame, [10, 18, 24], [2.2, 0.95, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const badgeOpacity = interpolate(frame, [10, 14], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const titleReveal = editorialReveal(frame, 22, 15);

  // Red top bar draws
  const barProgress = interpolate(frame, [5, 20], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  const cardX = (CANVAS_W - CARD_W) / 2 + cardSlide.translateX;
  const cardY = (CANVAS_H - CARD_H) / 2 + cardSlide.translateY;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{ position: 'absolute', left: cardX, top: cardY, opacity: cardSlide.opacity }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.5} seed={340} width={CARD_W} height={CARD_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.15} seed="warning" />

            {/* Top red bar */}
            <div style={{
              position: 'absolute', top: 0, left: 0,
              width: `${barProgress * 100}%`, height: 6,
              backgroundColor: MAGAZINE_COLORS.accent, zIndex: 2,
            }} />

            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '60px 50px', boxSizing: 'border-box',
              display: 'flex', flexDirection: 'column',
            }}>
              {/* Warning badge */}
              <div style={{
                transform: `scale(${badgeScale})`, opacity: badgeOpacity,
                transformOrigin: 'left center', marginBottom: 24,
              }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 12,
                  backgroundColor: MAGAZINE_COLORS.accent,
                  padding: '10px 22px',
                }}>
                  {/* Triangle icon */}
                  <div style={{
                    width: 0, height: 0,
                    borderLeft: '10px solid transparent',
                    borderRight: '10px solid transparent',
                    borderBottom: '18px solid #ffffff',
                  }} />
                  <div style={{
                    fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.body,
                    fontWeight: 900, color: '#ffffff',
                    letterSpacing: '0.2em', textTransform: 'uppercase',
                  }}>
                    WARNING
                  </div>
                </div>
              </div>

              {/* Title */}
              <div style={{
                opacity: titleReveal.opacity,
                transform: `translateY(${titleReveal.translateY}px)`,
                marginBottom: 40,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h1,
                  fontWeight: 700, color: MAGAZINE_COLORS.text,
                  lineHeight: 1.2, letterSpacing: '-0.01em',
                }}>
                  {title}
                </div>
              </div>

              {/* Warning items */}
              {items.map((item, i) => {
                const reveal = editorialReveal(frame, 38 + i * ITEM_STAGGER, 12);
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 18, marginBottom: 26,
                    opacity: reveal.opacity,
                    transform: `translateY(${reveal.translateY}px)`,
                  }}>
                    {/* Red cross icon */}
                    <div style={{
                      fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h3,
                      fontWeight: 700, color: MAGAZINE_COLORS.accent,
                      lineHeight: 1.3, flexShrink: 0,
                    }}>
                      {'\u2717'}
                    </div>
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

export default MagazineWarning;
