import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { MagazineTriviaProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SectionLabel } from '../../magazine/typography';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';
import { ScaledContainer } from '../../magazine/ScaledContainer';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const CARD_W = 940;
const CARD_H = 1500;

const MagazineTrivia: React.FC<MagazineTriviaProps> = ({ question, answer, detail }) => {
  const frame = useCurrentFrame();

  const cardSlide = paperSlide(frame, 0, 20, 'up');
  const questionLabel = editorialReveal(frame, 15, 12);
  const questionReveal = editorialReveal(frame, 22, 18);

  // Divider draws in (frames 45-58)
  const dividerProgress = interpolate(frame, [45, 58], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  // Answer reveals after dramatic pause (frame 60)
  const answerLabelReveal = editorialReveal(frame, 60, 12);
  const answerReveal = editorialReveal(frame, 68, 15);
  const detailReveal = editorialReveal(frame, 82, 15);

  const cardX = (CANVAS_W - CARD_W) / 2 + cardSlide.translateX;
  const cardY = (CANVAS_H - CARD_H) / 2 + cardSlide.translateY;

  return (
    <ScaledContainer baseWidth={1080} baseHeight={1920}>
      <div style={{ position: 'absolute', left: cardX, top: cardY, opacity: cardSlide.opacity }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.5} seed={320} width={CARD_W} height={CARD_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.15} seed="trivia" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '80px 55px', boxSizing: 'border-box',
              display: 'flex', flexDirection: 'column',
            }}>
              {/* Question section */}
              <div style={{
                opacity: questionLabel.opacity,
                transform: `translateY(${questionLabel.translateY}px)`,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.small,
                  fontWeight: 700, color: MAGAZINE_COLORS.accent,
                  letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 20,
                }}>
                  QUESTION
                </div>
              </div>

              <div style={{
                opacity: questionReveal.opacity,
                transform: `translateY(${questionReveal.translateY}px)`,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h1,
                  fontWeight: 700, color: MAGAZINE_COLORS.text,
                  lineHeight: 1.3,
                }}>
                  {question}
                </div>
              </div>

              {/* Divider */}
              <div style={{
                marginTop: 60, marginBottom: 60, alignSelf: 'center',
                width: `${dividerProgress * 60}%`, height: 2,
                backgroundColor: MAGAZINE_COLORS.secondary, opacity: 0.25,
              }} />

              {/* Answer section */}
              <div style={{
                opacity: answerLabelReveal.opacity,
                transform: `translateY(${answerLabelReveal.translateY}px)`,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.small,
                  fontWeight: 700, color: '#16a34a',
                  letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 20,
                }}>
                  ANSWER
                </div>
              </div>

              <div style={{
                opacity: answerReveal.opacity,
                transform: `translateY(${answerReveal.translateY}px)`,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.display,
                  fontWeight: 900, color: MAGAZINE_COLORS.text,
                  lineHeight: 1.15, letterSpacing: '-0.02em',
                }}>
                  {answer}
                </div>
              </div>

              {/* Detail explanation */}
              {detail && (
                <div style={{
                  marginTop: 24,
                  opacity: detailReveal.opacity,
                  transform: `translateY(${detailReveal.translateY}px)`,
                }}>
                  <div style={{
                    fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h3,
                    color: MAGAZINE_COLORS.secondary, lineHeight: 1.4,
                  }}>
                    {detail}
                  </div>
                </div>
              )}
            </div>
          </div>
        </TornEdge>
      </div>
    </ScaledContainer>
  );
};

export default MagazineTrivia;
