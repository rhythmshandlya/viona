import React from 'react';
import { spring, useVideoConfig } from 'remotion';

interface RoadSignLabelProps {
  x: number;
  y: number;
  label: string;
  frame: number;
  enterFrame: number;
  font: string;
}

/**
 * US highway sign style label — green background with double white border.
 * Always uses highway green + white regardless of map theme.
 */
const RoadSignLabel: React.FC<RoadSignLabelProps> = ({
  x,
  y,
  label,
  frame,
  enterFrame,
  font,
}) => {
  const { fps } = useVideoConfig();

  if (frame < enterFrame) return null;

  const localFrame = frame - enterFrame;

  const scale = spring({
    frame: localFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y - 30,
        transform: `translate(-50%, -100%) scale(${scale})`,
        transformOrigin: 'bottom center',
        pointerEvents: 'none',
      }}
    >
      {/* Sign body */}
      <div
        style={{
          position: 'relative',
          backgroundColor: '#006B3F',
          border: '2px solid white',
          borderRadius: 4,
          padding: '8px 16px',
        }}
      >
        {/* Inner border (authentic US highway sign double-border) */}
        <div
          style={{
            position: 'absolute',
            inset: 3,
            border: '1px solid rgba(255, 255, 255, 0.7)',
            borderRadius: 2,
            pointerEvents: 'none',
          }}
        />

        <span
          style={{
            fontFamily: font,
            fontSize: 18,
            fontWeight: 700,
            color: 'white',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
            position: 'relative',
          }}
        >
          {label}
        </span>
      </div>

      {/* Arrow pointer */}
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: '7px solid transparent',
          borderRight: '7px solid transparent',
          borderTop: '7px solid white',
          margin: '0 auto',
        }}
      />
    </div>
  );
};

export default RoadSignLabel;
