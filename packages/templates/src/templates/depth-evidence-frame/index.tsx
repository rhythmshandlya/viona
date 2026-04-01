import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import type { DepthEvidenceFrameProps } from './schema';
import { computeSpeakerPx, computeVisibleZones } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const CARD_W = 340;
const CARD_H = 160;
const STAGGER = 18;
const ENTER_DURATION = 22;

interface CardPosition { x: number; y: number; slideFrom: 'left' | 'right'; }

function getCardPositions(
  count: number,
  zones: ReturnType<typeof computeVisibleZones>,
  bboxPx: { x: number; y: number; w: number; h: number },
): CardPosition[] {
  const positions: CardPosition[] = [];
  const topMargin = bboxPx.y + bboxPx.h * 0.1;
  const bottomMargin = bboxPx.y + bboxPx.h * 0.85;
  const verticalSpan = bottomMargin - topMargin;

  for (let i = 0; i < count; i++) {
    const isLeft = i % 2 === 0;
    const verticalSlot = topMargin + (i / Math.max(count - 1, 1)) * verticalSpan;
    const y = verticalSlot - CARD_H / 2;
    let x: number;
    if (isLeft) {
      x = Math.max(20, zones.left.w - CARD_W - 10);
    } else {
      x = bboxPx.x + bboxPx.w + 10;
      x = Math.min(x, CANVAS_W - CARD_W - 20);
    }
    positions.push({ x, y, slideFrom: isLeft ? 'left' : 'right' });
  }
  return positions;
}

const DepthEvidenceFrame: React.FC<DepthEvidenceFrameProps> = ({
  items, speakerBbox, speakerCenter,
}) => {
  const frame = useCurrentFrame();
  const { bboxPx } = computeSpeakerPx(speakerBbox, speakerCenter, CANVAS_W, CANVAS_H);
  const zones = computeVisibleZones(bboxPx, CANVAS_W, CANVAS_H);
  const positions = getCardPositions(items.length, zones, bboxPx);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {items.map((item, i) => {
        const pos = positions[i];
        const enterStart = 10 + i * STAGGER;
        const slideOffset = pos.slideFrom === 'left' ? -CARD_W - 100 : CARD_W + 100;
        const translateX = interpolate(frame, [enterStart, enterStart + ENTER_DURATION], [slideOffset, 0], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.05)),
        });
        const cardOpacity = interpolate(frame, [enterStart, enterStart + 8], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });
        const settledFrame = enterStart + ENTER_DURATION + 10;
        const driftActive = frame > settledFrame ? 1 : 0;
        const driftX = driftActive * Math.sin(frame * 0.018 + i * 2.0) * 5;
        const driftY = driftActive * Math.cos(frame * 0.022 + i * 1.5) * 3;

        return (
          <div key={i} style={{ position: 'absolute', left: pos.x + translateX + driftX, top: pos.y + driftY, opacity: cardOpacity, willChange: 'transform, opacity' }}>
            <div style={{ width: CARD_W, height: CARD_H, borderRadius: 20, background: 'rgba(255, 255, 255, 0.10)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.18)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.15)', display: 'flex', alignItems: 'center', gap: 20, padding: '0 28px', boxSizing: 'border-box' }}>
              <div style={{ fontSize: 52, lineHeight: 1, flexShrink: 0 }}>{item.icon}</div>
              <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: 600, fontSize: 30, lineHeight: 1.25, color: 'rgba(255, 255, 255, 0.92)', textShadow: '0 2px 8px rgba(0, 0, 0, 0.3)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.label}</div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export default DepthEvidenceFrame;
