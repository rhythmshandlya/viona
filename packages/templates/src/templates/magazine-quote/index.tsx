import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { MagazineQuoteProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const MagazineQuote: React.FC<MagazineQuoteProps> = ({ quote, author, role, context }) => {
  const frame = useCurrentFrame();

  const slide = paperSlide(frame, 0, 15, 'up');
  const quoteMarkReveal = editorialReveal(frame, 8, 12);
  const quoteTextReveal = editorialReveal(frame, 18, 18);

  // Accent rule draws
  const ruleProgress = interpolate(frame, [40, 55], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  const authorReveal = editorialReveal(frame, 50, 15);
  const roleReveal = editorialReveal(frame, 58, 12);
  const contextReveal = editorialReveal(frame, 68, 15);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{
        width: '100%', height: '100%',
        opacity: slide.opacity,
        transform: `translateY(${slide.translateY}px)`,
      }}>
        <PaperTexture age={0.1} opacity={1} seed="quote-paper" />

        {/* Content — vertically centered */}
        <div style={{
          position: 'absolute', left: 80, right: 80, top: 0, bottom: 0,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          {/* Opening quotation mark */}
          <div style={{
            fontFamily: MAGAZINE_FONTS.headline, fontSize: 240,
            fontWeight: 700, color: MAGAZINE_COLORS.accent,
            lineHeight: 0.6, marginBottom: -30,
            opacity: quoteMarkReveal.opacity * 0.12,
            transform: `translateY(${quoteMarkReveal.translateY}px)`,
            userSelect: 'none',
          }}>
            {'\u201C'}
          </div>

          {/* Quote text */}
          <div style={{
            paddingLeft: 24,
            opacity: quoteTextReveal.opacity,
            transform: `translateY(${quoteTextReveal.translateY}px)`,
          }}>
            <div style={{
              fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h1,
              fontWeight: 700, color: MAGAZINE_COLORS.text,
              lineHeight: 1.35, letterSpacing: '-0.01em',
            }}>
              {quote}
            </div>
          </div>

          {/* Accent rule */}
          <div style={{
            marginTop: 36, marginBottom: 28, marginLeft: 24,
            width: `${ruleProgress * 30}%`, height: 3,
            backgroundColor: MAGAZINE_COLORS.accent, borderRadius: 1.5,
          }} />

          {/* Author */}
          <div style={{
            paddingLeft: 24,
            opacity: authorReveal.opacity,
            transform: `translateY(${authorReveal.translateY}px)`,
          }}>
            <div style={{
              fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h3,
              fontWeight: 700, color: MAGAZINE_COLORS.text,
            }}>
              {'\u2014 '}{author}
            </div>
          </div>

          {/* Role */}
          {role && (
            <div style={{
              paddingLeft: 50,
              opacity: roleReveal.opacity,
              transform: `translateY(${roleReveal.translateY}px)`,
              marginTop: 8,
            }}>
              <div style={{
                fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.large,
                fontStyle: 'italic', color: MAGAZINE_COLORS.secondary,
              }}>
                {role}
              </div>
            </div>
          )}

          {/* Context */}
          {context && (
            <div style={{
              paddingLeft: 24, marginTop: 30,
              opacity: contextReveal.opacity,
              transform: `translateY(${contextReveal.translateY}px)`,
            }}>
              <div style={{
                fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.small,
                color: MAGAZINE_COLORS.secondary,
                letterSpacing: '0.05em',
              }}>
                {context}
              </div>
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default MagazineQuote;
