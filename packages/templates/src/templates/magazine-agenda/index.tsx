import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { MagazineAgendaProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline, SectionLabel } from '../../magazine/typography';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const CARD_W = 940;
const CARD_H = 1500;
const SLOT_STAGGER = 10;

const MagazineAgenda: React.FC<MagazineAgendaProps> = ({ title, slots = [] }) => {
  const frame = useCurrentFrame();

  const cardSlide = paperSlide(frame, 0, 20, 'up');
  const labelReveal = editorialReveal(frame, 14, 12);
  const titleReveal = editorialReveal(frame, 20, 15);

  // Vertical line draws down
  const lineProgress = interpolate(frame, [30, 30 + slots.length * SLOT_STAGGER + 20], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  const cardX = (CANVAS_W - CARD_W) / 2 + cardSlide.translateX;
  const cardY = (CANVAS_H - CARD_H) / 2 + cardSlide.translateY;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{ position: 'absolute', left: cardX, top: cardY, opacity: cardSlide.opacity }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.5} seed={360} width={CARD_W} height={CARD_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.15} seed="agenda" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '60px 50px', boxSizing: 'border-box',
            }}>
              {/* Section label */}
              <div style={{
                opacity: labelReveal.opacity,
                transform: `translateY(${labelReveal.translateY}px)`,
              }}>
                <SectionLabel label="Schedule" />
              </div>

              {/* Title */}
              <div style={{
                marginTop: 24,
                opacity: titleReveal.opacity,
                transform: `translateY(${titleReveal.translateY}px)`,
              }}>
                <SerifHeadline text={title} size={FONT_SIZES.h1} showRule />
              </div>

              {/* Schedule slots */}
              <div style={{ marginTop: 50, position: 'relative', paddingLeft: 120 }}>
                {/* Vertical timeline line */}
                <div style={{
                  position: 'absolute', left: 95, top: 8,
                  width: 2, height: `${lineProgress * 100}%`,
                  backgroundColor: MAGAZINE_COLORS.accent, opacity: 0.4,
                }} />

                {slots.map((slot, i) => {
                  const reveal = editorialReveal(frame, 35 + i * SLOT_STAGGER, 12);
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', marginBottom: 36,
                      opacity: reveal.opacity,
                      transform: `translateY(${reveal.translateY}px)`,
                      position: 'relative',
                    }}>
                      {/* Time label */}
                      <div style={{
                        position: 'absolute', left: -120, width: 80, textAlign: 'right',
                        fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.large,
                        fontWeight: 700, color: MAGAZINE_COLORS.accent,
                        lineHeight: 1.3,
                      }}>
                        {slot.time}
                      </div>

                      {/* Dot on timeline */}
                      <div style={{
                        position: 'absolute', left: -30,
                        width: 10, height: 10, borderRadius: '50%',
                        backgroundColor: MAGAZINE_COLORS.accent, top: 6,
                      }} />

                      {/* Event text */}
                      <div style={{
                        fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h3,
                        color: MAGAZINE_COLORS.text, lineHeight: 1.4,
                        paddingLeft: 8,
                      }}>
                        {slot.event}
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

export default MagazineAgenda;
