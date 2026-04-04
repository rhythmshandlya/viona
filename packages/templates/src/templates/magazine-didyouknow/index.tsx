import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { MagazineDidyouknowProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SectionLabel } from '../../magazine/typography';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const CARD_W = 940;
const CARD_H = 1200;

const MagazineDidyouknow: React.FC<MagazineDidyouknowProps> = ({ fact, source }) => {
  const frame = useCurrentFrame();

  const cardSlide = paperSlide(frame, 0, 20, 'up');
  const questionReveal = editorialReveal(frame, 8, 15);

  // "DID YOU KNOW?" label
  const labelReveal = editorialReveal(frame, 18, 12);

  // Accent rule draws in
  const ruleProgress = interpolate(frame, [28, 42], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  // Fact text
  const factReveal = editorialReveal(frame, 35, 18);

  // Source
  const sourceReveal = editorialReveal(frame, 55, 12);

  const cardX = (CANVAS_W - CARD_W) / 2 + cardSlide.translateX;
  const cardY = (CANVAS_H - CARD_H) / 2 + cardSlide.translateY;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{ position: 'absolute', left: cardX, top: cardY, opacity: cardSlide.opacity }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.5} seed={300} width={CARD_W} height={CARD_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.1} seed="didyouknow" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '70px 55px', boxSizing: 'border-box',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
              {/* Large decorative "?" */}
              <div style={{
                fontFamily: MAGAZINE_FONTS.headline, fontSize: 280,
                fontWeight: 900, color: MAGAZINE_COLORS.accent,
                lineHeight: 0.7, opacity: questionReveal.opacity * 0.1,
                transform: `translateY(${questionReveal.translateY}px)`,
                userSelect: 'none', position: 'absolute', right: 40, top: 50,
              }}>
                ?
              </div>

              {/* Section label */}
              <div style={{
                opacity: labelReveal.opacity,
                transform: `translateY(${labelReveal.translateY}px)`,
              }}>
                <SectionLabel label="Did You Know?" />
              </div>

              {/* Accent rule */}
              <div style={{
                marginTop: 32, marginBottom: 32, alignSelf: 'center',
                width: `${ruleProgress * 15}%`, height: 3,
                backgroundColor: MAGAZINE_COLORS.accent, borderRadius: 1.5,
              }} />

              {/* Fact text */}
              <div style={{
                opacity: factReveal.opacity,
                transform: `translateY(${factReveal.translateY}px)`,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h2,
                  fontWeight: 700, color: MAGAZINE_COLORS.text,
                  lineHeight: 1.4, textAlign: 'center',
                }}>
                  {fact}
                </div>
              </div>

              {/* Source */}
              {source && (
                <div style={{
                  marginTop: 36, alignSelf: 'center',
                  opacity: sourceReveal.opacity,
                  transform: `translateY(${sourceReveal.translateY}px)`,
                }}>
                  <div style={{
                    fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.small,
                    fontWeight: 700, color: MAGAZINE_COLORS.secondary,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                  }}>
                    Source: {source}
                  </div>
                </div>
              )}
            </div>
          </div>
        </TornEdge>
      </div>
    </AbsoluteFill>
  );
};

export default MagazineDidyouknow;
