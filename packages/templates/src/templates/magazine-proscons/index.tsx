import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import type { MagazineProsconsProps } from './schema';
import { editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline } from '../../magazine/typography';
import { MAGAZINE_COLORS, MAGAZINE_FONTS, FONT_SIZES } from '../../magazine/constants';
import { ProConItem } from './components/ProConItem';
import { ScaledContainer } from '../../magazine/ScaledContainer';

const CANVAS_W = 1080;
const COL_WIDTH = 470;
const ITEM_W = COL_WIDTH - 40;
const LEFT_X = 40;
const RIGHT_X = CANVAS_W - COL_WIDTH - 40;
const HEADER_Y = 340;
const ITEMS_Y = 420;
const STAGGER = 8;

const MagazineProscons: React.FC<MagazineProsconsProps> = ({ title, pros = [], cons = [] }) => {
  const frame = useCurrentFrame();

  const titleReveal = editorialReveal(frame, 3, 14);

  // Center divider
  const dividerProgress = interpolate(frame, [8, 28], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  const prosHeaderReveal = editorialReveal(frame, 12, 10);
  const consHeaderReveal = editorialReveal(frame, 15, 10);

  return (
    <ScaledContainer baseWidth={1080} baseHeight={1920}>
      {/* Title */}
      <div style={{
        position: 'absolute', left: 0, top: 160, width: CANVAS_W,
        display: 'flex', justifyContent: 'center',
        opacity: titleReveal.opacity,
        transform: `translateY(${titleReveal.translateY}px)`,
      }}>
        <SerifHeadline text={title} size={FONT_SIZES.h1} />
      </div>

      {/* Accent rule under title */}
      <div style={{
        position: 'absolute', left: CANVAS_W / 2 - 40, top: 250,
        width: 80, height: 3, borderRadius: 1.5,
        backgroundColor: MAGAZINE_COLORS.accent,
        opacity: titleReveal.opacity,
      }} />

      {/* Center divider */}
      <div style={{
        position: 'absolute', left: CANVAS_W / 2 - 1, top: HEADER_Y - 10,
        width: 2, height: 1300 * dividerProgress,
        backgroundColor: MAGAZINE_COLORS.text, opacity: 0.1,
      }} />

      {/* Pros header */}
      <div style={{
        position: 'absolute', left: LEFT_X, top: HEADER_Y, width: COL_WIDTH,
        display: 'flex', alignItems: 'center', gap: 10,
        opacity: prosHeaderReveal.opacity,
        transform: `translateY(${prosHeaderReveal.translateY}px)`,
      }}>
        <div style={{
          fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.h3,
          fontWeight: 700, color: '#16a34a', letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          Pros
        </div>
        <div style={{ flex: 1, height: 1, backgroundColor: '#16a34a', opacity: 0.3 }} />
      </div>

      {/* Cons header */}
      <div style={{
        position: 'absolute', left: RIGHT_X, top: HEADER_Y, width: COL_WIDTH,
        display: 'flex', alignItems: 'center', gap: 10,
        opacity: consHeaderReveal.opacity,
        transform: `translateY(${consHeaderReveal.translateY}px)`,
      }}>
        <div style={{
          fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.h3,
          fontWeight: 700, color: MAGAZINE_COLORS.accent, letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          Cons
        </div>
        <div style={{ flex: 1, height: 1, backgroundColor: MAGAZINE_COLORS.accent, opacity: 0.3 }} />
      </div>

      {/* Pros items */}
      <div style={{ position: 'absolute', left: LEFT_X + 20, top: ITEMS_Y }}>
        {pros.map((text, i) => (
          <ProConItem key={i} text={text} type="pro" revealFrame={20 + i * STAGGER} width={ITEM_W} index={i} />
        ))}
      </div>

      {/* Cons items */}
      <div style={{ position: 'absolute', left: RIGHT_X + 20, top: ITEMS_Y }}>
        {cons.map((text, i) => (
          <ProConItem key={i} text={text} type="con" revealFrame={20 + i * STAGGER} width={ITEM_W} index={i} />
        ))}
      </div>
    </ScaledContainer>
  );
};

export default MagazineProscons;
