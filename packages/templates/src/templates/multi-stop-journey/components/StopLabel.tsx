import React from 'react';
import { interpolate } from 'remotion';

interface StopLabelProps {
  x: number;
  y: number;
  label: string;
  date?: string;
  frame: number;
  enterFrame: number;
  showDate: boolean;
  headlineFont: string;
  bodyFont: string;
  textColor: string;
  viewportWidth: number;
  darkMap: boolean;
}

const StopLabel: React.FC<StopLabelProps> = ({
  x,
  y,
  label,
  date,
  frame,
  enterFrame,
  showDate,
  headlineFont,
  bodyFont,
  textColor,
  viewportWidth,
  darkMap,
}) => {
  if (frame < enterFrame) return null;

  const opacity = interpolate(frame, [enterFrame, enterFrame + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const slideY = interpolate(frame, [enterFrame, enterFrame + 15], [6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Place label on the side with more horizontal space
  const isLeftHalf = x < viewportWidth / 2;
  const offsetX = isLeftHalf ? 22 : -22;

  const textShadow = darkMap
    ? '0 1px 4px rgba(0,0,0,0.9), 0 0px 8px rgba(0,0,0,0.7)'
    : '0 1px 4px rgba(255,255,255,0.9), 0 0px 8px rgba(255,255,255,0.7)';

  return (
    <div
      style={{
        position: 'absolute',
        left: x + offsetX,
        top: y - 8,
        transform: isLeftHalf
          ? `translateY(calc(-50% + ${slideY}px))`
          : `translate(-100%, calc(-50% + ${slideY}px))`,
        opacity,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <div
        style={{
          fontFamily: headlineFont,
          fontSize: 22,
          fontWeight: 700,
          color: textColor,
          textShadow,
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>
      {showDate && date && (
        <div
          style={{
            fontFamily: bodyFont,
            fontSize: 14,
            fontWeight: 400,
            color: textColor,
            opacity: 0.7,
            textShadow,
            marginTop: 2,
            lineHeight: 1.2,
          }}
        >
          {date}
        </div>
      )}
    </div>
  );
};

export default StopLabel;
