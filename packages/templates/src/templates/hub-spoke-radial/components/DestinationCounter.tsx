import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';

interface DestinationCounterProps {
  title: string;
  totalDestinations: number;
  completedCount: number;
  totalDistanceKm: number;
  showTotalCount: boolean;
  showDistances: boolean;
  distanceVisible: boolean;
  frame: number;
  titleEnterFrame: number;
  headlineFont: string;
  bodyFont: string;
  textColor: string;
  primaryColor: string;
  darkMap: boolean;
}

const DestinationCounter: React.FC<DestinationCounterProps> = ({
  title,
  totalDestinations,
  completedCount,
  totalDistanceKm,
  showTotalCount,
  showDistances,
  distanceVisible,
  frame,
  titleEnterFrame,
  headlineFont,
  bodyFont,
  textColor,
  primaryColor,
  darkMap,
}) => {
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [titleEnterFrame, titleEnterFrame + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const titleSlideY = interpolate(frame, [titleEnterFrame, titleEnterFrame + 20], [-20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (frame < titleEnterFrame) return null;

  const textShadow = darkMap
    ? '0 2px 8px rgba(0,0,0,0.9), 0 0 16px rgba(0,0,0,0.5)'
    : '0 2px 8px rgba(255,255,255,0.9), 0 0 16px rgba(255,255,255,0.5)';

  const bgColor = darkMap ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.65)';

  // Distance spring entrance
  const distanceScale = distanceVisible
    ? spring({
        frame: Math.max(0, frame - titleEnterFrame - 30),
        fps,
        config: { damping: 26, stiffness: 120, mass: 1.0 },
      })
    : 0;

  return (
    <div
      style={{
        position: 'absolute',
        top: 40,
        left: '50%',
        transform: `translateX(-50%) translateY(${titleSlideY}px)`,
        opacity: titleOpacity,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {/* Background pill */}
      <div
        style={{
          backgroundColor: bgColor,
          backdropFilter: 'blur(8px)',
          borderRadius: 20,
          padding: '16px 36px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {/* Title */}
        <div
          style={{
            fontFamily: headlineFont,
            fontSize: 42,
            fontWeight: 700,
            color: textColor,
            textShadow,
            whiteSpace: 'nowrap',
            letterSpacing: 1,
          }}
        >
          {title}
        </div>

        {/* Destination count */}
        {showTotalCount && completedCount > 0 && (
          <div
            style={{
              fontFamily: bodyFont,
              fontSize: 26,
              fontWeight: 600,
              color: primaryColor,
              textShadow,
              whiteSpace: 'nowrap',
            }}
          >
            {completedCount} {completedCount === 1 ? 'destination' : 'destinations'}
          </div>
        )}

        {/* Total distance */}
        {showDistances && distanceVisible && (
          <div
            style={{
              fontFamily: bodyFont,
              fontSize: 22,
              fontWeight: 500,
              color: textColor,
              textShadow,
              whiteSpace: 'nowrap',
              opacity: 0.85,
              transform: `scale(${distanceScale})`,
            }}
          >
            {Math.round(totalDistanceKm).toLocaleString('en-US')} km total
          </div>
        )}
      </div>
    </div>
  );
};

export default DestinationCounter;
