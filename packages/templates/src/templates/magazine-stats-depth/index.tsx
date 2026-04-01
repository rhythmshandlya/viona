// packages/templates/src/templates/magazine-stats-depth/index.tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, random } from 'remotion';
import type { MagazineStatsDepthProps } from './schema';
import { paperSlide } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline } from '../../magazine/typography';
import { TapeMark, PinMark } from '../../magazine/decorations';
import { StatCard } from '../magazine-stats/components/StatCard';
import { computeSpeakerPx, computeVisibleZones } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const TITLE_Y = 120;
const TITLE_W = 800;
const TITLE_H = 140;
const STAT_W = 500;
const STAT_H = 320;
const STAGGER = 10;
const ENTER_DURATION = 25;

const DIRECTIONS: Array<'left' | 'right' | 'up' | 'down'> = ['left', 'right', 'up', 'down'];
const TAPE_CORNERS: Array<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'> = [
  'top-right', 'top-left', 'bottom-right', 'bottom-left',
];

/**
 * Position stat cards to peek from behind the speaker's edges.
 * Cards are placed at shoulder/torso height — partially occluded by
 * the person matte for the depth effect, fully visible in the side zones.
 */
function getDepthStatPosition(
  index: number,
  count: number,
  speakerPx: { x: number; y: number; w: number; h: number },
  zones: ReturnType<typeof computeVisibleZones>,
): { x: number; y: number } {
  const speakerRight = speakerPx.x + speakerPx.w;
  const chestY = speakerPx.y + speakerPx.h * 0.3;

  // Alternate cards between left-peek, right-peek, and side zones
  const positions: Array<{ x: number; y: number }> = [
    // Card 0: left side, peeking behind left shoulder
    { x: zones.left.w - STAT_W * 0.4, y: chestY - 60 },
    // Card 1: right side, peeking behind right shoulder
    { x: speakerRight - STAT_W * 0.6, y: chestY + 40 },
    // Card 2: top-left visible zone
    { x: 40, y: CANVAS_H * 0.08 },
    // Card 3: bottom-right visible zone
    { x: CANVAS_W - STAT_W - 40, y: CANVAS_H * 0.78 },
    // Card 4: center-left, behind torso
    { x: zones.left.w - STAT_W * 0.2, y: chestY + 280 },
    // Card 5: center-right, behind torso
    { x: speakerRight - STAT_W * 0.8, y: chestY + 200 },
  ];

  const pos = positions[index % positions.length];
  const jitterX = (random(`depth-stat-jx-${index}`) - 0.5) * 40;
  const jitterY = (random(`depth-stat-jy-${index}`) - 0.5) * 40;
  return { x: pos.x + jitterX, y: pos.y + jitterY };
}

const MagazineStatsDepth: React.FC<MagazineStatsDepthProps> = ({
  stats = [],
  title,
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

  const titleSlide = paperSlide(frame, 0, 15, 'up');

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Title — in a visible zone (top area) */}
      <div style={{
        position: 'absolute',
        left: (CANVAS_W - TITLE_W) / 2 + titleSlide.translateX,
        top: TITLE_Y + titleSlide.translateY,
        opacity: titleSlide.opacity,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
        zIndex: 10,
      }}>
        <div style={{ position: 'relative' }}>
          <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={88} width={TITLE_W} height={TITLE_H}>
            <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
              <PaperTexture age={0.15} seed="depth-stats-title" />
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

      {/* Stat cards — positioned to peek from behind speaker */}
      {stats.map((stat, i) => {
        const pos = getDepthStatPosition(i, stats.length, bboxPx, zones);
        const depth = i % 3;
        const depthMul = (depth + 1) * 10;

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
              <StatCard value={stat.value} label={stat.label} index={i} countUpStart={countUpStart} width={STAT_W} height={STAT_H} />
              {random(`depth-stat-deco-${i}`) > 0.5 ? (
                <TapeMark corner={TAPE_CORNERS[i % 4]} seed={i + 50} />
              ) : (
                <PinMark x={STAT_W / 2} y={4} seed={i + 50} />
              )}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export default MagazineStatsDepth;
