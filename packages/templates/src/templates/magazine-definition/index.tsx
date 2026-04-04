import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { MagazineDefinitionProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const MagazineDefinition: React.FC<MagazineDefinitionProps> = ({
  term, pronunciation, definition, category,
}) => {
  const frame = useCurrentFrame();

  const slide = paperSlide(frame, 0, 15, 'up');
  const categoryReveal = editorialReveal(frame, 10, 12);
  const termReveal = editorialReveal(frame, 15, 15);
  const pronunciationReveal = editorialReveal(frame, 25, 12);

  const ruleProgress = interpolate(frame, [28, 42], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  const definitionReveal = editorialReveal(frame, 40, 18);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{
        width: '100%', height: '100%',
        opacity: slide.opacity,
        transform: `translateY(${slide.translateY}px)`,
      }}>
        <PaperTexture age={0.1} opacity={1} seed="definition-paper" />

        <div style={{
          position: 'absolute', left: 80, right: 80, top: 0, bottom: 0,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          {category && (
            <div style={{
              opacity: categoryReveal.opacity,
              transform: `translateY(${categoryReveal.translateY}px)`,
              marginBottom: 24,
            }}>
              <span style={{
                fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.small,
                fontWeight: 700, color: MAGAZINE_COLORS.accent,
                letterSpacing: '0.15em', textTransform: 'uppercase',
                borderBottom: `2px solid ${MAGAZINE_COLORS.accent}`,
                paddingBottom: 4,
              }}>
                {category}
              </span>
            </div>
          )}

          <div style={{
            opacity: termReveal.opacity,
            transform: `translateY(${termReveal.translateY}px)`,
          }}>
            <div style={{
              fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.hero,
              fontWeight: 900, color: MAGAZINE_COLORS.text,
              lineHeight: 1.1, letterSpacing: '-0.02em',
            }}>
              {term}
            </div>
          </div>

          {pronunciation && (
            <div style={{
              opacity: pronunciationReveal.opacity,
              transform: `translateY(${pronunciationReveal.translateY}px)`,
              marginTop: 12,
            }}>
              <div style={{
                fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h4,
                fontStyle: 'italic', color: MAGAZINE_COLORS.secondary,
              }}>
                {pronunciation}
              </div>
            </div>
          )}

          <div style={{
            marginTop: 32, marginBottom: 32,
            width: `${ruleProgress * 100}%`, height: 3,
            backgroundColor: MAGAZINE_COLORS.accent, borderRadius: 1.5,
          }} />

          <div style={{
            opacity: definitionReveal.opacity,
            transform: `translateY(${definitionReveal.translateY}px)`,
          }}>
            <div style={{
              fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h2,
              color: MAGAZINE_COLORS.text, lineHeight: 1.5,
            }}>
              {definition}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default MagazineDefinition;
