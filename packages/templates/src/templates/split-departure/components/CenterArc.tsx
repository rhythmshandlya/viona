import React from 'react';
import { interpolate, Easing } from 'remotion';

interface CenterArcProps {
  /** Full composition width. */
  width: number;
  /** Full composition height. */
  height: number;
  frame: number;
  lineColor: string;
  splitDirection: 'horizontal' | 'vertical';
}

/**
 * Animated arc drawn in the gap between the two panels.
 * Uses SVG stroke-dashoffset for the draw-in animation.
 */
const CenterArc: React.FC<CenterArcProps> = ({
  width,
  height,
  frame,
  lineColor,
  splitDirection,
}) => {
  // Draw-in timeline: frames 60-200
  const drawProgress = interpolate(frame, [60, 200], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  if (drawProgress <= 0) return null;

  // Build path depending on split direction
  let pathD: string;
  let svgWidth: number;
  let svgHeight: number;
  let svgLeft: number;
  let svgTop: number;

  if (splitDirection === 'vertical') {
    // Arc runs horizontally across the center gap (top/bottom split)
    const centerY = height / 2;
    const padding = width * 0.1;
    const startX = padding;
    const endX = width - padding;
    const midX = width / 2;
    // Control point curves upward
    const controlY = centerY - 80;

    pathD = `M ${startX} ${centerY} Q ${midX} ${controlY} ${endX} ${centerY}`;
    svgWidth = width;
    svgHeight = 200;
    svgLeft = 0;
    svgTop = centerY - 100;
  } else {
    // Arc runs vertically across the center gap (left/right split)
    const centerX = width / 2;
    const padding = height * 0.1;
    const startY = padding;
    const endY = height - padding;
    const midY = height / 2;
    // Control point curves to the left
    const controlX = centerX - 80;

    pathD = `M ${centerX} ${startY} Q ${controlX} ${midY} ${centerX} ${endY}`;
    svgWidth = 200;
    svgHeight = height;
    svgLeft = centerX - 100;
    svgTop = 0;
  }

  // Estimate path length for dash animation (generous overestimate is fine)
  const estimatedLength = splitDirection === 'vertical' ? width : height;

  const dashOffset = estimatedLength * (1 - drawProgress);

  // Glow opacity fades in with draw
  const glowOpacity = interpolate(frame, [60, 100], [0, 0.6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      viewBox={`${svgLeft} ${svgTop} ${svgWidth} ${svgHeight}`}
      style={{
        position: 'absolute',
        left: svgLeft,
        top: svgTop,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {/* Glow layer */}
      <path
        d={pathD}
        fill="none"
        stroke={lineColor}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={estimatedLength}
        strokeDashoffset={dashOffset}
        opacity={glowOpacity}
        filter="url(#arcGlow)"
      />
      {/* Main arc line */}
      <path
        d={pathD}
        fill="none"
        stroke={lineColor}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={estimatedLength}
        strokeDashoffset={dashOffset}
      />

      {/* SVG filter for glow */}
      <defs>
        <filter id="arcGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
};

export default CenterArc;
