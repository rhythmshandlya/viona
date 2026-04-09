import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import type { MagazineProfileProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SectionLabel } from '../../magazine/typography';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';
import { ScaledContainer } from '../../magazine/ScaledContainer';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const CARD_W = 940;
const CARD_H = 1400;
const AVATAR_SIZE = 160;
const DETAIL_STAGGER = 8;

const MagazineProfile: React.FC<MagazineProfileProps> = ({ name, title, details = [], initials }) => {
  const frame = useCurrentFrame();

  const cardSlide = paperSlide(frame, 0, 20, 'up');
  const labelReveal = editorialReveal(frame, 14, 12);

  // Avatar circle scales in
  const avatarScale = interpolate(frame, [18, 30], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  const avatarOpacity = interpolate(frame, [18, 24], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const nameReveal = editorialReveal(frame, 28, 15);
  const titleReveal = editorialReveal(frame, 36, 12);

  // Accent rule
  const ruleProgress = interpolate(frame, [42, 55], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  const cardX = (CANVAS_W - CARD_W) / 2 + cardSlide.translateX;
  const cardY = (CANVAS_H - CARD_H) / 2 + cardSlide.translateY;

  return (
    <ScaledContainer baseWidth={1080} baseHeight={1920}>
      <div style={{ position: 'absolute', left: cardX, top: cardY, opacity: cardSlide.opacity }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.5} seed={310} width={CARD_W} height={CARD_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.15} seed="profile" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '60px 55px', boxSizing: 'border-box',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}>
              {/* Section label */}
              <div style={{
                width: '100%',
                opacity: labelReveal.opacity,
                transform: `translateY(${labelReveal.translateY}px)`,
              }}>
                <SectionLabel label="Profile" />
              </div>

              {/* Avatar circle with initials */}
              <div style={{
                marginTop: 40,
                width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: '50%',
                border: `3px solid ${MAGAZINE_COLORS.accent}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transform: `scale(${avatarScale})`, opacity: avatarOpacity,
                backgroundColor: 'rgba(225,29,72,0.06)',
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h1,
                  fontWeight: 700, color: MAGAZINE_COLORS.accent, lineHeight: 1,
                }}>
                  {initials}
                </div>
              </div>

              {/* Name */}
              <div style={{
                marginTop: 32,
                opacity: nameReveal.opacity,
                transform: `translateY(${nameReveal.translateY}px)`,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h1,
                  fontWeight: 700, color: MAGAZINE_COLORS.text,
                  lineHeight: 1.15, textAlign: 'center', letterSpacing: '-0.02em',
                }}>
                  {name}
                </div>
              </div>

              {/* Title */}
              <div style={{
                marginTop: 12,
                opacity: titleReveal.opacity,
                transform: `translateY(${titleReveal.translateY}px)`,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h3,
                  fontStyle: 'italic', color: MAGAZINE_COLORS.secondary,
                  textAlign: 'center',
                }}>
                  {title}
                </div>
              </div>

              {/* Accent rule */}
              <div style={{
                marginTop: 30, marginBottom: 30,
                width: `${ruleProgress * 20}%`, height: 3,
                backgroundColor: MAGAZINE_COLORS.accent, borderRadius: 1.5,
              }} />

              {/* Detail lines */}
              <div style={{ width: '100%' }}>
                {details.map((detail, i) => {
                  const reveal = editorialReveal(frame, 50 + i * DETAIL_STAGGER, 12);
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
          </div>
        </TornEdge>
      </div>
    </ScaledContainer>
  );
};

export default MagazineProfile;
