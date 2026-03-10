import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';

type ColorScale = 'warm' | 'cool' | 'green';

interface GradientLegendProps {
  colorScale: ColorScale;
  frame: number;
  enterFrame: number;
  font: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  darkMap: boolean;
}

function getGradientCss(colorScale: ColorScale): string {
  if (colorScale === 'warm') {
    return 'linear-gradient(to right, rgb(0,200,80), rgb(255,220,0), rgb(220,20,20))';
  } else if (colorScale === 'cool') {
    return 'linear-gradient(to right, rgb(10,30,180), rgb(0,210,240), rgb(230,245,255))';
  } else {
    return 'linear-gradient(to right, rgb(30,160,50), rgb(240,200,0), rgb(210,30,30))';
  }
}

const GradientLegend: React.FC<GradientLegendProps> = ({
  colorScale,
  frame,
  enterFrame,
  font,
  colors,
  darkMap,
}) => {
  const { fps } = useVideoConfig();

  if (frame < enterFrame) return null;

  const localFrame = frame - enterFrame;

  const scale = spring({
    frame: localFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const opacity = interpolate(localFrame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const slideX = interpolate(localFrame, [0, 20], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const bgColor = darkMap ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.72)';
  const textColor = darkMap ? '#FFFFFF' : colors.text;
  const gradient = getGradientCss(colorScale);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 40,
        right: 50,
        transform: `translateX(${slideX}px) scale(${scale})`,
        transformOrigin: 'bottom right',
        opacity,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      <div
        style={{
          backgroundColor: bgColor,
          backdropFilter: 'blur(10px)',
          borderRadius: 16,
          padding: '14px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          border: `1.5px solid ${darkMap ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          minWidth: 200,
        }}
      >
        {/* Label row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontFamily: font,
              fontSize: 16,
              fontWeight: 600,
              color: textColor,
              opacity: 0.7,
            }}
          >
            Low
          </span>
          <span
            style={{
              fontFamily: font,
              fontSize: 15,
              fontWeight: 700,
              color: textColor,
              opacity: 0.85,
              letterSpacing: 0.5,
              textTransform: 'uppercase' as const,
            }}
          >
            Intensity
          </span>
          <span
            style={{
              fontFamily: font,
              fontSize: 16,
              fontWeight: 600,
              color: textColor,
              opacity: 0.7,
            }}
          >
            High
          </span>
        </div>

        {/* Gradient bar */}
        <div
          style={{
            width: '100%',
            height: 14,
            borderRadius: 7,
            background: gradient,
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.15)',
          }}
        />
      </div>
    </div>
  );
};

export default GradientLegend;
