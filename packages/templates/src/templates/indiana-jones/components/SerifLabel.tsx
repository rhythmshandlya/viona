import React from 'react';
import { spring, useVideoConfig } from 'remotion';

interface SerifLabelProps {
  x: number;
  y: number;
  label: string;
  frame: number;
  enterFrame: number;
  font: string;
  color: string;
}

/**
 * Serif font city label with a subtle drop shadow.
 * Springs in with scale + opacity at enterFrame.
 */
const SerifLabel: React.FC<SerifLabelProps> = ({
  x,
  y,
  label,
  frame,
  enterFrame,
  font,
  color,
}) => {
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  if (frame < enterFrame) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + 18,
        transform: `translate(-50%, 0) scale(${0.7 + progress * 0.3})`,
        opacity: progress,
        fontFamily: font,
        fontSize: 16,
        fontWeight: 600,
        color,
        textShadow: '1px 1px 3px rgba(0, 0, 0, 0.4)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        letterSpacing: '0.05em',
      }}
    >
      {label}
    </div>
  );
};

export default SerifLabel;
