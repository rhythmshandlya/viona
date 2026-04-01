import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { SpeakerData, VisibleZones } from './types';
import { computeVisibleZones } from './types';

export type LayoutMode = 'peekLeft' | 'peekRight' | 'behindCenter' | 'flanking';

interface SpeakerAwareLayoutProps {
  speaker: SpeakerData;
  canvasW: number;
  canvasH: number;
  mode: LayoutMode;
  children: React.ReactNode;
  /** Extra padding around the speaker bbox in px (default 20) */
  padding?: number;
}

/**
 * Positions children relative to the speaker bounding box.
 *
 * - peekLeft: places content in the left visible zone
 * - peekRight: places content in the right visible zone
 * - behindCenter: centers content behind the speaker midpoint
 * - flanking: splits children across left and right zones
 */
export const SpeakerAwareLayout: React.FC<SpeakerAwareLayoutProps> = ({
  speaker,
  canvasW,
  canvasH,
  mode,
  children,
  padding = 20,
}) => {
  const zones = computeVisibleZones(speaker.bboxPx, canvasW, canvasH);

  const zoneStyle = (zone: VisibleZones[keyof VisibleZones]): React.CSSProperties => ({
    position: 'absolute',
    left: zone.x + padding,
    top: zone.y + padding,
    width: Math.max(0, zone.w - padding * 2),
    height: Math.max(0, zone.h - padding * 2),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  if (mode === 'peekLeft') {
    return (
      <AbsoluteFill>
        <div style={zoneStyle(zones.left)}>{children}</div>
      </AbsoluteFill>
    );
  }

  if (mode === 'peekRight') {
    return (
      <AbsoluteFill>
        <div style={zoneStyle(zones.right)}>{children}</div>
      </AbsoluteFill>
    );
  }

  if (mode === 'behindCenter') {
    const childArr = React.Children.toArray(children);
    return (
      <AbsoluteFill>
        <div
          style={{
            position: 'absolute',
            left: speaker.centerPx.x,
            top: speaker.centerPx.y,
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {childArr}
        </div>
      </AbsoluteFill>
    );
  }

  // flanking: split children across left and right
  const childArr = React.Children.toArray(children);
  const mid = Math.ceil(childArr.length / 2);
  const leftChildren = childArr.slice(0, mid);
  const rightChildren = childArr.slice(mid);

  return (
    <AbsoluteFill>
      <div style={zoneStyle(zones.left)}>{leftChildren}</div>
      <div style={zoneStyle(zones.right)}>{rightChildren}</div>
    </AbsoluteFill>
  );
};
