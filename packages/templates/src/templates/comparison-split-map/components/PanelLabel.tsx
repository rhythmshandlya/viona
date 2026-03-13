import React from 'react';
import { spring, interpolate } from 'remotion';

interface PanelLabelProps {
  label: string;
  /** Horizontal center position as a percentage across the full width (0–100) */
  xPercent: number;
  /** Vertical position in pixels from the top */
  y: number;
  frame: number;
  enterFrame: number;
  fps: number;
  font: string;
  textColor: string;
  darkBackground: boolean;
}

const PanelLabel: React.FC<PanelLabelProps> = ({
  label,
  xPercent,
  y,
  frame,
  enterFrame,
  fps,
  font,
  textColor,
  darkBackground,
}) => {
  const relFrame = frame - enterFrame;

  const scale = spring({
    frame: relFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
    from: 0.75,
    to: 1,
  });

  const opacity = interpolate(relFrame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const translateY = interpolate(relFrame, [0, 18], [16, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const bgColor = darkBackground ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)';
  const borderColor = darkBackground ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';

  return (
    <div
      style={{
        position: 'absolute',
        left: `${xPercent}%`,
        top: y,
        transform: `translateX(-50%) translateY(${translateY}px) scale(${scale})`,
        opacity,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: 32,
          fontWeight: 700,
          color: textColor,
          backgroundColor: bgColor,
          border: `1.5px solid ${borderColor}`,
          borderRadius: 48,
          paddingTop: 12,
          paddingBottom: 12,
          paddingLeft: 32,
          paddingRight: 32,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          backdropFilter: 'blur(8px)',
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
        }}
      >
        {label}
      </div>
    </div>
  );
};

export default PanelLabel;
