import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

/**
 * Semi-transparent drifting cloud blobs rendered as SVG paths.
 * Each cloud drifts horizontally at a different speed and oscillates opacity.
 */

interface CloudDef {
  /** SVG path data for the cloud shape */
  d: string;
  /** Width of the SVG viewBox */
  width: number;
  /** Height of the SVG viewBox */
  height: number;
  /** Starting X position (px from left) */
  startX: number;
  /** Y position (px from top) */
  y: number;
  /** Horizontal drift distance over 360 frames */
  driftX: number;
  /** Opacity phase offset (frames) */
  phaseOffset: number;
  /** Scale factor */
  scale: number;
}

const CLOUD_DEFS: CloudDef[] = [
  {
    // Large wispy cloud — top-right area, drifts left
    d: 'M40 80 Q60 20 120 40 Q180 10 240 50 Q300 30 340 70 Q360 110 300 120 Q240 140 180 130 Q100 140 60 120 Q20 110 40 80Z',
    width: 380,
    height: 160,
    startX: 1200,
    y: 80,
    driftX: -180,
    phaseOffset: 0,
    scale: 1.1,
  },
  {
    // Medium cloud — center-left, drifts right
    d: 'M30 60 Q50 15 100 35 Q150 5 200 40 Q250 20 270 55 Q290 90 240 100 Q180 115 120 105 Q60 115 30 90 Q10 80 30 60Z',
    width: 300,
    height: 120,
    startX: -50,
    y: 350,
    driftX: 220,
    phaseOffset: 120,
    scale: 0.9,
  },
  {
    // Small wispy cloud — bottom area, drifts left slowly
    d: 'M20 50 Q40 10 90 30 Q140 5 180 35 Q210 55 170 70 Q120 85 70 75 Q30 80 20 50Z',
    width: 230,
    height: 90,
    startX: 900,
    y: 650,
    driftX: -100,
    phaseOffset: 200,
    scale: 1.0,
  },
];

const CloudLayer: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {CLOUD_DEFS.map((cloud, i) => {
        const translateX = interpolate(frame, [0, 360], [0, cloud.driftX], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        // Oscillate opacity between 0.08 and 0.25 using a sine-like curve
        const opacityCycle = interpolate(
          ((frame + cloud.phaseOffset) % 180),
          [0, 90, 180],
          [0.08, 0.25, 0.08],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );

        return (
          <svg
            key={i}
            width={cloud.width * cloud.scale}
            height={cloud.height * cloud.scale}
            viewBox={`0 0 ${cloud.width} ${cloud.height}`}
            style={{
              position: 'absolute',
              left: cloud.startX + translateX,
              top: cloud.y,
              opacity: opacityCycle,
            }}
          >
            <path d={cloud.d} fill="white" />
          </svg>
        );
      })}
    </div>
  );
};

export default CloudLayer;
