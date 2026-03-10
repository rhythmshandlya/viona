import React from 'react';
import { interpolate, spring } from 'remotion';

interface DateCounterProps {
  currentDate: string;
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

const DateCounter: React.FC<DateCounterProps> = ({
  currentDate,
  frame,
  enterFrame,
  fps,
  font,
  colors,
}) => {
  if (frame < enterFrame) return null;

  const localFrame = frame - enterFrame;

  // Spring entrance scale (SMOOTH config)
  const enterScale = spring({
    frame: localFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const opacity = interpolate(localFrame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

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
        zIndex: 20,
      }}
    >
      {/* Semi-transparent pill background */}
      <div
        style={{
          backgroundColor: colors.primary,
          borderRadius: 50,
          paddingTop: 10,
          paddingBottom: 10,
          paddingLeft: 32,
          paddingRight: 32,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: `0 4px 20px ${colors.primary}55`,
        }}
      >
        {/* Year label */}
        <div
          style={{
            fontFamily: font,
            fontSize: 46,
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: 3,
            lineHeight: 1,
          }}
        >
          {currentDate}
        </div>
      </div>
    </div>
  );
};

export default DateCounter;
