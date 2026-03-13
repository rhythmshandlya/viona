import React from 'react';
import { useCurrentFrame, spring, useVideoConfig, interpolate } from 'remotion';

interface LowerThirdLabelProps {
  /** City / location name */
  label: string;
  /** Optional subtitle line */
  subtitle?: string;
  /** Frame at which label slides in */
  enterFrame: number;
  /** Frame at which label slides out */
  exitFrame: number;
  /** Font family for the label text */
  font: string;
  /** Text color */
  color: string;
  /** Accent color for the left bar */
  accentColor: string;
  /** 'lowerThird' = full bar, 'minimal' = small text only */
  style: 'lowerThird' | 'minimal';
}

const LowerThirdLabel: React.FC<LowerThirdLabelProps> = ({
  label,
  subtitle,
  enterFrame,
  exitFrame,
  font,
  color,
  accentColor,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Slide-in spring (smooth)
  const enterProgress = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  // Slide-out spring (smooth)
  const exitProgress = spring({
    frame: frame - exitFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  // Don't render before enter
  if (frame < enterFrame) return null;

  const translateX = interpolate(enterProgress, [0, 1], [-400, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const exitTranslateX = interpolate(exitProgress, [0, 1], [0, -400], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const opacity = interpolate(enterProgress, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const exitOpacity = interpolate(exitProgress, [0, 1], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const finalTranslateX = frame >= exitFrame ? exitTranslateX : translateX;
  const finalOpacity = frame >= exitFrame ? exitOpacity : opacity;

  if (style === 'minimal') {
    return (
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: 60,
          transform: `translateX(${finalTranslateX}px)`,
          opacity: finalOpacity,
          fontFamily: font,
          color,
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: '0.04em',
          textShadow: '0 2px 8px rgba(0,0,0,0.7)',
        }}
      >
        {label}
      </div>
    );
  }

  // lowerThird style
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 70,
        left: 50,
        transform: `translateX(${finalTranslateX}px)`,
        opacity: finalOpacity,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          width: 4,
          backgroundColor: accentColor,
          borderRadius: 2,
          marginRight: 14,
        }}
      />
      {/* Text content */}
      <div
        style={{
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          padding: '12px 24px 12px 18px',
          borderRadius: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div
          style={{
            fontFamily: font,
            color,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '0.02em',
            lineHeight: 1.2,
          }}
        >
          {label}
        </div>
        {subtitle && (
          <div
            style={{
              fontFamily: font,
              color,
              fontSize: 16,
              fontWeight: 400,
              opacity: 0.7,
              letterSpacing: '0.03em',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};

export default LowerThirdLabel;
