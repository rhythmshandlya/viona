import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, random } from 'remotion';
import type { MagazineStatsProps } from './schema';
import { paperSlide, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline } from '../../magazine/typography';
import { TapeMark, PinMark } from '../../magazine/decorations';
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

const MagazineStats: React.FC<MagazineStatsProps> = ({ stats, title }) => {
  const frame = useCurrentFrame();

  const titleSlide = paperSlide(frame, 0, 15, 'up');
  const titleExitOpacity = interpolate(frame, [120, 140], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const isTitleExiting = frame >= 120;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{
        position: 'absolute',
        left: (CANVAS_W - TITLE_W) / 2 + titleSlide.translateX,
        top: TITLE_Y + titleSlide.translateY,
        opacity: isTitleExiting ? titleExitOpacity : titleSlide.opacity,
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
        const pos = getStatPosition(i, w, h);
        const depth = i % 3;
        const depthMul = (depth + 1) * 8;

        const enterStart = 10 + i * STAGGER;
        const direction = DIRECTIONS[i % DIRECTIONS.length];
        const slide = paperSlide(frame, enterStart, ENTER_DURATION, direction);
        const landFrame = enterStart + ENTER_DURATION;
        const countUpStart = landFrame + 10;

        const parallaxX = frame >= 60 && frame <= 120 ? Math.sin(frame * 0.02 + i * 1.5) * depthMul : 0;
        const parallaxY = frame >= 60 && frame <= 120 ? Math.sin(frame * 0.025 + i * 2.0) * depthMul * 0.6 : 0;

        const exitProgress = interpolate(frame, [120, 150], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
        });
        const exitAngle = (random(`stat-exit-${i}`) - 0.5) * Math.PI * 2;
        const exitX = Math.cos(exitAngle) * 1500 * exitProgress;
        const exitY = Math.sin(exitAngle) * 1500 * exitProgress;
        const exitOpacity = interpolate(frame, [120, 140], [1, 0], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });

        const isEntering = frame < landFrame;
        const isExiting = frame >= 120;

        let x = pos.x + parallaxX;
        let y = pos.y + parallaxY;
        let opacity = 1;
        if (isEntering) { x += slide.translateX; y += slide.translateY; opacity = slide.opacity; }
        if (isExiting) { x += exitX; y += exitY; opacity = exitOpacity; }

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
