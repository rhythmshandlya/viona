import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import type { MagazineBeforeafterProps } from './schema';
import { ScaledContainer } from '../../magazine/ScaledContainer';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline } from '../../magazine/typography';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const CANVAS_W = 1080;
const CARD_W = 880;
const SECTION_H = 500;
const GAP = 30;

const MagazineBeforeafter: React.FC<MagazineBeforeafterProps> = ({
  title, before, after, beforeLabel, afterLabel,
}) => {
  const frame = useCurrentFrame();

  const titleReveal = editorialReveal(frame, 5, 15);
  const beforeSlide = paperSlide(frame, 10, 25, 'left');
  const afterSlide = paperSlide(frame, 40, 25, 'right');

  const arrowOpacity = interpolate(frame, [30, 38], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const arrowScale = interpolate(frame, [30, 40], [0.5, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  const centerX = (CANVAS_W - CARD_W) / 2;
  const topSectionY = 320;
  const arrowY = topSectionY + SECTION_H + GAP / 2;
  const bottomSectionY = topSectionY + SECTION_H + GAP;

  return (
    <ScaledContainer baseWidth={1080} baseHeight={1920}>
      <div style={{
        position: 'absolute', left: 0, top: 160, width: CANVAS_W,
        display: 'flex', justifyContent: 'center',
        opacity: titleReveal.opacity,
        transform: `translateY(${titleReveal.translateY}px)`,
      }}>
        <SerifHeadline text={title} size={FONT_SIZES.h1} />
      </div>

      <div style={{
        position: 'absolute', left: centerX + beforeSlide.translateX, top: topSectionY + beforeSlide.translateY,
        opacity: beforeSlide.opacity,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
      }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={250} width={CARD_W} height={SECTION_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.35} seed="before" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '40px 50px', boxSizing: 'border-box',
            }}>
              <div style={{
                fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.small,
                fontWeight: 700, color: MAGAZINE_COLORS.accent,
                letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 20,
              }}>
                {beforeLabel}
              </div>
              <div style={{
                fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h3,
                color: MAGAZINE_COLORS.text, lineHeight: 1.4,
              }}>
                {before}
              </div>
            </div>
          </div>
        </TornEdge>
      </div>

      <div style={{
        position: 'absolute', left: CANVAS_W / 2, top: arrowY,
        transform: `translate(-50%, -50%) scale(${arrowScale})`,
        opacity: arrowOpacity,
      }}>
        <div style={{
          fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h1,
          color: MAGAZINE_COLORS.accent, lineHeight: 1,
        }}>
          {'\u2193'}
        </div>
      </div>

      <div style={{
        position: 'absolute', left: centerX + afterSlide.translateX, top: bottomSectionY + afterSlide.translateY,
        opacity: afterSlide.opacity,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
      }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={251} width={CARD_W} height={SECTION_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.1} seed="after" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '40px 50px', boxSizing: 'border-box',
            }}>
              <div style={{
                fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.small,
                fontWeight: 700, color: '#16a34a',
                letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 20,
              }}>
                {afterLabel}
              </div>
              <div style={{
                fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h3,
                color: MAGAZINE_COLORS.text, lineHeight: 1.4,
              }}>
                {after}
              </div>
            </div>
          </div>
        </TornEdge>
      </div>
    </ScaledContainer>
  );
};

export default MagazineBeforeafter;
