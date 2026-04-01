import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import type { DepthListBuildProps } from './schema';
import { computeSpeakerPx } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const PILL_H = 64;
const PILL_PAD_X = 36;
const PILL_RADIUS = 32;
const VERTICAL_GAP = 18;
const STAGGER = 14;
const ENTER_DURATION = 18;

const DepthListBuild: React.FC<DepthListBuildProps> = ({
  items, speakerBbox, speakerCenter,
}) => {
  const frame = useCurrentFrame();
  const { bboxPx } = computeSpeakerPx(speakerBbox, speakerCenter, CANVAS_W, CANVAS_H);

  const leftItems: Array<{ text: string; index: number }> = [];
  const rightItems: Array<{ text: string; index: number }> = [];
  items.forEach((text, i) => {
    if (i % 2 === 0) leftItems.push({ text, index: i });
    else rightItems.push({ text, index: i });
  });

  const stackCenterY = bboxPx.y + bboxPx.h * 0.45;

  function getStackY(stackIndex: number, totalInStack: number): number {
    const totalHeight = totalInStack * (PILL_H + VERTICAL_GAP) - VERTICAL_GAP;
    const startY = stackCenterY - totalHeight / 2;
    return startY + stackIndex * (PILL_H + VERTICAL_GAP);
  }

  const lastItemIndex = items.length - 1;
  const lastItemEnterEnd = 10 + lastItemIndex * STAGGER + ENTER_DURATION;

  function renderPill(
    text: string, itemIndex: number, side: 'left' | 'right',
    stackIndex: number, totalInStack: number,
  ) {
    const enterStart = 10 + itemIndex * STAGGER;
    const y = getStackY(stackIndex, totalInStack);

    const slideDistance = side === 'left' ? -500 : 500;
    const translateX = interpolate(frame, [enterStart, enterStart + ENTER_DURATION], [slideDistance, 0], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.08)),
    });
    const pillOpacity = interpolate(frame, [enterStart, enterStart + 8], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });

    const isLatestVisible = itemIndex === lastItemIndex && frame >= lastItemEnterEnd;
    const pulsePhase = isLatestVisible ? Math.sin((frame - lastItemEnterEnd) * 0.12) * 0.5 + 0.5 : 0;
    const glowIntensity = pulsePhase * 0.25;

    let x: number;
    if (side === 'left') {
      x = bboxPx.x - PILL_PAD_X - 20;
    } else {
      x = bboxPx.x + bboxPx.w + 20;
    }
    x = Math.max(20, Math.min(CANVAS_W - 20, x));

    return (
      <div key={itemIndex} style={{
        position: 'absolute',
        left: side === 'left' ? undefined : x,
        right: side === 'left' ? CANVAS_W - x : undefined,
        top: y,
        transform: `translateX(${translateX}px)`,
        opacity: pillOpacity,
        willChange: 'transform, opacity',
      }}>
        <div style={{
          height: PILL_H,
          borderRadius: PILL_RADIUS,
          background: `rgba(255, 255, 255, ${0.10 + glowIntensity})`,
          backdropFilter: 'blur(10px)',
          border: `1px solid rgba(255, 255, 255, ${0.18 + glowIntensity * 0.3})`,
          boxShadow: isLatestVisible
            ? `0 4px 20px rgba(255, 255, 255, ${glowIntensity * 0.4}), 0 2px 8px rgba(0, 0, 0, 0.2)`
            : '0 4px 16px rgba(0, 0, 0, 0.2), 0 1px 4px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          alignItems: 'center',
          padding: `0 ${PILL_PAD_X}px`,
          whiteSpace: 'nowrap' as const,
        }}>
          <span style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: 600,
            fontSize: 28,
            color: 'rgba(255, 255, 255, 0.92)',
            textShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
            lineHeight: 1,
          }}>{text}</span>
        </div>
      </div>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {leftItems.map((item, stackIdx) => renderPill(item.text, item.index, 'left', stackIdx, leftItems.length))}
      {rightItems.map((item, stackIdx) => renderPill(item.text, item.index, 'right', stackIdx, rightItems.length))}
    </AbsoluteFill>
  );
};

export default DepthListBuild;
