// packages/templates/src/templates/magazine-comparison-depth/index.tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, random } from 'remotion';
import type { MagazineComparisonDepthProps } from './schema';
import { paperSlide, editorialReveal } from '../../magazine/animations';
import { SectionLabel } from '../../magazine/typography';
import { TapeMark } from '../../magazine/decorations';
import { ComparisonHeader } from '../magazine-comparison/components/ComparisonHeader';
import { ComparisonRow } from '../magazine-comparison/components/ComparisonRow';
import { CenterDivider } from '../magazine-comparison/components/CenterDivider';
import { computeSpeakerPx, computeVisibleZones } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const HEADER_Y = 100;
const HEADER_W = 960;
const ROW_SPACING = 300;
const ROW_W = 460;
const LABEL_W = 200;
const ROW_STAGGER = 12;
const ENTER_DURATION = 25;

const MagazineComparisonDepth: React.FC<MagazineComparisonDepthProps> = ({
  leftLabel,
  rightLabel,
  items = [],
  speakerBbox,
  speakerCenter,
}) => {
  const frame = useCurrentFrame();

  const { bboxPx, centerPx } = computeSpeakerPx(
    speakerBbox,
    speakerCenter,
    CANVAS_W,
    CANVAS_H,
  );
  const zones = computeVisibleZones(bboxPx, CANVAS_W, CANVAS_H);

  const headerSlide = paperSlide(frame, 0, 20, 'down');

  // Rows start below the header, centered vertically around speaker
  const firstRowY = Math.max(360, centerPx.y - (items.length * ROW_SPACING) / 2);
  const lastRowY = firstRowY + (items.length - 1) * ROW_SPACING;
  const dividerStartY = HEADER_Y + 160;
  const dividerEndY = lastRowY + 200;

  // Left cards peek from behind speaker's left side
  // Right cards peek from behind speaker's right side
  const leftBaseX = bboxPx.x - ROW_W * 0.55;
  const rightBaseX = bboxPx.x + bboxPx.w - ROW_W * 0.45;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Header — top visible zone */}
      <div style={{
        position: 'absolute',
        left: (CANVAS_W - HEADER_W) / 2 + headerSlide.translateX,
        top: HEADER_Y + headerSlide.translateY,
        opacity: headerSlide.opacity,
        zIndex: 10,
      }}>
        <div style={{ position: 'relative' }}>
          <ComparisonHeader leftLabel={leftLabel} rightLabel={rightLabel} />
          <TapeMark corner="top-right" seed={55} />
        </div>
      </div>

      {/* Center divider — runs through speaker center */}
      <CenterDivider startY={dividerStartY} endY={dividerEndY} />

      {/* Comparison rows — peek from behind speaker's shoulders */}
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
        const rowY = firstRowY + i * ROW_SPACING;

        let lx = leftBaseX + leftParallaxX;
        let ly = rowY + parallaxY;
        let lOpacity = 1;
        if (isEntering) { lx += leftSlide.translateX; ly += leftSlide.translateY; lOpacity = leftSlide.opacity; }

        let rx = rightBaseX + rightParallaxX;
        let ry = rowY + parallaxY;
        let rOpacity = 1;
        if (isEntering) { rx += rightSlide.translateX; ry += rightSlide.translateY; rOpacity = rightSlide.opacity; }

        return (
          <React.Fragment key={i}>
            {/* Category label — centered at speaker X */}
            <div style={{
              position: 'absolute',
              left: centerPx.x - LABEL_W / 2, top: rowY - 35,
              width: LABEL_W,
              opacity: labelReveal.opacity,
              transform: `translateY(${labelReveal.translateY}px)`,
              zIndex: 5,
            }}>
              <SectionLabel label={item.category} />
            </div>

            {/* Left card — peeks from behind left shoulder */}
            <div style={{ position: 'absolute', left: lx, top: ly, opacity: lOpacity, zIndex: depth }}>
              <ComparisonRow text={item.left} side="left" index={i} />
            </div>

            {/* Right card — peeks from behind right shoulder */}
            <div style={{ position: 'absolute', left: rx, top: ry, opacity: rOpacity, zIndex: depth }}>
              <ComparisonRow text={item.right} side="right" index={i} />
            </div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

export default MagazineComparisonDepth;
