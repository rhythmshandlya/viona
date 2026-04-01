// packages/templates/src/templates/magazine-timeline-depth/index.tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, random } from 'remotion';
import type { MagazineTimelineDepthProps } from './schema';
import { paperSlide } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline } from '../../magazine/typography';
import { TapeMark } from '../../magazine/decorations';
import { TimelineThread } from '../magazine-timeline/components/TimelineThread';
import { EventCard } from '../magazine-timeline/components/EventCard';
import { computeSpeakerPx } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const TITLE_Y = 80;
const TITLE_W = 800;
const TITLE_H = 140;
const CARD_H = 200;
const CARD_W = 440;
const STAGGER = 14;
const ENTER_DURATION = 25;

const MagazineTimelineDepth: React.FC<MagazineTimelineDepthProps> = ({
  events = [],
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

  // Timeline spans the full canvas height, centered on speaker
  const eventSpacing = Math.min(320, (CANVAS_H - 400) / Math.max(events.length, 1));
  const firstEventY = Math.max(280, centerPx.y - (events.length * eventSpacing) / 2);
  const eventYPositions = events.map((_, i) => firstEventY + i * eventSpacing);
  const threadStartY = firstEventY - 40;
  const threadEndY = eventYPositions[events.length - 1] + CARD_H + 40;

  const titleSlide = paperSlide(frame, 0, 15, 'down');

  const nodeLandFrames = events.map((_, i) => 20 + i * STAGGER + ENTER_DURATION);
  const nodeYPositions = eventYPositions.map((y) => y + CARD_H / 2);

  // Thread runs through speaker center X
  const threadX = centerPx.x;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Title */}
      <div style={{
        position: 'absolute',
        left: (CANVAS_W - TITLE_W) / 2 + titleSlide.translateX,
        top: TITLE_Y + titleSlide.translateY,
        opacity: titleSlide.opacity,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
        zIndex: 10,
      }}>
        <div style={{ position: 'relative' }}>
          <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={77} width={TITLE_W} height={TITLE_H}>
            <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
              <PaperTexture age={0.15} seed="depth-timeline-title" />
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

      {/* Timeline thread — behind speaker center */}
      <div style={{ position: 'absolute', left: threadX - 2, top: 0, width: 4, height: CANVAS_H }}>
        <TimelineThread startY={threadStartY} endY={threadEndY} nodeYPositions={nodeYPositions} nodeLandFrames={nodeLandFrames} />
      </div>

      {/* Event cards — alternating sides, peeking from behind shoulders */}
      {events.map((event, i) => {
        const isLeft = i % 2 === 0;
        const enterStart = 20 + i * STAGGER;
        const slide = paperSlide(frame, enterStart, ENTER_DURATION, isLeft ? 'left' : 'right');
        const landFrame = enterStart + ENTER_DURATION;

        const depth = i % 3;
        const depthMul = (depth + 1) * 8;
        const parallaxX = frame >= 70 ? Math.sin(frame * 0.02 + i * 1.5) * depthMul : 0;
        const parallaxY = frame >= 70 ? Math.sin(frame * 0.025 + i * 2.0) * depthMul * 0.5 : 0;

        const isEntering = frame < landFrame;

        // Position cards to peek from behind speaker's shoulders
        const baseX = isLeft
          ? bboxPx.x - CARD_W * 0.6   // Left card: extends behind left shoulder
          : bboxPx.x + bboxPx.w - CARD_W * 0.4; // Right card: extends behind right shoulder
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

export default MagazineTimelineDepth;
