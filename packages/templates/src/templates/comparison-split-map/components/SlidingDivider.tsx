import React from 'react';
import { interpolate, spring } from 'remotion';

interface SlidingDividerProps {
  /** Pixel position from the left edge where the divider sits */
  dividerX: number;
  height: number;
  color: string;
  frame: number;
  fps: number;
}

const SlidingDivider: React.FC<SlidingDividerProps> = ({
  dividerX,
  height,
  color,
  frame,
  fps,
}) => {
  // Handle entrance scale pulse
  const handleScale = spring({
    frame: frame - 25,
    fps,
    config: { damping: 22, stiffness: 180, mass: 0.8 },
    from: 0,
    to: 1,
  });

  // Subtle glow pulse on the handle
  const glowOpacity = interpolate(
    frame,
    [30, 60, 120, 180],
    [0, 1, 0.6, 0.4],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const LINE_WIDTH = 3;
  const HANDLE_SIZE = 44;
  const centerY = height / 2;

  return (
    <div
      style={{
        position: 'absolute',
        left: dividerX - LINE_WIDTH / 2,
        top: 0,
        width: LINE_WIDTH,
        height,
        pointerEvents: 'none',
      }}
    >
      {/* Main divider line */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: color,
          opacity: 0.9,
          boxShadow: `0 0 8px ${color}80, 0 0 20px ${color}40`,
        }}
      />

      {/* Center diamond handle */}
      <div
        style={{
          position: 'absolute',
          left: -(HANDLE_SIZE / 2) + LINE_WIDTH / 2,
          top: centerY - HANDLE_SIZE / 2,
          width: HANDLE_SIZE,
          height: HANDLE_SIZE,
          transform: `scale(${handleScale}) rotate(45deg)`,
          backgroundColor: color,
          boxShadow: `0 0 ${12 * glowOpacity}px ${color}, 0 0 ${24 * glowOpacity}px ${color}80`,
          borderRadius: 4,
        }}
      />

      {/* Arrow indicators inside handle */}
      <div
        style={{
          position: 'absolute',
          left: -(HANDLE_SIZE / 2) + LINE_WIDTH / 2,
          top: centerY - HANDLE_SIZE / 2,
          width: HANDLE_SIZE,
          height: HANDLE_SIZE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          transform: `scale(${handleScale})`,
          opacity: 0.6,
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#000',
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          ◀▶
        </span>
      </div>
    </div>
  );
};

export default SlidingDivider;
