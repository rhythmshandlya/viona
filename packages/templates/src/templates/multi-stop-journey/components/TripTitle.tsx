import React from 'react';
import { spring, useVideoConfig } from 'remotion';

interface TripTitleProps {
  title: string;
  frame: number;
  font: string;
  color: string;
  darkMap: boolean;
}

const TripTitle: React.FC<TripTitleProps> = ({
  title,
  frame,
  font,
  color,
  darkMap,
}) => {
  const { fps } = useVideoConfig();

  const opacity = spring({
    frame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  if (frame < 0) return null;

  const textShadow = darkMap
    ? '0 2px 6px rgba(0,0,0,0.8)'
    : '0 2px 6px rgba(255,255,255,0.8)';

  return (
    <div
      style={{
        position: 'absolute',
        top: 40,
        left: '50%',
        transform: 'translateX(-50%)',
        opacity,
        fontFamily: font,
        fontSize: 42,
        fontWeight: 700,
        color,
        textShadow,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {title}
    </div>
  );
};

export default TripTitle;
