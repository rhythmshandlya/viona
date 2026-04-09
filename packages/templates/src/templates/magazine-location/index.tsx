import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import type { MagazineLocationProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SectionLabel } from '../../magazine/typography';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';
import { ScaledContainer } from '../../magazine/ScaledContainer';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const CARD_W = 940;
const CARD_H = 1300;
const DETAIL_STAGGER = 8;

const MagazineLocation: React.FC<MagazineLocationProps> = ({ place, region, coordinates, details = [] }) => {
  const frame = useCurrentFrame();

  const cardSlide = paperSlide(frame, 0, 20, 'up');
  const labelReveal = editorialReveal(frame, 14, 12);

  // Pin icon drops in
  const pinScale = interpolate(frame, [18, 28], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  const pinOpacity = interpolate(frame, [18, 22], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const placeReveal = editorialReveal(frame, 25, 15);
  const regionReveal = editorialReveal(frame, 34, 12);
  const coordsReveal = editorialReveal(frame, 42, 12);

  // Accent rule
  const ruleProgress = interpolate(frame, [48, 60], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  const cardX = (CANVAS_W - CARD_W) / 2 + cardSlide.translateX;
  const cardY = (CANVAS_H - CARD_H) / 2 + cardSlide.translateY;

  return (
    <ScaledContainer baseWidth={1080} baseHeight={1920}>
      <div style={{ position: 'absolute', left: cardX, top: cardY, opacity: cardSlide.opacity }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.5} seed={370} width={CARD_W} height={CARD_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.15} seed="location" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '60px 55px', boxSizing: 'border-box',
              display: 'flex', flexDirection: 'column',
            }}>
              {/* Section label */}
              <div style={{
                opacity: labelReveal.opacity,
                transform: `translateY(${labelReveal.translateY}px)`,
              }}>
                <SectionLabel label="Location" />
              </div>

              {/* Pin icon */}
              <div style={{
                marginTop: 40, alignSelf: 'center',
                transform: `scale(${pinScale})`, opacity: pinOpacity,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50% 50% 50% 0',
                  backgroundColor: MAGAZINE_COLORS.accent,
                  transform: 'rotate(-45deg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    backgroundColor: '#ffffff', transform: 'rotate(45deg)',
                  }} />
                </div>
              </div>

              {/* Place name */}
              <div style={{
                marginTop: 32, alignSelf: 'center',
                opacity: placeReveal.opacity,
                transform: `translateY(${placeReveal.translateY}px)`,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.hero,
                  fontWeight: 900, color: MAGAZINE_COLORS.text,
                  lineHeight: 1.05, letterSpacing: '-0.03em', textAlign: 'center',
                }}>
                  {place}
                </div>
              </div>

              {/* Region */}
              {region && (
                <div style={{
                  marginTop: 10, alignSelf: 'center',
                  opacity: regionReveal.opacity,
                  transform: `translateY(${regionReveal.translateY}px)`,
                }}>
                  <div style={{
                    fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h3,
                    fontStyle: 'italic', color: MAGAZINE_COLORS.secondary,
                    textAlign: 'center',
                  }}>
                    {region}
                  </div>
                </div>
              )}

              {/* Coordinates */}
              {coordinates && (
                <div style={{
                  marginTop: 16, alignSelf: 'center',
                  opacity: coordsReveal.opacity,
                  transform: `translateY(${coordsReveal.translateY}px)`,
                }}>
                  <div style={{
                    fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.small,
                    color: MAGAZINE_COLORS.secondary,
                    letterSpacing: '0.08em',
                  }}>
                    {coordinates}
                  </div>
                </div>
              )}

              {/* Accent rule */}
              <div style={{
                marginTop: 36, marginBottom: 36, alignSelf: 'center',
                width: `${ruleProgress * 20}%`, height: 3,
                backgroundColor: MAGAZINE_COLORS.accent, borderRadius: 1.5,
              }} />

              {/* Detail lines */}
              {details.map((detail, i) => {
                const reveal = editorialReveal(frame, 58 + i * DETAIL_STAGGER, 12);
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20,
                    opacity: reveal.opacity,
                    transform: `translateY(${reveal.translateY}px)`,
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      backgroundColor: MAGAZINE_COLORS.accent, flexShrink: 0,
                    }} />
                    <div style={{
                      fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h4,
                      color: MAGAZINE_COLORS.text, lineHeight: 1.3,
                    }}>
                      {detail}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TornEdge>
      </div>
    </ScaledContainer>
  );
};

export default MagazineLocation;
