import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import type { DepthBigNumberProps } from './schema';
import { computeSpeakerPx } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;

const DepthBigNumber: React.FC<DepthBigNumberProps> = ({
  value,
  label,
  speakerBbox,
  speakerCenter,
}) => {
  const frame = useCurrentFrame();

  const { centerPx, bboxPx } = computeSpeakerPx(
    speakerBbox,
    speakerCenter,
    CANVAS_W,
    CANVAS_H,
  );

  // --- Value entrance: scale up from 0.3 to 1.0 with back easing ---
  const entranceDuration = 25;
  const scale = interpolate(frame, [5, 5 + entranceDuration], [0.3, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.back(1.2)),
  });

  const valueOpacity = interpolate(frame, [5, 13], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Subtle parallax drift after entrance settles ---
  const settledFrame = 5 + entranceDuration + 10;
  const driftActive = frame > settledFrame ? 1 : 0;
  const driftX = driftActive * Math.sin(frame * 0.015) * 6;
  const driftY = driftActive * Math.cos(frame * 0.02) * 3;

  // --- Label fade in after value lands ---
  const labelDelay = 5 + entranceDuration + 5;
  const labelOpacity = interpolate(frame, [labelDelay, labelDelay + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labelSlideY = interpolate(frame, [labelDelay, labelDelay + 15], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.ease),
  });

  // Position the number at speaker chest height
  const numberY = centerPx.y + bboxPx.h * 0.05;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Big number — centered on speaker, wider than speaker body */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: CANVAS_W,
          height: CANVAS_H,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: numberY,
            left: centerPx.x,
            transform: `translate(-50%, -50%) scale(${scale}) translate(${driftX}px, ${driftY}px)`,
            transformOrigin: 'center center',
            opacity: valueOpacity,
            willChange: 'transform, opacity',
          }}
        >
          <div
            style={{
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: 800,
              fontSize: 260,
              lineHeight: 1,
              color: 'rgba(255, 255, 255, 0.92)',
              textShadow: '0 6px 40px rgba(0, 0, 0, 0.5), 0 2px 10px rgba(0, 0, 0, 0.3)',
              whiteSpace: 'nowrap',
              letterSpacing: -8,
              textAlign: 'center',
            }}
          >
            {value}
          </div>
        </div>

        {/* Label — positioned below the speaker bbox in the visible bottom zone */}
        <div
          style={{
            position: 'absolute',
            top: bboxPx.y + bboxPx.h + 40,
            left: centerPx.x,
            transform: `translate(-50%, ${labelSlideY}px)`,
            opacity: labelOpacity,
            willChange: 'transform, opacity',
          }}
        >
          <div
            style={{
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: 500,
              fontSize: 42,
              lineHeight: 1.3,
              color: 'rgba(255, 255, 255, 0.85)',
              textShadow: '0 3px 16px rgba(0, 0, 0, 0.5)',
              textAlign: 'center',
              maxWidth: 700,
              whiteSpace: 'pre-wrap',
            }}
          >
            {label}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default DepthBigNumber;
