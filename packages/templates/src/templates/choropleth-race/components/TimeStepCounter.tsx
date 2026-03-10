import React from 'react';
import { interpolate, spring } from 'remotion';

interface TimeStepCounterProps {
  timeLabels: string[];
  frame: number;
  enterFrame: number;
  fps: number;
  font: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
}

const TimeStepCounter: React.FC<TimeStepCounterProps> = ({
  timeLabels,
  frame,
  enterFrame,
  fps,
  font,
  colors,
}) => {
  if (frame < enterFrame) return null;

  const localFrame = frame - enterFrame;

  // Spring entrance
  const enterScale = spring({
    frame: localFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const opacity = interpolate(localFrame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Determine which time label to show: interpolate frame [40, 300] to [0, labels.length - 1]
  const timeIndex = interpolate(frame, [40, 300], [0, timeLabels.length - 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const currentLabel = timeLabels[Math.round(timeIndex)] ?? timeLabels[0];

  return (
    <div
      style={{
        position: 'absolute',
        top: 32,
        left: '50%',
        transform: `translateX(-50%) scale(${enterScale})`,
        opacity,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Pill container */}
      <div
        style={{
          backgroundColor: colors.primary,
          borderRadius: 50,
          paddingTop: 12,
          paddingBottom: 12,
          paddingLeft: 36,
          paddingRight: 36,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: `0 4px 20px ${colors.primary}55`,
        }}
      >
        {/* Year label */}
        <div
          style={{
            fontFamily: font,
            fontSize: 48,
            fontWeight: 800,
            color: 'white',
            letterSpacing: 3,
            lineHeight: 1,
          }}
        >
          {currentLabel}
        </div>
      </div>
    </div>
  );
};

export default TimeStepCounter;
