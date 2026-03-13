import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';

interface MetricCounterProps {
  title: string;
  metricLabel: string;
  currentValue: number;
  totalValue: number;
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

const MetricCounter: React.FC<MetricCounterProps> = ({
  title,
  metricLabel,
  currentValue,
  totalValue,
  frame,
  enterFrame,
  font,
  colors,
  darkMap,
}) => {
  const { fps } = useVideoConfig();

  if (frame < enterFrame) return null;

  const localFrame = frame - enterFrame;

  // Spring entrance
  const scale = spring({
    frame: localFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const opacity = interpolate(localFrame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const slideY = interpolate(localFrame, [0, 20], [-30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const bgColor = darkMap ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.72)';
  const textColor = darkMap ? '#FFFFFF' : colors.text;
  const valueColor = colors.primary;

  const displayValue = Math.round(currentValue);
  const progress = totalValue > 0 ? currentValue / totalValue : 0;

  return (
    <div
      style={{
        position: 'absolute',
        top: 40,
        left: '50%',
        transform: `translateX(-50%) translateY(${slideY}px) scale(${scale})`,
        transformOrigin: 'top center',
        opacity,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      <div
        style={{
          backgroundColor: bgColor,
          backdropFilter: 'blur(10px)',
          borderRadius: 24,
          padding: '18px 48px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          border: `1.5px solid ${darkMap ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
          boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
          minWidth: 320,
        }}
      >
        {/* Title */}
        <div
          style={{
            fontFamily: font,
            fontSize: 36,
            fontWeight: 700,
            color: textColor,
            whiteSpace: 'nowrap',
            letterSpacing: 0.5,
          }}
        >
          {title}
        </div>

        {/* Value row */}
        {currentValue > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
            }}
          >
            <div
              style={{
                fontFamily: font,
                fontSize: 52,
                fontWeight: 800,
                color: valueColor,
                lineHeight: 1,
              }}
            >
              {displayValue.toLocaleString('en-US')}
            </div>
            <div
              style={{
                fontFamily: font,
                fontSize: 22,
                fontWeight: 600,
                color: textColor,
                opacity: 0.75,
              }}
            >
              {metricLabel}
            </div>
          </div>
        )}

        {/* Progress bar */}
        {totalValue > 0 && (
          <div
            style={{
              width: '100%',
              height: 6,
              borderRadius: 3,
              backgroundColor: darkMap ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progress * 100}%`,
                height: '100%',
                borderRadius: 3,
                backgroundColor: valueColor,
                transition: 'width 0.1s linear',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricCounter;
