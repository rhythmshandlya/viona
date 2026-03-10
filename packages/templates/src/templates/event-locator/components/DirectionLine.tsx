import React from 'react';
import { spring, interpolate } from 'remotion';
import { AnimatedPath } from '../../../lib/map';

interface DirectionLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  frame: number;
  startFrame: number;
  endFrame: number;
  lineColor: string;
  viewportWidth: number;
  viewportHeight: number;
  maskId: string;
  font: { headline: string; body: string };
  darkMap: boolean;
}

const DirectionLine: React.FC<DirectionLineProps> = ({
  x1,
  y1,
  x2,
  y2,
  label,
  frame,
  startFrame,
  endFrame,
  lineColor,
  viewportWidth,
  viewportHeight,
  maskId,
  font,
  darkMap,
}) => {
  // Dot appears when line starts
  const dotEnterFrame = startFrame;
  const labelEnterFrame = startFrame + 8;

  const dotVisible = frame >= dotEnterFrame;
  const labelVisible = frame >= labelEnterFrame;

  // Dot scale spring
  const dotScale = dotVisible
    ? spring({
        frame: frame - dotEnterFrame,
        fps: 30,
        config: { damping: 26, stiffness: 120, mass: 1.0 },
      })
    : 0;

  const dotScaleClamped = interpolate(dotScale, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Label fade in
  const labelOpacity = labelVisible
    ? interpolate(frame - labelEnterFrame, [0, 12], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;

  const labelSlideY = labelVisible
    ? interpolate(
        spring({
          frame: frame - labelEnterFrame,
          fps: 30,
          config: { damping: 26, stiffness: 120, mass: 1.0 },
        }),
        [0, 1],
        [8, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      )
    : 8;

  const dotRadius = 7;
  const textColor = darkMap ? '#FFFFFF' : '#2C3E50';
  const textShadow = darkMap
    ? '0 1px 4px rgba(0,0,0,0.8)'
    : '0 1px 4px rgba(255,255,255,0.9)';

  return (
    <>
      {/* Animated dashed path from landmark to venue */}
      <AnimatedPath
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        frame={frame}
        startFrame={startFrame}
        endFrame={endFrame}
        lineColor={lineColor}
        lineWidth={2}
        lineStyle="dashed"
        curveIntensity={0.2}
        width={viewportWidth}
        height={viewportHeight}
        maskId={maskId}
      />

      {/* Landmark source dot */}
      {dotVisible && (
        <div
          style={{
            position: 'absolute',
            left: x1,
            top: y1,
            transform: `translate(-50%, -50%) scale(${dotScaleClamped})`,
            transformOrigin: 'center center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: dotRadius * 2,
              height: dotRadius * 2,
              borderRadius: '50%',
              backgroundColor: lineColor,
              border: '2px solid white',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            }}
          />
        </div>
      )}

      {/* Landmark label */}
      {labelVisible && (
        <div
          style={{
            position: 'absolute',
            left: x1,
            top: y1 - dotRadius - 4,
            transform: `translate(-50%, -100%) translateY(${labelSlideY}px)`,
            opacity: labelOpacity,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <span
            style={{
              fontFamily: font.body,
              fontSize: 11,
              fontWeight: 600,
              color: textColor,
              textShadow,
              letterSpacing: '0.02em',
            }}
          >
            {label}
          </span>
        </div>
      )}
    </>
  );
};

export default DirectionLine;
