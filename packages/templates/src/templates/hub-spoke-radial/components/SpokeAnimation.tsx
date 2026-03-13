import React from 'react';
import { interpolate, Easing } from 'remotion';

interface SpokeAnimationProps {
  hubX: number;
  hubY: number;
  destX: number;
  destY: number;
  frame: number;
  startFrame: number;
  drawDuration: number;
  lineColor: string;
  lineWidth: number;
  spokeStyle: 'solid' | 'dashed' | 'dotted';
  viewportWidth: number;
  viewportHeight: number;
  spokeIndex: number;
}

const SpokeAnimation: React.FC<SpokeAnimationProps> = ({
  hubX,
  hubY,
  destX,
  destY,
  frame,
  startFrame,
  drawDuration,
  lineColor,
  lineWidth,
  spokeStyle,
  viewportWidth,
  viewportHeight,
  spokeIndex,
}) => {
  const endFrame = startFrame + drawDuration;

  const progress = interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  if (frame < startFrame) return null;

  const d = `M ${hubX} ${hubY} L ${destX} ${destY}`;
  const maskId = `spoke-mask-${spokeIndex}`;

  function getStrokeDasharray(): string | undefined {
    switch (spokeStyle) {
      case 'dashed':
        return `${lineWidth * 3} ${lineWidth * 2}`;
      case 'dotted':
        return `2 8`;
      case 'solid':
      default:
        return undefined;
    }
  }

  return (
    <svg
      width={viewportWidth}
      height={viewportHeight}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
    >
      <defs>
        <mask id={maskId}>
          <path
            d={d}
            fill="none"
            stroke="white"
            strokeWidth={lineWidth + 4}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={1 - progress}
          />
        </mask>
      </defs>

      <path
        d={d}
        fill="none"
        stroke={lineColor}
        strokeWidth={lineWidth}
        strokeLinecap="round"
        mask={`url(#${maskId})`}
        strokeDasharray={getStrokeDasharray()}
      />
    </svg>
  );
};

export default SpokeAnimation;
