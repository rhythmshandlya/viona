import React from 'react';
import { spring, interpolate } from 'remotion';

interface PhaseInfo {
  label: string;
  radius: number;
}

interface CoverageStatsProps {
  phases: PhaseInfo[];
  currentPhaseIndex: number;
  frame: number;
  enterFrame: number;
  fps: number;
  font: {
    headline: string;
    body: string;
  };
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
}

function formatRadius(meters: number): string {
  if (meters >= 1000) {
    return `${Math.round(meters / 1000)} km radius`;
  }
  return `${meters} m radius`;
}

const CoverageStats: React.FC<CoverageStatsProps> = ({
  phases,
  currentPhaseIndex,
  frame,
  enterFrame,
  fps,
  font,
  colors,
}) => {
  if (frame < enterFrame) return null;

  const localFrame = frame - enterFrame;

  // Panel slides up from bottom
  const slideSpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const translateY = interpolate(slideSpring, [0, 1], [60, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const panelOpacity = interpolate(localFrame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const currentPhase = phases[currentPhaseIndex];
  if (!currentPhase) return null;

  const label = currentPhase.label
    ? `${currentPhase.label} \u2014 ${formatRadius(currentPhase.radius)}`
    : formatRadius(currentPhase.radius);

  // Progress indicator: how many phases have been revealed so far
  const revealedCount = currentPhaseIndex + 1;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 40,
        left: '50%',
        transform: `translateX(-50%) translateY(${translateY}px)`,
        opacity: panelOpacity,
        pointerEvents: 'none',
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
      }}
    >
      {/* Main label pill */}
      <div
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.72)',
          borderRadius: 32,
          padding: '12px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          border: `2px solid ${colors.primary}`,
        }}
      >
        {/* Color dot */}
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: colors.primary,
            flexShrink: 0,
          }}
        />

        <span
          style={{
            fontFamily: font.headline,
            fontSize: 22,
            fontWeight: 700,
            color: '#FFFFFF',
            whiteSpace: 'nowrap',
            letterSpacing: 0.3,
          }}
        >
          {label}
        </span>
      </div>

      {/* Phase dots */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        }}
      >
        {phases.map((_, i) => (
          <div
            key={i}
            style={{
              width: i < revealedCount ? 24 : 10,
              height: 10,
              borderRadius: 5,
              backgroundColor:
                i < revealedCount ? colors.primary : 'rgba(255,255,255,0.35)',
              transition: 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default CoverageStats;
