import React from 'react';
import { AbsoluteFill, useCurrentFrame, random } from 'remotion';
import type { MagazineTimelineProps } from './schema';
import { paperSlide } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline } from '../../magazine/typography';
import { TapeMark } from '../../magazine/decorations';
import { TimelineThread } from './components/TimelineThread';
import { EventCard } from './components/EventCard';

const CANVAS_W = 1080;
const TITLE_Y = 120;
const TITLE_W = 800;
const TITLE_H = 140;
const CARD_H = 200;
const FIRST_EVENT_Y = 360;
const EVENT_SPACING = 320;
const STAGGER = 14;
const ENTER_DURATION = 25;
const CARD_W = 440;

const MagazineTimeline: React.FC<MagazineTimelineProps> = ({ events, title }) => {
  const frame = useCurrentFrame();

  const eventYPositions = events.map((_, i) => FIRST_EVENT_Y + i * EVENT_SPACING);
  const threadStartY = FIRST_EVENT_Y - 40;
  const threadEndY = eventYPositions[events.length - 1] + CARD_H + 40;

  const titleSlide = paperSlide(frame, 0, 15, 'down');

  const nodeLandFrames = events.map((_, i) => 20 + i * STAGGER + ENTER_DURATION);
  const nodeYPositions = eventYPositions.map((y) => y + CARD_H / 2);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{
        position: 'absolute',
        left: (CANVAS_W - TITLE_W) / 2 + titleSlide.translateX,
        top: TITLE_Y + titleSlide.translateY,
        opacity: titleSlide.opacity,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
      }}>
        <div style={{ position: 'relative' }}>
          <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={77} width={TITLE_W} height={TITLE_H}>
            <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
              <PaperTexture age={0.15} seed="timeline-title" />
              <div style={{
                position: 'relative', zIndex: 1, width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 24, boxSizing: 'border-box',
              }}>
                <SerifHeadline text={title} size={39} />
              </div>
            </div>
          </TornEdge>
          <TapeMark corner="top-left" seed={77} />
        </div>
      </div>

      <TimelineThread startY={threadStartY} endY={threadEndY} nodeYPositions={nodeYPositions} nodeLandFrames={nodeLandFrames} />

      {events.map((event, i) => {
        const isLeft = i % 2 === 0;
        const enterStart = 20 + i * STAGGER;
        const slide = paperSlide(frame, enterStart, ENTER_DURATION, isLeft ? 'left' : 'right');
        const landFrame = enterStart + ENTER_DURATION;

        const depth = i % 3;
        const depthMul = (depth + 1) * 6;
        const parallaxX = frame >= 70 ? Math.sin(frame * 0.02 + i * 1.5) * depthMul : 0;
        const parallaxY = frame >= 70 ? Math.sin(frame * 0.025 + i * 2.0) * depthMul * 0.5 : 0;

        const isEntering = frame < landFrame;
        const baseX = isLeft ? 540 - CARD_W - 30 : 540 + 30;
        const baseY = eventYPositions[i];

        let x = baseX + parallaxX;
        let y = baseY + parallaxY;
        let opacity = 1;
        if (isEntering) { x += slide.translateX; y += slide.translateY; opacity = slide.opacity; }

        return (
          <div key={i} style={{ position: 'absolute', left: x, top: y, opacity, zIndex: depth + 1 }}>
            <EventCard year={event.year} text={event.text} index={i} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export default MagazineTimeline;
