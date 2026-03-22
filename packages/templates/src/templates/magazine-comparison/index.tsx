import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { MagazineComparisonProps } from './schema';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { SectionLabel } from '../../magazine/typography';
import { TapeMark } from '../../magazine/decorations';
import { ComparisonHeader } from './components/ComparisonHeader';
import { ComparisonRow } from './components/ComparisonRow';
import { CenterDivider } from './components/CenterDivider';

const CANVAS_W = 1080;
const HEADER_Y = 140;
const HEADER_W = 960;
const FIRST_ROW_Y = 400;
const ROW_SPACING = 300;
const LEFT_X = 40;
const RIGHT_X = 580;
const ROW_STAGGER = 12;
const ENTER_DURATION = 25;
const LABEL_W = 200;

const MagazineComparison: React.FC<MagazineComparisonProps> = ({ leftLabel, rightLabel, items }) => {
  const frame = useCurrentFrame();

  const headerSlide = paperSlide(frame, 0, 20, 'down');
  const headerExitOpacity = interpolate(frame, [120, 140], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const isHeaderExiting = frame >= 120;

  const lastRowY = FIRST_ROW_Y + (items.length - 1) * ROW_SPACING;
  const dividerStartY = HEADER_Y + 160;
  const dividerEndY = lastRowY + 200;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{
        position: 'absolute',
        left: (CANVAS_W - HEADER_W) / 2 + headerSlide.translateX,
        top: HEADER_Y + headerSlide.translateY,
        opacity: isHeaderExiting ? headerExitOpacity : headerSlide.opacity,
      }}>
        <div style={{ position: 'relative' }}>
          <ComparisonHeader leftLabel={leftLabel} rightLabel={rightLabel} />
          <TapeMark corner="top-right" seed={55} />
        </div>
      </div>

      <CenterDivider startY={dividerStartY} endY={dividerEndY} />

      {items.map((item, i) => {
        const enterStart = 15 + i * ROW_STAGGER;
        const leftSlide = paperSlide(frame, enterStart, ENTER_DURATION, 'left');
        const rightSlide = paperSlide(frame, enterStart, ENTER_DURATION, 'right');
        const landFrame = enterStart + ENTER_DURATION;
        const labelReveal = editorialReveal(frame, landFrame, 12);

        const depth = i % 3;
        const depthMul = (depth + 1) * 5;
        const parallaxBase = frame >= 60 && frame <= 120 ? Math.sin(frame * 0.02 + i * 1.5) * depthMul : 0;
        const leftParallaxX = -parallaxBase;
        const rightParallaxX = parallaxBase;
        const parallaxY = frame >= 60 && frame <= 120 ? Math.sin(frame * 0.025 + i * 2.0) * depthMul * 0.4 : 0;

        const exitProgress = interpolate(frame, [120, 150], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
        });
        const exitOpacity = interpolate(frame, [120, 140], [1, 0], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });

        const isEntering = frame < landFrame;
        const isExiting = frame >= 120;
        const rowY = FIRST_ROW_Y + i * ROW_SPACING;

        let lx = LEFT_X + leftParallaxX;
        let ly = rowY + parallaxY;
        let lOpacity = 1;
        if (isEntering) { lx += leftSlide.translateX; ly += leftSlide.translateY; lOpacity = leftSlide.opacity; }
        if (isExiting) { lx += -1500 * exitProgress; lOpacity = exitOpacity; }

        let rx = RIGHT_X + rightParallaxX;
        let ry = rowY + parallaxY;
        let rOpacity = 1;
        if (isEntering) { rx += rightSlide.translateX; ry += rightSlide.translateY; rOpacity = rightSlide.opacity; }
        if (isExiting) { rx += 1500 * exitProgress; rOpacity = exitOpacity; }

        return (
          <React.Fragment key={i}>
            <div style={{
              position: 'absolute',
              left: (CANVAS_W - LABEL_W) / 2, top: rowY - 35,
              width: LABEL_W,
              opacity: labelReveal.opacity * (isExiting ? exitOpacity : 1),
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
