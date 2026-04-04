import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import type { MagazineTakeawaysProps } from './schema';
import { paperSlide, editorialReveal } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline, SectionLabel } from '../../magazine/typography';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const CARD_W = 940;
const CARD_H = 1400;
const POINT_STAGGER = 10;

const MagazineTakeaways: React.FC<MagazineTakeawaysProps> = ({ title, points = [] }) => {
  const frame = useCurrentFrame();

  const cardSlide = paperSlide(frame, 0, 20, 'up');
  const labelReveal = editorialReveal(frame, 15, 12);
  const titleReveal = editorialReveal(frame, 20, 15);

  const cardX = (CANVAS_W - CARD_W) / 2 + cardSlide.translateX;
  const cardY = (CANVAS_H - CARD_H) / 2 + cardSlide.translateY;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{ position: 'absolute', left: cardX, top: cardY, opacity: cardSlide.opacity }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.5} seed={270} width={CARD_W} height={CARD_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.15} seed="takeaways" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '60px 50px', boxSizing: 'border-box',
            }}>
              {/* Section label */}
              <div style={{
                opacity: labelReveal.opacity,
                transform: `translateY(${labelReveal.translateY}px)`,
              }}>
                <SectionLabel label="Summary" />
              </div>

              {/* Title */}
              <div style={{
                marginTop: 24,
                opacity: titleReveal.opacity,
                transform: `translateY(${titleReveal.translateY}px)`,
              }}>
                <SerifHeadline text={title} size={FONT_SIZES.h1} showRule />
              </div>

              {/* Points */}
              <div style={{ marginTop: 50 }}>
                {points.map((point, i) => {
                  const reveal = editorialReveal(frame, 35 + i * POINT_STAGGER, 15);
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 28,
                      opacity: reveal.opacity,
                      transform: `translateY(${reveal.translateY}px)`,
                    }}>
                      {/* Number bullet */}
                      <div style={{
                        fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h3,
                        fontWeight: 700, color: MAGAZINE_COLORS.accent,
                        lineHeight: 1.3, minWidth: 36, textAlign: 'right',
                        flexShrink: 0,
                      }}>
                        {i + 1}.
                      </div>
                      <div style={{
                        fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h3,
                        color: MAGAZINE_COLORS.text, lineHeight: 1.4,
                      }}>
                        {point}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </TornEdge>
      </div>
    </AbsoluteFill>
  );
};

export default MagazineTakeaways;
