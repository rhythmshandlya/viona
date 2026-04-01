import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import type { MagazineComparisonProps } from './schema';
import { paperSlide, editorialReveal } from '../../magazine/animations';
import { SectionLabel } from '../../magazine/typography';
import { TapeMark } from '../../magazine/decorations';
import { computeSpeakerPx } from '../../depth';
import { ComparisonHeader } from './components/ComparisonHeader';
import { ComparisonRow } from './components/ComparisonRow';
import { CenterDivider } from './components/CenterDivider';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const HEADER_Y = 140;
const HEADER_W = 960;
const FIRST_ROW_Y = 400;
const ROW_SPACING = 300;
const LEFT_X = 40;
const RIGHT_X = 580;
const ROW_STAGGER = 12;
const ENTER_DURATION = 25;
const LABEL_W = 200;

const MagazineComparison: React.FC<MagazineComparisonProps> = ({ leftLabel, rightLabel, items, speakerBbox, speakerCenter }) => {
  const frame = useCurrentFrame();

  const isDepthMode = !!speakerBbox && !!speakerCenter;
  const depthData = isDepthMode
    ? computeSpeakerPx(speakerBbox, speakerCenter, CANVAS_W, CANVAS_H)
    : null;

  const headerSlide = paperSlide(frame, 0, 20, 'down');

  // In depth mode, position left subject behind speaker's left edge, right behind right edge
  const effectiveLeftX = isDepthMode && depthData
    ? depthData.bboxPx.x - 480  // left column peeks behind speaker's left edge
    : LEFT_X;
  const effectiveRightX = isDepthMode && depthData
    ? depthData.bboxPx.x + depthData.bboxPx.w - 20  // right column peeks behind speaker's right edge
    : RIGHT_X;
  const effectiveFirstRowY = isDepthMode && depthData
    ? Math.max(FIRST_ROW_Y, depthData.bboxPx.y + 80)
    : FIRST_ROW_Y;
  const effectiveRowSpacing = isDepthMode && depthData
    ? Math.min(ROW_SPACING, (CANVAS_H - effectiveFirstRowY - 100) / Math.max(items.length, 1))
    : ROW_SPACING;

  const lastRowY = effectiveFirstRowY + (items.length - 1) * effectiveRowSpacing;

  const headerLeft = isDepthMode && depthData
    ? depthData.centerPx.x - HEADER_W / 2
    : (CANVAS_W - HEADER_W) / 2;
  const headerTop = isDepthMode && depthData
    ? Math.max(40, depthData.bboxPx.y - 180)
    : HEADER_Y;

  const dividerCenterX = isDepthMode && depthData ? depthData.centerPx.x : CANVAS_W / 2;
  const dividerStartY = headerTop + 160;
  const dividerEndY = lastRowY + 200;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{
        position: 'absolute',
        left: headerLeft + headerSlide.translateX,
        top: headerTop + headerSlide.translateY,
        opacity: headerSlide.opacity,
      }}>
        <div style={{ position: 'relative' }}>
          <ComparisonHeader leftLabel={leftLabel} rightLabel={rightLabel} />
          <TapeMark corner="top-right" seed={55} />
        </div>
      </div>

      <CenterDivider startY={dividerStartY} endY={dividerEndY} centerX={isDepthMode ? dividerCenterX : undefined} />

      {items.map((item, i) => {
        const enterStart = 15 + i * ROW_STAGGER;
        const leftSlide = paperSlide(frame, enterStart, ENTER_DURATION, 'left');
        const rightSlide = paperSlide(frame, enterStart, ENTER_DURATION, 'right');
        const landFrame = enterStart + ENTER_DURATION;
        const labelReveal = editorialReveal(frame, landFrame, 12);

        const depth = i % 3;
        const depthMul = (depth + 1) * 5;
        const parallaxBase = frame >= 60 ? Math.sin(frame * 0.02 + i * 1.5) * depthMul : 0;
        const leftParallaxX = -parallaxBase;
        const rightParallaxX = parallaxBase;
        const parallaxY = frame >= 60 ? Math.sin(frame * 0.025 + i * 2.0) * depthMul * 0.4 : 0;

        const isEntering = frame < landFrame;
        const rowY = effectiveFirstRowY + i * effectiveRowSpacing;

        let lx = effectiveLeftX + leftParallaxX;
        let ly = rowY + parallaxY;
        let lOpacity = 1;
        if (isEntering) { lx += leftSlide.translateX; ly += leftSlide.translateY; lOpacity = leftSlide.opacity; }

        let rx = effectiveRightX + rightParallaxX;
        let ry = rowY + parallaxY;
        let rOpacity = 1;
        if (isEntering) { rx += rightSlide.translateX; ry += rightSlide.translateY; rOpacity = rightSlide.opacity; }

        const labelCenterX = isDepthMode && depthData ? depthData.centerPx.x : CANVAS_W / 2;

        return (
          <React.Fragment key={i}>
            <div style={{
              position: 'absolute',
              left: labelCenterX - LABEL_W / 2, top: rowY - 35,
              width: LABEL_W,
              opacity: labelReveal.opacity,
              transform: `translateY(${labelReveal.translateY}px)`,
              zIndex: 5,
            }}>
              <SectionLabel label={item.category} />
            </div>

            <div style={{ position: 'absolute', left: lx, top: ly, opacity: lOpacity, zIndex: depth }}>
              <ComparisonRow text={item.left} side="left" index={i} />
            </div>

            <div style={{ position: 'absolute', left: rx, top: ry, opacity: rOpacity, zIndex: depth }}>
              <ComparisonRow text={item.right} side="right" index={i} />
            </div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

export default MagazineComparison;
