import React from 'react';
import { useCurrentFrame, random } from 'remotion';
import type { MagazineStatsProps } from './schema';
import { editorialReveal } from '../../magazine/animations';
import { SerifHeadline } from '../../magazine/typography';
import { TapeMark, PinMark } from '../../magazine/decorations';
import { MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';
import { StatCard } from './components/StatCard';
import { ScaledContainer } from '../../magazine/ScaledContainer';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const STAT_W = 460;
const STAT_H = 280;
const FIRST_STAT_W = 500;
const FIRST_STAT_H = 320;
const COLS = 2;
const ROWS = 3;
const GRID_TOP = 340;
const CELL_W = CANVAS_W / COLS;
const CELL_H = (CANVAS_H - GRID_TOP) / ROWS;
const STAGGER = 8;

const CELL_SLOTS: Array<[number, number]> = [
  [0, 0], [1, 0], [0, 2], [1, 2], [0, 1], [1, 1],
];

const TAPE_CORNERS: Array<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'> = [
  'top-right', 'top-left', 'bottom-right', 'bottom-left',
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

  const titleReveal = editorialReveal(frame, 3, 14);

  return (
    <ScaledContainer baseWidth={1080} baseHeight={1920}>
      {/* Title */}
      <div style={{
        position: 'absolute', left: 0, top: 150, width: CANVAS_W,
        display: 'flex', justifyContent: 'center',
        opacity: titleReveal.opacity,
        transform: `translateY(${titleReveal.translateY}px)`,
      }}>
        <SerifHeadline text={title} size={FONT_SIZES.h1} />
      </div>

      {/* Accent rule */}
      <div style={{
        position: 'absolute', left: CANVAS_W / 2 - 40, top: 245,
        width: 80, height: 3, borderRadius: 1.5,
        backgroundColor: MAGAZINE_COLORS.accent,
        opacity: titleReveal.opacity,
      }} />

      {stats.map((stat, i) => {
        const isFirst = i === 0;
        const w = isFirst ? FIRST_STAT_W : STAT_W;
        const h = isFirst ? FIRST_STAT_H : STAT_H;
        const pos = getStatPosition(i, w, h);
        const depth = i % 3;

        const revealStart = 10 + i * STAGGER;
        const reveal = editorialReveal(frame, revealStart, 14);
        const countUpStart = revealStart + 14;

        return (
          <div key={i} style={{
            position: 'absolute', left: pos.x, top: pos.y,
            opacity: reveal.opacity,
            transform: `translateY(${reveal.translateY}px)`,
            zIndex: depth,
          }}>
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
    </ScaledContainer>
  );
};

export default MagazineStats;
