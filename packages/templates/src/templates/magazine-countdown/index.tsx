import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import type { MagazineCountdownProps } from './schema';
import { ScaledContainer } from '../../magazine/ScaledContainer';
import { editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline } from '../../magazine/typography';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const CANVAS_W = 1080;
const TITLE_Y = 160;
const CARD_W = 820;
const CARD_H = 110;
const NUMBER_W = 80;
const GAP_NUM_CARD = 20;
const ITEM_SPACING = 30;
const ITEM_START_Y = 350;
const STAGGER = 10;
const ENTER_DURATION = 20;
const SLIDE_OFFSET = 80;

const MagazineCountdown: React.FC<MagazineCountdownProps> = ({ title, items }) => {
  const frame = useCurrentFrame();

  // Title reveal
  const titleReveal = editorialReveal(frame, 3);

  // Accent rule under title
  const ruleOpacity = interpolate(frame, [3, 23], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: magazineEasing,
  });

  // Items in reverse order (countdown from N to 1)
  const reversedItems = [...items].reverse();

  // Total row width: number + gap + card
  const totalRowW = NUMBER_W + GAP_NUM_CARD + CARD_W;
  const rowLeft = (CANVAS_W - totalRowW) / 2;

  return (
    <ScaledContainer baseWidth={1080} baseHeight={1920}>
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: TITLE_Y + titleReveal.translateY,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: titleReveal.opacity,
        }}
      >
        <SerifHeadline text={title} size={FONT_SIZES.h1} />
      </div>

      {/* Accent rule under title */}
      <div
        style={{
          position: 'absolute',
          top: TITLE_Y + 70,
          left: (CANVAS_W - 80) / 2,
          width: 80,
          height: 3,
          backgroundColor: MAGAZINE_COLORS.accent,
          borderRadius: 1,
          opacity: ruleOpacity,
        }}
      />

      {/* Countdown items */}
      {reversedItems.map((itemText, i) => {
        const rank = items.length - i;
        const enterStart = 15 + i * STAGGER;

        const itemOpacity = interpolate(frame, [enterStart, enterStart + ENTER_DURATION], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: magazineEasing,
        });

        const translateX = interpolate(frame, [enterStart, enterStart + ENTER_DURATION], [SLIDE_OFFSET, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: magazineEasing,
        });

        const itemY = ITEM_START_Y + i * (CARD_H + ITEM_SPACING);

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: rowLeft,
              top: itemY,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: GAP_NUM_CARD,
              opacity: itemOpacity,
              transform: `translateX(${translateX}px)`,
            }}
          >
            {/* Rank number */}
            <div
              style={{
                width: NUMBER_W,
                fontFamily: MAGAZINE_FONTS.headline,
                fontSize: 64,
                fontWeight: 900,
                color: MAGAZINE_COLORS.accent,
                lineHeight: 1,
                textAlign: 'center',
                flexShrink: 0,
              }}
            >
              {rank}
            </div>

            {/* Torn paper card */}
            <div
              style={{
                width: CARD_W,
                height: CARD_H,
                filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.25))',
                flexShrink: 0,
              }}
            >
              <TornEdge
                edges={['top', 'bottom', 'left', 'right']}
                roughness={0.35}
                seed={i * 7 + 13}
                width={CARD_W}
                height={CARD_H}
              >
                <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
                  <PaperTexture age={0.12} seed={`countdown-${i}`} />
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 32px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: MAGAZINE_FONTS.body,
                        fontSize: FONT_SIZES.body,
                        fontWeight: 500,
                        color: MAGAZINE_COLORS.text,
                        lineHeight: 1.3,
                      }}
                    >
                      {itemText}
                    </span>
                  </div>
                </div>
              </TornEdge>
            </div>
          </div>
        );
      })}
    </ScaledContainer>
  );
};

export default MagazineCountdown;
