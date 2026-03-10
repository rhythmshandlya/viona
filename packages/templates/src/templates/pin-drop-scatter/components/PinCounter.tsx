import React from 'react';
import { spring, useVideoConfig } from 'remotion';

interface PinCounterProps {
  current: number;
  total: number;
  frame: number;
  enterFrame: number;
  font: string;
  colors: {
    primary: string;
    text: string;
    background: string;
  };
}

const PinCounter: React.FC<PinCounterProps> = ({
  current,
  total,
  frame,
  enterFrame,
  font,
  colors,
}) => {
  const { fps } = useVideoConfig();

  if (frame < enterFrame) return null;

  const localFrame = frame - enterFrame;

  const scale = spring({
    frame: localFrame,
    fps,
    config: { damping: 22, stiffness: 180, mass: 0.8 },
  });

  return (
    <div
      style={{
        position: 'absolute',
        top: 100,
        left: '50%',
        transform: `translateX(-50%) scale(${scale})`,
        transformOrigin: 'center top',
        zIndex: 20,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          backgroundColor: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(8px)',
          borderRadius: 40,
          paddingTop: 10,
          paddingBottom: 10,
          paddingLeft: 24,
          paddingRight: 24,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          fontFamily: font,
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: colors.primary,
            lineHeight: 1,
            minWidth: 28,
            textAlign: 'center',
          }}
        >
          {current}
        </span>
        <span
          style={{
            fontSize: 22,
            fontWeight: 500,
            color: 'rgba(0,0,0,0.4)',
            lineHeight: 1,
          }}
        >
          /
        </span>
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: colors.text,
            lineHeight: 1,
          }}
        >
          {total}
        </span>
        <span
          style={{
            fontSize: 18,
            fontWeight: 500,
            color: 'rgba(0,0,0,0.5)',
            lineHeight: 1,
            marginLeft: 4,
          }}
        >
          locations
        </span>
      </div>
    </div>
  );
};

export default PinCounter;
