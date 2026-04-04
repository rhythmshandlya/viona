import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { MagazineMythfactProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SectionLabel } from '../../magazine/typography';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const CARD_W = 940;
const CARD_H = 1500;

const MagazineMythfact: React.FC<MagazineMythfactProps> = ({ topic, myth, fact }) => {
  const frame = useCurrentFrame();

  const cardSlide = paperSlide(frame, 0, 20, 'up');
  const topicReveal = editorialReveal(frame, 15, 12);
  const mythReveal = editorialReveal(frame, 20, 15);

  const strikeProgress = interpolate(frame, [40, 55], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  const mythFade = interpolate(frame, [45, 55], [1, 0.4], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const dividerProgress = interpolate(frame, [55, 65], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  const factLabelReveal = editorialReveal(frame, 60, 12);
  const factReveal = editorialReveal(frame, 68, 15);

  const cardX = (CANVAS_W - CARD_W) / 2 + cardSlide.translateX;
  const cardY = (CANVAS_H - CARD_H) / 2 + cardSlide.translateY;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{ position: 'absolute', left: cardX, top: cardY, opacity: cardSlide.opacity }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.5} seed={240} width={CARD_W} height={CARD_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.2} seed="mythfact" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '80px 60px', boxSizing: 'border-box',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{
                opacity: topicReveal.opacity,
                transform: `translateY(${topicReveal.translateY}px)`,
              }}>
                <SectionLabel label={topic} />
              </div>

              <div style={{
                marginTop: 60,
                opacity: mythReveal.opacity,
                transform: `translateY(${mythReveal.translateY}px)`,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.small,
                  fontWeight: 700, color: MAGAZINE_COLORS.accent,
                  letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16,
                }}>
                  MYTH
                </div>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h1,
                    fontWeight: 700, color: MAGAZINE_COLORS.text,
                    lineHeight: 1.3, opacity: mythFade,
                  }}>
                    {myth}
                  </div>
                  {strikeProgress > 0 && (
                    <div style={{
                      position: 'absolute', top: '50%', left: 0,
                      width: `${strikeProgress * 100}%`, height: 4,
                      backgroundColor: MAGAZINE_COLORS.accent,
                      borderRadius: 2, transform: 'translateY(-50%)',
                    }} />
                  )}
                </div>
              </div>

              <div style={{
                marginTop: 50, marginBottom: 50,
                width: `${dividerProgress * 100}%`, height: 2,
                backgroundColor: MAGAZINE_COLORS.secondary, opacity: 0.2,
              }} />

              <div style={{
                opacity: factLabelReveal.opacity,
                transform: `translateY(${factLabelReveal.translateY}px)`,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.small,
                  fontWeight: 700, color: '#16a34a',
                  letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16,
                }}>
                  FACT
                </div>
              </div>
              <div style={{
                opacity: factReveal.opacity,
                transform: `translateY(${factReveal.translateY}px)`,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h2,
                  color: MAGAZINE_COLORS.text, lineHeight: 1.4,
                }}>
                  {fact}
                </div>
              </div>
            </div>
          </div>
        </TornEdge>
      </div>
    </AbsoluteFill>
  );
};

export default MagazineMythfact;
