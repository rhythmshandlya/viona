import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { MagazineHeadlineProps } from './schema';
import { editorialReveal, magazineEasing } from '../../magazine/animations';
import { MagazineBackground } from '../../magazine/textures';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';
import { ScaledContainer } from '../../magazine/ScaledContainer';

const MagazineHeadline: React.FC<MagazineHeadlineProps> = ({ category, headline, dateline }) => {
  const frame = useCurrentFrame();

  const categoryReveal = editorialReveal(frame, 5, 15);
  const headlineReveal = editorialReveal(frame, 12, 18);
  const datelineReveal = editorialReveal(frame, 30, 15);

  // Red accent rule draws from 0 to 120px between frames 20-35
  const ruleWidth = interpolate(frame, [20, 35], [0, 120], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: magazineEasing,
  });

  return (
    <ScaledContainer baseWidth={1920} baseHeight={1080}>
      <MagazineBackground seed="headline-bg" />

      {/* Content — vertically centered */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        alignItems: 'center', gap: 24,
      }}>
        {/* Category label */}
        <div style={{
          fontFamily: MAGAZINE_FONTS.accent,
          fontSize: FONT_SIZES.small,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.2em',
          color: MAGAZINE_COLORS.accent,
          opacity: categoryReveal.opacity,
          transform: `translateY(${categoryReveal.translateY}px)`,
        }}>
          {category}
        </div>

        {/* Headline */}
        <div style={{
          fontFamily: MAGAZINE_FONTS.headline,
          fontSize: 72,
          fontWeight: 700,
          color: MAGAZINE_COLORS.text,
          textAlign: 'center',
          maxWidth: 1400,
          lineHeight: 1.2,
          opacity: headlineReveal.opacity,
          transform: `translateY(${headlineReveal.translateY}px)`,
        }}>
          {headline}
        </div>

        {/* Red accent rule */}
        <div style={{
          width: ruleWidth,
          height: 3,
          backgroundColor: MAGAZINE_COLORS.accent,
          borderRadius: 1.5,
        }} />

        {/* Dateline */}
        {dateline && (
          <div style={{
            fontFamily: MAGAZINE_FONTS.body,
            fontSize: FONT_SIZES.body,
            color: MAGAZINE_COLORS.secondary,
            textAlign: 'center',
            opacity: datelineReveal.opacity,
            transform: `translateY(${datelineReveal.translateY}px)`,
          }}>
            {dateline}
          </div>
        )}
      </div>
    </ScaledContainer>
  );
};

export default MagazineHeadline;
