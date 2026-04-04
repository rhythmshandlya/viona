import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import type { MagazineVerdictProps } from './schema';
import { paperSlide, editorialReveal } from '../../magazine/animations';
import { SerifHeadline, SectionLabel } from '../../magazine/typography';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';
import { VerdictCard } from './components/VerdictCard';
import { RatingRing } from './components/RatingRing';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const CARD_W = 940;
const CARD_H = 1500;
const HIGHLIGHT_STAGGER = 10;

const MagazineVerdict: React.FC<MagazineVerdictProps> = ({
  subject, rating, ratingLabel, highlights = [], recommendation,
}) => {
  const frame = useCurrentFrame();

  const cardSlide = paperSlide(frame, 0, 20, 'up');
  const subjectReveal = editorialReveal(frame, 15, 15);
  const labelReveal = editorialReveal(frame, 20, 12);

  const lastHighlightFrame = 45 + (highlights.length - 1) * HIGHLIGHT_STAGGER + 15;
  const recoReveal = editorialReveal(frame, lastHighlightFrame + 5, 15);

  const cardX = (CANVAS_W - CARD_W) / 2 + cardSlide.translateX;
  const cardY = (CANVAS_H - CARD_H) / 2 + cardSlide.translateY;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{ position: 'absolute', left: cardX, top: cardY, opacity: cardSlide.opacity }}>
        <VerdictCard>
          <div style={{
            opacity: labelReveal.opacity,
            transform: `translateY(${labelReveal.translateY}px)`,
            width: '100%',
          }}>
            <SectionLabel label="Verdict" />
          </div>

          <div style={{
            marginTop: 24,
            opacity: subjectReveal.opacity,
            transform: `translateY(${subjectReveal.translateY}px)`,
          }}>
            <SerifHeadline text={subject} size={FONT_SIZES.h1} />
          </div>

          <div style={{ marginTop: 40 }}>
            <RatingRing rating={rating} ratingLabel={ratingLabel} drawStart={25} />
          </div>

          <div style={{ marginTop: 40, width: '100%' }}>
            {highlights.map((text, i) => {
              const reveal = editorialReveal(frame, 45 + i * HIGHLIGHT_STAGGER, 15);
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20,
                  opacity: reveal.opacity,
                  transform: `translateY(${reveal.translateY}px)`,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    backgroundColor: MAGAZINE_COLORS.accent,
                    flexShrink: 0, marginTop: 10,
                  }} />
                  <div style={{
                    fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h4,
                    color: MAGAZINE_COLORS.text, lineHeight: 1.3,
                  }}>
                    {text}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{
            marginTop: 30, width: '100%',
            borderTop: `2px solid ${MAGAZINE_COLORS.accent}`,
            paddingTop: 24,
            opacity: recoReveal.opacity,
            transform: `translateY(${recoReveal.translateY}px)`,
          }}>
            <div style={{
              fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h3,
              fontStyle: 'italic', color: MAGAZINE_COLORS.secondary,
              lineHeight: 1.4,
            }}>
              {recommendation}
            </div>
          </div>
        </VerdictCard>
      </div>
    </AbsoluteFill>
  );
};

export default MagazineVerdict;
