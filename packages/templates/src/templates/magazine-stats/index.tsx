import React from 'react';
import { AbsoluteFill, useCurrentFrame, random } from 'remotion';
import type { MagazineStatsProps } from './schema';
import { paperSlide } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline } from '../../magazine/typography';
import { TapeMark, PinMark } from '../../magazine/decorations';
import { computeSpeakerPx } from '../../depth';
import { StatCard } from './components/StatCard';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const TITLE_Y = 150;
const TITLE_W = 800;
const TITLE_H = 140;
const STAT_W = 460;
const STAT_H = 280;
const FIRST_STAT_W = 500;
const FIRST_STAT_H = 320;
const COLS = 2;
const ROWS = 3;
const GRID_TOP = 340; // push grid below title (title at y:150 + title height 140 + gap)
const CELL_W = CANVAS_W / COLS;
const CELL_H = (CANVAS_H - GRID_TOP) / ROWS;
const STAGGER = 10;
const ENTER_DURATION = 25;

const DIRECTIONS: Array<'left' | 'right' | 'up' | 'down'> = ['left', 'right', 'up', 'down'];
const TAPE_CORNERS: Array<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'> = [
  'top-right', 'top-left', 'bottom-right', 'bottom-left',
];

const CELL_SLOTS: Array<[number, number]> = [
  [0, 0], [1, 0], [0, 2], [1, 2], [0, 1], [1, 1],
];

function getStatPosition(index: number, w: number, h: number): { x: number; y: number } {
  const slot = CELL_SLOTS[index % CELL_SLOTS.length];
  const baseX = slot[0] * CELL_W + (CELL_W - w) / 2;
  const baseY = GRID_TOP + slot[1] * CELL_H + (CELL_H - h) / 2;
  const offsetX = (random(`stat-ox-${index}`) - 0.5) * 60;
  const offsetY = (random(`stat-oy-${index}`) - 0.5) * 60;
  return { x: baseX + offsetX, y: baseY + offsetY };
}

/**
 * Depth-mode positioning: scatter cards across full canvas so some overlap
 * with the speaker bbox edges (the person matte composited on top creates
 * the "peeking from behind" effect).
 */
function getDepthStatPosition(
  index: number,
  w: number,
  h: number,
  bboxPx: { x: number; y: number; w: number; h: number },
  total: number,
): { x: number; y: number } {
  const speakerLeft = bboxPx.x;
  const speakerRight = bboxPx.x + bboxPx.w;
  const speakerTop = bboxPx.y;
  const verticalSpread = bboxPx.h * 0.8;
  const verticalOffset = speakerTop + (bboxPx.h * 0.1) + (index / Math.max(total - 1, 1)) * verticalSpread;

  const isLeft = index % 2 === 0;
  let baseX: number;
  if (isLeft) {
    // Position so the right portion of the card overlaps the speaker's left edge
    baseX = speakerLeft - w * 0.6;
  } else {
    // Position so the left portion of the card overlaps the speaker's right edge
    baseX = speakerRight - w * 0.4;
  }

  const offsetX = (random(`depth-stat-ox-${index}`) - 0.5) * 40;
  const offsetY = (random(`depth-stat-oy-${index}`) - 0.5) * 40;

  const x = Math.max(-w * 0.3, Math.min(CANVAS_W - w * 0.7, baseX + offsetX));
  const y = Math.max(100, Math.min(CANVAS_H - h - 60, verticalOffset - h / 2 + offsetY));

  return { x, y };
}

const MagazineStats: React.FC<MagazineStatsProps> = ({ stats, title, speakerBbox, speakerCenter }) => {
  const frame = useCurrentFrame();

  const isDepthMode = !!speakerBbox && !!speakerCenter;
  const depthData = isDepthMode
    ? computeSpeakerPx(speakerBbox, speakerCenter, CANVAS_W, CANVAS_H)
    : null;

  const titleSlide = paperSlide(frame, 0, 15, 'up');

  const titleLeft = isDepthMode && depthData
    ? depthData.centerPx.x - TITLE_W / 2
    : (CANVAS_W - TITLE_W) / 2;
  const titleTop = isDepthMode && depthData
    ? Math.max(40, depthData.bboxPx.y - 180)
    : TITLE_Y;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{
        position: 'absolute',
        left: titleLeft + titleSlide.translateX,
        top: titleTop + titleSlide.translateY,
        opacity: titleSlide.opacity,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
      }}>
        <div style={{ position: 'relative' }}>
          <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={88} width={TITLE_W} height={TITLE_H}>
            <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
              <PaperTexture age={0.15} seed="stats-title" />
              <div style={{
                position: 'relative', zIndex: 1, width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 24, boxSizing: 'border-box',
              }}>
                <SerifHeadline text={title} size={39} />
              </div>
            </div>
          </TornEdge>
          <TapeMark corner="top-left" seed={88} />
        </div>
      </div>

      {stats.map((stat, i) => {
        const isFirst = i === 0;
        const w = isFirst ? FIRST_STAT_W : STAT_W;
        const h = isFirst ? FIRST_STAT_H : STAT_H;
        const pos = isDepthMode && depthData
          ? getDepthStatPosition(i, w, h, depthData.bboxPx, stats.length)
          : getStatPosition(i, w, h);
        const depth = i % 3;
        const depthMul = (depth + 1) * 8;

        const enterStart = 10 + i * STAGGER;
        const direction = DIRECTIONS[i % DIRECTIONS.length];
        const slide = paperSlide(frame, enterStart, ENTER_DURATION, direction);
        const landFrame = enterStart + ENTER_DURATION;
        const countUpStart = landFrame + 10;

        const parallaxX = frame >= 60 ? Math.sin(frame * 0.02 + i * 1.5) * depthMul : 0;
        const parallaxY = frame >= 60 ? Math.sin(frame * 0.025 + i * 2.0) * depthMul * 0.6 : 0;

        const isEntering = frame < landFrame;

        let x = pos.x + parallaxX;
        let y = pos.y + parallaxY;
        let opacity = 1;
        if (isEntering) { x += slide.translateX; y += slide.translateY; opacity = slide.opacity; }

        return (
          <div key={i} style={{ position: 'absolute', left: x, top: y, opacity, zIndex: depth }}>
            <div style={{ position: 'relative' }}>
              <StatCard value={stat.value} label={stat.label} index={i} countUpStart={countUpStart} width={w} height={h} />
              {random(`stat-deco-${i}`) > 0.5 ? (
                <TapeMark corner={TAPE_CORNERS[i % 4]} seed={i + 50} />
              ) : (
                <PinMark x={w / 2} y={4} seed={i + 50} />
              )}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export default MagazineStats;
