import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { MagazineProsconsProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline, SectionLabel } from '../../magazine/typography';
import { MAGAZINE_COLORS } from '../../magazine/constants';
import { ProConItem } from './components/ProConItem';

const CANVAS_W = 1080;
const TITLE_Y = 140;
const TITLE_W = 800;
const TITLE_H = 140;
const COLUMNS_Y = 380;
const COL_WIDTH = 460;
const LEFT_X = 40;
const RIGHT_X = 580;
const STAGGER = 10;

const MagazineProscons: React.FC<MagazineProsconsProps> = ({ title, pros = [], cons = [] }) => {
  const frame = useCurrentFrame();

  const titleSlide = paperSlide(frame, 0, 15, 'down');

  const dividerProgress = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  const dividerHeight = 1200 * dividerProgress;

  const prosHeaderReveal = editorialReveal(frame, 15, 12);
  const consHeaderReveal = editorialReveal(frame, 18, 12);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{
        position: 'absolute',
        left: (CANVAS_W - TITLE_W) / 2 + titleSlide.translateX,
        top: TITLE_Y + titleSlide.translateY,
        opacity: titleSlide.opacity,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
      }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={220} width={TITLE_W} height={TITLE_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.15} seed="proscons-title" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 24, boxSizing: 'border-box',
            }}>
              <SerifHeadline text={title} size={39} />
            </div>
          </div>
        </TornEdge>
      </div>

      <div style={{
        position: 'absolute', left: CANVAS_W / 2 - 1.5, top: COLUMNS_Y - 40,
        width: 3, height: dividerHeight,
        backgroundColor: MAGAZINE_COLORS.accent,
        borderRadius: 1.5, opacity: 0.5,
      }} />

      <div style={{
        position: 'absolute', left: LEFT_X, top: COLUMNS_Y - 50,
        width: COL_WIDTH, textAlign: 'center',
        opacity: prosHeaderReveal.opacity,
        transform: `translateY(${prosHeaderReveal.translateY}px)`,
      }}>
        <SectionLabel label="Pros" color="#16a34a" />
      </div>

      <div style={{
        position: 'absolute', left: RIGHT_X, top: COLUMNS_Y - 50,
        width: COL_WIDTH, textAlign: 'center',
        opacity: consHeaderReveal.opacity,
        transform: `translateY(${consHeaderReveal.translateY}px)`,
      }}>
        <SectionLabel label="Cons" color={MAGAZINE_COLORS.accent} />
      </div>

      <div style={{ position: 'absolute', left: LEFT_X + 20, top: COLUMNS_Y + 20, width: COL_WIDTH - 40 }}>
        {pros.map((text, i) => (
          <ProConItem key={i} text={text} type="pro" revealFrame={25 + i * STAGGER} />
        ))}
      </div>

      <div style={{ position: 'absolute', left: RIGHT_X + 20, top: COLUMNS_Y + 20, width: COL_WIDTH - 40 }}>
        {cons.map((text, i) => (
          <ProConItem key={i} text={text} type="con" revealFrame={25 + i * STAGGER} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

export default MagazineProscons;
