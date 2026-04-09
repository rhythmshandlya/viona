import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import type { MagazineHottakeProps } from './schema';
import { editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';
import { ScaledContainer } from '../../magazine/ScaledContainer';

const CANVAS_W = 1080;
const CARD_W = 940;
const CARD_H = 600;

const MagazineHottake: React.FC<MagazineHottakeProps> = ({ label, statement, author }) => {
  const frame = useCurrentFrame();

  // Label reveal
  const labelReveal = editorialReveal(frame, 3, 15);

  // Opening quote mark
  const openQuoteReveal = editorialReveal(frame, 8, 15);

  // Card reveal
  const cardReveal = editorialReveal(frame, 10, 20);

  // Accent bars draw in (frames 25-35)
  const barProgress = interpolate(frame, [25, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: magazineEasing,
  });

  // Author reveal
  const authorReveal = editorialReveal(frame, 35, 15);

  const cardX = (CANVAS_W - CARD_W) / 2;
  const cardY = 480;

  return (
    <ScaledContainer baseWidth={1080} baseHeight={1920}>
      {/* TOP SECTION — Label */}
      <div
        style={{
          position: 'absolute',
          top: 300,
          left: 0,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: labelReveal.opacity,
          transform: `translateY(${labelReveal.translateY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: MAGAZINE_FONTS.accent,
            fontSize: FONT_SIZES.h3,
            fontWeight: 700,
            color: MAGAZINE_COLORS.accent,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          {label}
        </div>
        <div
          style={{
            width: 60,
            height: 0,
            borderBottom: `3px solid ${MAGAZINE_COLORS.accent}`,
            marginTop: 14,
          }}
        />
      </div>

      {/* Opening quotation mark — top-left of card area */}
      <div
        style={{
          position: 'absolute',
          left: cardX - 10,
          top: cardY - 50,
          fontFamily: MAGAZINE_FONTS.headline,
          fontSize: 160,
          fontWeight: 900,
          color: MAGAZINE_COLORS.accent,
          lineHeight: 1,
          opacity: openQuoteReveal.opacity * 0.1,
          transform: `translateY(${openQuoteReveal.translateY}px)`,
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        {'\u201C'}
      </div>

      {/* Closing quotation mark — bottom-right of card area */}
      <div
        style={{
          position: 'absolute',
          right: cardX - 10,
          top: cardY + CARD_H - 130,
          fontFamily: MAGAZINE_FONTS.headline,
          fontSize: 160,
          fontWeight: 900,
          color: MAGAZINE_COLORS.accent,
          lineHeight: 1,
          opacity: openQuoteReveal.opacity * 0.1,
          transform: `translateY(${openQuoteReveal.translateY}px)`,
          userSelect: 'none',
          pointerEvents: 'none',
          textAlign: 'right',
        }}
      >
        {'\u201D'}
      </div>

      {/* Accent bar above card */}
      <div
        style={{
          position: 'absolute',
          top: cardY - 20,
          left: (CANVAS_W - 40 * barProgress) / 2,
          width: 40 * barProgress,
          height: 3,
          backgroundColor: MAGAZINE_COLORS.accent,
          opacity: 0.5,
        }}
      />

      {/* CENTER — Torn paper card */}
      <div
        style={{
          position: 'absolute',
          left: cardX,
          top: cardY,
          opacity: cardReveal.opacity,
          transform: `translateY(${cardReveal.translateY}px)`,
        }}
      >
        <TornEdge
          edges={['top', 'bottom']}
          roughness={0.4}
          seed={777}
          width={CARD_W}
          height={CARD_H}
        >
          <div
            style={{
              width: CARD_W,
              height: CARD_H,
              position: 'relative',
              overflow: 'hidden',
              filter: 'drop-shadow(0 4px 24px rgba(0,0,0,0.10))',
            }}
          >
            <PaperTexture age={0.15} seed="hottake" />
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '50px 55px',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  fontFamily: MAGAZINE_FONTS.headline,
                  fontSize: 46,
                  fontWeight: 700,
                  color: MAGAZINE_COLORS.text,
                  lineHeight: 1.35,
                  textAlign: 'center',
                }}
              >
                {statement}
              </div>
            </div>
          </div>
        </TornEdge>
      </div>

      {/* Accent bar below card */}
      <div
        style={{
          position: 'absolute',
          top: cardY + CARD_H + 17,
          left: (CANVAS_W - 40 * barProgress) / 2,
          width: 40 * barProgress,
          height: 3,
          backgroundColor: MAGAZINE_COLORS.accent,
          opacity: 0.5,
        }}
      />

      {/* BOTTOM — Author attribution */}
      {author && (
        <div
          style={{
            position: 'absolute',
            top: cardY + CARD_H + 55,
            left: 0,
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            opacity: authorReveal.opacity,
            transform: `translateY(${authorReveal.translateY}px)`,
          }}
        >
          <div
            style={{
              fontFamily: MAGAZINE_FONTS.body,
              fontSize: FONT_SIZES.large,
              color: MAGAZINE_COLORS.secondary,
              fontStyle: 'italic',
              textAlign: 'center',
            }}
          >
            {author}
          </div>
        </div>
      )}
    </ScaledContainer>
  );
};

export default MagazineHottake;
