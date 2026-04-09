import React from 'react';
import { useCurrentFrame, random } from 'remotion';
import type { MagazineRankingProps } from './schema';
import { paperSlide } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline } from '../../magazine/typography';
import { TapeMark, PinMark } from '../../magazine/decorations';
import { RankItem } from './components/RankItem';
import { ScaledContainer } from '../../magazine/ScaledContainer';

const CANVAS_W = 1080;
const TITLE_Y = 140;
const TITLE_W = 800;
const TITLE_H = 140;
const ITEM_START_Y = 350;
const ITEM_SPACING = 200;
const STAGGER = 10;
const ENTER_DURATION = 25;

const DIRECTIONS: Array<'left' | 'right'> = ['left', 'right'];
const TAPE_CORNERS: Array<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'> = [
  'top-right', 'top-left', 'bottom-right', 'bottom-left',
];

const MagazineRanking: React.FC<MagazineRankingProps> = ({ title, items = [] }) => {
  const frame = useCurrentFrame();

  const titleSlide = paperSlide(frame, 0, 15, 'down');

  return (
    <ScaledContainer baseWidth={1080} baseHeight={1920}>
      <div style={{
        position: 'absolute',
        left: (CANVAS_W - TITLE_W) / 2 + titleSlide.translateX,
        top: TITLE_Y + titleSlide.translateY,
        opacity: titleSlide.opacity,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
      }}>
        <div style={{ position: 'relative' }}>
          <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={200} width={TITLE_W} height={TITLE_H}>
            <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
              <PaperTexture age={0.15} seed="ranking-title" />
              <div style={{
                position: 'relative', zIndex: 1, width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 24, boxSizing: 'border-box',
              }}>
                <SerifHeadline text={title} size={39} />
              </div>
            </div>
          </TornEdge>
          <TapeMark corner="top-right" seed={200} />
        </div>
      </div>

      {items.map((item, i) => {
        const enterStart = 15 + i * STAGGER;
        const slide = paperSlide(frame, enterStart, ENTER_DURATION, DIRECTIONS[i % 2]);
        const landFrame = enterStart + ENTER_DURATION;

        const depth = i % 3;
        const depthMul = (depth + 1) * 6;
        const parallaxX = frame >= 60 ? Math.sin(frame * 0.02 + i * 1.5) * depthMul : 0;
        const parallaxY = frame >= 60 ? Math.sin(frame * 0.025 + i * 2.0) * depthMul * 0.5 : 0;

        const isEntering = frame < landFrame;

        const offsetX = (random(`rank-ox-${i}`) - 0.5) * 40;
        const baseX = (CANVAS_W - 920) / 2 + offsetX;
        const baseY = ITEM_START_Y + i * ITEM_SPACING;

        let x = baseX + parallaxX;
        let y = baseY + parallaxY;
        let opacity = 1;
        if (isEntering) { x += slide.translateX; y += slide.translateY; opacity = slide.opacity; }

        return (
          <div key={i} style={{ position: 'absolute', left: x, top: y, opacity, zIndex: depth }}>
            <div style={{ position: 'relative' }}>
              <RankItem rank={i + 1} text={item.text} detail={item.detail} index={i} />
              {random(`rank-deco-${i}`) > 0.5 ? (
                <TapeMark corner={TAPE_CORNERS[i % 4]} seed={i + 200} />
              ) : (
                <PinMark x={920 / 2} y={4} seed={i + 200} />
              )}
            </div>
          </div>
        );
      })}
    </ScaledContainer>
  );
};

export default MagazineRanking;
