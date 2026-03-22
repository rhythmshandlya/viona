import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, random } from 'remotion';
import type { MagazineChecklistProps } from './schema';
import { paperSlide, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline } from '../../magazine/typography';
import { TapeMark, PinMark } from '../../magazine/decorations';
import { ChecklistItem } from './components/ChecklistItem';

const CANVAS_W = 1080;
const TITLE_Y = 200;
const TITLE_W = 900;
const TITLE_H = 160;
const ITEM_W = 900;
const ITEM_SPACING = 180;
const ITEM_START_Y = 420;
const STAGGER = 10;
const ENTER_DURATION = 25;

const DIRECTIONS: Array<'left' | 'right'> = ['left', 'right'];
const TAPE_CORNERS: Array<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'> = [
  'top-right', 'top-left', 'bottom-right', 'bottom-left',
];

const MagazineChecklist: React.FC<MagazineChecklistProps> = ({ items, title }) => {
  const frame = useCurrentFrame();

  // Phase 1: Title entrance
  const titleSlide = paperSlide(frame, 0, 20, 'down');
  // Phase 5: Title exit
  const titleExitOpacity = interpolate(frame, [120, 140], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const isTitleExiting = frame >= 120;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Title scrap */}
      <div style={{
        position: 'absolute',
        left: (CANVAS_W - TITLE_W) / 2 + titleSlide.translateX,
        top: TITLE_Y + titleSlide.translateY,
        opacity: isTitleExiting ? titleExitOpacity : titleSlide.opacity,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
      }}>
        <div style={{ position: 'relative' }}>
          <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={99} width={TITLE_W} height={TITLE_H}>
            <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
              <PaperTexture age={0.15} seed="checklist-title" />
              <div style={{
                position: 'relative', zIndex: 1, width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 24, boxSizing: 'border-box',
              }}>
                <SerifHeadline text={title} size={39} />
              </div>
            </div>
          </TornEdge>
          <TapeMark corner="top-right" seed={99} />
        </div>
      </div>

      {/* Item scraps */}
      {items.map((item, i) => {
        const enterStart = 15 + i * STAGGER;
        const slide = paperSlide(frame, enterStart, ENTER_DURATION, DIRECTIONS[i % 2]);
        const landFrame = enterStart + ENTER_DURATION;
        const checkFrame = landFrame + 15;

        const depth = i % 3;
        const depthMul = (depth + 1) * 6;
        const parallaxX = frame >= 60 && frame <= 120 ? Math.sin(frame * 0.02 + i * 1.5) * depthMul : 0;
        const parallaxY = frame >= 60 && frame <= 120 ? Math.sin(frame * 0.025 + i * 2.0) * depthMul * 0.5 : 0;

        const exitProgress = interpolate(frame, [120, 150], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
        });
        const exitAngle = (random(`check-exit-${i}`) - 0.5) * Math.PI * 2;
        const exitX = Math.cos(exitAngle) * 1500 * exitProgress;
        const exitY = Math.sin(exitAngle) * 1500 * exitProgress;
        const exitOpacity = interpolate(frame, [120, 140], [1, 0], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });

        const isEntering = frame < landFrame;
        const isExiting = frame >= 120;

        const offsetX = (random(`check-ox-${i}`) - 0.5) * 60;
        const baseX = (CANVAS_W - ITEM_W) / 2 + offsetX;
        const baseY = ITEM_START_Y + i * ITEM_SPACING;

        let x = baseX + parallaxX;
        let y = baseY + parallaxY;
        let opacity = 1;

        if (isEntering) { x += slide.translateX; y += slide.translateY; opacity = slide.opacity; }
        if (isExiting) { x += exitX; y += exitY; opacity = exitOpacity; }

        return (
          <div key={i} style={{ position: 'absolute', left: x, top: y, opacity, zIndex: depth }}>
            <div style={{ position: 'relative' }}>
              <ChecklistItem text={item.text} checked={item.checked ?? true} index={i} appearFrame={enterStart} checkFrame={checkFrame} />
              {random(`check-deco-${i}`) > 0.5 ? (
                <TapeMark corner={TAPE_CORNERS[i % 4]} seed={i} />
              ) : (
                <PinMark x={ITEM_W / 2} y={4} seed={i} />
              )}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export default MagazineChecklist;
