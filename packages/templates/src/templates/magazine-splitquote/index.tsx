import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { MagazineSplitquoteProps } from './schema';
import { editorialReveal, magazineEasing } from '../../magazine/animations';
import { MagazineBackground } from '../../magazine/textures';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';
import { ScaledContainer } from '../../magazine/ScaledContainer';

const CANVAS_W = 1920;
const CANVAS_H = 1080;

const CARD_W = 750;
const CARD_H = 700;
const CARD_X = 80;
const CARD_Y = (CANVAS_H - CARD_H) / 2;

const DIVIDER_X = 960;
const DIVIDER_TARGET_H = 800;
const DIVIDER_Y = (CANVAS_H - DIVIDER_TARGET_H) / 2;

const RIGHT_X = 1020;
const RIGHT_W = 820;

const MagazineSplitquote: React.FC<MagazineSplitquoteProps> = ({ number, quote, source }) => {
  const frame = useCurrentFrame();

  // Left card reveal
  const cardReveal = editorialReveal(frame, 5);

  // Center divider animation
  const dividerHeight = interpolate(frame, [8, 25], [0, DIVIDER_TARGET_H], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: magazineEasing,
  });

  // Right side reveals
  const quoteReveal = editorialReveal(frame, 15);

  // Accent rule draw-in
  const ruleWidth = interpolate(frame, [30, 42], [0, 80], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: magazineEasing,
  });

  // Source reveal
  const sourceReveal = editorialReveal(frame, 38);

  return (
    <ScaledContainer baseWidth={1920} baseHeight={1080}>
      <MagazineBackground seed="splitquote-bg" />

      {/* LEFT HALF - Torn paper card with number */}
      <div
        style={{
          position: 'absolute',
          left: CARD_X,
          top: CARD_Y,
          width: CARD_W,
          height: CARD_H,
          opacity: cardReveal.opacity,
          transform: `translateY(${cardReveal.translateY}px)`,
          filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.10))',
        }}
      >
        <TornEdge
          edges={['right']}
          roughness={0.4}
          seed={17}
          width={CARD_W}
          height={CARD_H}
        >
          <div style={{ width: CARD_W, height: CARD_H, position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.15} seed="splitquote-card" />
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  fontFamily: MAGAZINE_FONTS.headline,
                  fontSize: 140,
                  fontWeight: 900,
                  color: MAGAZINE_COLORS.accent,
                  lineHeight: 1,
                  textAlign: 'center',
                  userSelect: 'none',
                }}
              >
                {number}
              </span>
            </div>
          </div>
        </TornEdge>
      </div>

      {/* CENTER DIVIDER */}
      <div
        style={{
          position: 'absolute',
          left: DIVIDER_X,
          top: DIVIDER_Y + (DIVIDER_TARGET_H - dividerHeight) / 2,
          width: 2,
          height: dividerHeight,
          backgroundColor: MAGAZINE_COLORS.accent,
          opacity: 0.3,
        }}
      />

      {/* RIGHT HALF - Quote, rule, source */}
      <div
        style={{
          position: 'absolute',
          left: RIGHT_X,
          top: 0,
          width: RIGHT_W,
          height: CANVAS_H,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {/* Quote text */}
        <div
          style={{
            fontFamily: MAGAZINE_FONTS.headline,
            fontSize: FONT_SIZES.h2,
            fontWeight: 700,
            color: MAGAZINE_COLORS.text,
            lineHeight: 1.4,
            opacity: quoteReveal.opacity,
            transform: `translateY(${quoteReveal.translateY}px)`,
          }}
        >
          {quote}
        </div>

        {/* Accent rule */}
        <div
          style={{
            width: ruleWidth,
            height: 3,
            backgroundColor: MAGAZINE_COLORS.accent,
            borderRadius: 1.5,
            marginTop: 28,
          }}
        />

        {/* Source */}
        <div
          style={{
            fontFamily: MAGAZINE_FONTS.accent,
            fontSize: FONT_SIZES.small,
            color: MAGAZINE_COLORS.secondary,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginTop: 16,
            opacity: sourceReveal.opacity,
            transform: `translateY(${sourceReveal.translateY}px)`,
          }}
        >
          {source}
        </div>
      </div>
    </ScaledContainer>
  );
};

export default MagazineSplitquote;
