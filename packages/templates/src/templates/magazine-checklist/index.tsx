import React from 'react';
import { AbsoluteFill, useCurrentFrame, random } from 'remotion';
import type { MagazineChecklistProps } from './schema';
import { paperSlide } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline } from '../../magazine/typography';
import { TapeMark, PinMark } from '../../magazine/decorations';
import { computeSpeakerPx } from '../../depth';
import { ChecklistItem } from './components/ChecklistItem';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
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

const MagazineChecklist: React.FC<MagazineChecklistProps> = ({ items, title, speakerBbox, speakerCenter }) => {
  const frame = useCurrentFrame();

  const isDepthMode = !!speakerBbox && !!speakerCenter;
  const depthData = isDepthMode
    ? computeSpeakerPx(speakerBbox, speakerCenter, CANVAS_W, CANVAS_H)
    : null;

  // In depth mode, center items on speaker X at chest height, wider than speaker so text peeks from both sides
  const effectiveItemW = isDepthMode && depthData
    ? Math.max(ITEM_W, depthData.bboxPx.w + 300)
    : ITEM_W;
  const effectiveItemStartY = isDepthMode && depthData
    ? depthData.bboxPx.y + depthData.bboxPx.h * 0.25
    : ITEM_START_Y;
  const effectiveItemSpacing = isDepthMode && depthData
    ? Math.min(ITEM_SPACING, (CANVAS_H - effectiveItemStartY - 80) / Math.max(items.length, 1))
    : ITEM_SPACING;

  // Phase 1: Title entrance
  const titleSlide = paperSlide(frame, 0, 20, 'down');

  const titleLeft = isDepthMode && depthData
    ? depthData.centerPx.x - TITLE_W / 2
    : (CANVAS_W - TITLE_W) / 2;
  const titleTop = isDepthMode && depthData
    ? Math.max(40, depthData.bboxPx.y - 200)
    : TITLE_Y;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Title scrap */}
      <div style={{
        position: 'absolute',
        left: titleLeft + titleSlide.translateX,
        top: titleTop + titleSlide.translateY,
        opacity: titleSlide.opacity,
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
        const parallaxX = frame >= 60 ? Math.sin(frame * 0.02 + i * 1.5) * depthMul : 0;
        const parallaxY = frame >= 60 ? Math.sin(frame * 0.025 + i * 2.0) * depthMul * 0.5 : 0;

        const isEntering = frame < landFrame;

        const offsetX = (random(`check-ox-${i}`) - 0.5) * 60;
        let baseX: number;
        let baseY: number;
        if (isDepthMode && depthData) {
          // Center on speaker X, wider than speaker
          baseX = depthData.centerPx.x - effectiveItemW / 2 + offsetX;
          baseY = effectiveItemStartY + i * effectiveItemSpacing;
        } else {
          baseX = (CANVAS_W - ITEM_W) / 2 + offsetX;
          baseY = ITEM_START_Y + i * ITEM_SPACING;
        }

        let x = baseX + parallaxX;
        let y = baseY + parallaxY;
        let opacity = 1;

        if (isEntering) { x += slide.translateX; y += slide.translateY; opacity = slide.opacity; }

        const currentItemW = isDepthMode ? effectiveItemW : ITEM_W;

        return (
          <div key={i} style={{ position: 'absolute', left: x, top: y, opacity, zIndex: depth }}>
            <div style={{ position: 'relative' }}>
              <ChecklistItem text={item.text} checked={item.checked ?? true} index={i} appearFrame={enterStart} checkFrame={checkFrame} width={currentItemW} />
              {random(`check-deco-${i}`) > 0.5 ? (
                <TapeMark corner={TAPE_CORNERS[i % 4]} seed={i} />
              ) : (
                <PinMark x={currentItemW / 2} y={4} seed={i} />
              )}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export default MagazineChecklist;
