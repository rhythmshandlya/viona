import React from 'react';
import { spring, interpolate, useVideoConfig } from 'remotion';

interface PanelLabelProps {
  label: string;
  frame: number;
  enterFrame: number;
  font: string;
  textColor: string;
  accentColor: string;
  /** Position within the panel. */
  panelWidth: number;
  panelHeight: number;
  /** Offset from the composition origin for positioning. */
  offsetX: number;
  offsetY: number;
  /** Optional subtitle (e.g. "DEPARTURE" or "ARRIVAL"). */
  subtitle?: string;
}

/**
 * City label overlay for each panel. Appears with a spring animation
 * as a pill with semi-transparent background.
 */
const PanelLabel: React.FC<PanelLabelProps> = ({
  label,
  frame,
  enterFrame,
  font,
  textColor,
  accentColor,
  panelWidth,
  panelHeight,
  offsetX,
  offsetY,
  subtitle,
}) => {
  const { fps } = useVideoConfig();

  if (frame < enterFrame) return null;

  const localFrame = frame - enterFrame;

  const scaleProgress = spring({
    frame: localFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const opacity = interpolate(localFrame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Position at bottom-center of each panel
  const labelX = offsetX + panelWidth / 2;
  const labelY = offsetY + panelHeight - 80;

  return (
    <div
      style={{
        position: 'absolute',
        left: labelX,
        top: labelY,
        transform: `translate(-50%, 0) scale(${scaleProgress})`,
        transformOrigin: 'center top',
        opacity,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        pointerEvents: 'none',
      }}
    >
      {subtitle && (
        <div
          style={{
            fontFamily: font,
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: accentColor,
            textShadow: '0 1px 4px rgba(0,0,0,0.3)',
          }}
        >
          {subtitle}
        </div>
      )}
      <div
        style={{
          fontFamily: font,
          fontSize: 36,
          fontWeight: 700,
          color: textColor,
          backgroundColor: 'rgba(0, 0, 0, 0.55)',
          padding: '10px 28px',
          borderRadius: 40,
          backdropFilter: 'blur(8px)',
          whiteSpace: 'nowrap',
          textShadow: '0 2px 6px rgba(0,0,0,0.4)',
        }}
      >
        {label}
      </div>
    </div>
  );
};

export default PanelLabel;
