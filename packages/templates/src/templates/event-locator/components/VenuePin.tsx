import React from 'react';
import { spring, interpolate } from 'remotion';

interface VenuePinProps {
  x: number;
  y: number;
  frame: number;
  enterFrame: number;
  fps: number;
  accentColor: string;
}

const VenuePin: React.FC<VenuePinProps> = ({
  x,
  y,
  frame,
  enterFrame,
  fps,
  accentColor,
}) => {
  if (frame < enterFrame) return null;

  const localFrame = frame - enterFrame;

  // Drop bounce: starts high, springs down
  const dropSpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 22, stiffness: 180, mass: 0.8 },
  });

  // Translate from above: -120px → 0
  const translateY = interpolate(dropSpring, [0, 1], [-120, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Scale pop on landing
  const scaleSpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });
  const scale = interpolate(scaleSpring, [0, 1], [0.5, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Pin size (2x normal)
  const pinWidth = 56;
  const pinHeight = 72;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -100%) translateY(${translateY}px) scale(${scale})`,
        transformOrigin: 'center bottom',
        pointerEvents: 'none',
      }}
    >
      <svg
        width={pinWidth}
        height={pinHeight}
        viewBox="0 0 56 72"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.35)) drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
        }}
      >
        {/* Teardrop body */}
        <path
          d="M28 0C12.536 0 0 12.536 0 28c0 21 28 44 28 44s28-23 28-44C56 12.536 43.464 0 28 0z"
          fill={accentColor}
        />
        {/* Inner white circle */}
        <circle cx="28" cy="26" r="11" fill="white" opacity="0.95" />
        {/* Accent dot in center */}
        <circle cx="28" cy="26" r="5" fill={accentColor} />
        {/* Shine highlight */}
        <ellipse cx="22" cy="18" rx="5" ry="3" fill="white" opacity="0.3" transform="rotate(-25 22 18)" />
      </svg>
    </div>
  );
};

export default VenuePin;
