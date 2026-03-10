import React from 'react';
import { spring, interpolate } from 'remotion';

interface CoverageWaveProps {
  cx: number;
  cy: number;
  radiusPixels: number;
  label?: string;
  frame: number;
  enterFrame: number;
  fps: number;
  color: string;
  font: string;
}

const CoverageWave: React.FC<CoverageWaveProps> = ({
  cx,
  cy,
  radiusPixels,
  label,
  frame,
  enterFrame,
  fps,
  color,
  font,
}) => {
  if (frame < enterFrame) return null;

  const localFrame = frame - enterFrame;

  // Scale from 0 → 1 using smooth spring
  const scaleSpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const scale = interpolate(scaleSpring, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Opacity: fade in then hold
  const opacity = interpolate(localFrame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Label fade in once wave is mostly expanded (after ~20 frames)
  const labelOpacity = interpolate(localFrame, [20, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const r = radiusPixels * scale;
  const labelX = cx + r;
  const labelY = cy;

  // Convert hex color to rgba for fill
  const fillOpacity = 0.12;

  return (
    <g>
      {/* Semi-transparent fill */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={color}
        fillOpacity={fillOpacity * opacity}
        stroke={color}
        strokeWidth={2}
        strokeOpacity={opacity * 0.85}
      />

      {/* Optional label at right edge */}
      {label && (
        <g opacity={labelOpacity}>
          {/* Pill background */}
          <rect
            x={labelX + 10}
            y={labelY - 14}
            width={label.length * 9 + 20}
            height={28}
            rx={14}
            fill={color}
            fillOpacity={0.9}
          />
          <text
            x={labelX + 10 + (label.length * 9 + 20) / 2}
            y={labelY + 5}
            textAnchor="middle"
            fontFamily={font}
            fontSize={16}
            fontWeight={700}
            fill="#FFFFFF"
          >
            {label}
          </text>
        </g>
      )}
    </g>
  );
};

export default CoverageWave;
