import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS, SPRING_CONFIG, TYPOGRAPHY, glassStyle } from '../constants';

interface Scene1Props {
  startFrame?: number;
}

// Mystery container component
const MysteryContainer: React.FC<{
  side: 'left' | 'right';
  delay: number;
}> = ({ side, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG,
  });

  const isLeft = side === 'left';
  const glowColor = isLeft ? COLORS.primary : COLORS.secondary;

  // Pulse animation for glow
  const glowIntensity = interpolate(
    Math.sin((frame - delay) * 0.08),
    [-1, 1],
    [0.4, 0.8],
    { extrapolateRight: 'clamp' }
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: isLeft ? '12.5%' : '52.5%',
        top: '30%',
        width: '35%',
        height: '40%',
        transform: `scale(${progress})`,
        opacity: progress,
      }}
    >
      {/* Container body */}
      <div
        style={{
          width: '100%',
          height: '100%',
          ...glassStyle,
          borderRadius: 24,
          border: `2px solid ${glowColor}40`,
          boxShadow: `
            0 0 ${40 * glowIntensity}px ${glowColor}30,
            0 0 ${80 * glowIntensity}px ${glowColor}20,
            inset 0 0 ${30 * glowIntensity}px ${glowColor}10
          `,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Inner geometric pattern */}
        {isLeft ? (
          // Skills: Clean geometric lines
          <div style={{ position: 'relative', width: '60%', height: '60%' }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: '10%',
                  top: `${20 + i * 25}%`,
                  width: '80%',
                  height: 8,
                  background: `linear-gradient(90deg, ${COLORS.primary}60, ${COLORS.primary}20)`,
                  borderRadius: 4,
                  opacity: interpolate(
                    progress,
                    [0.5, 1],
                    [0, 0.8],
                    { extrapolateRight: 'clamp' }
                  ),
                }}
              />
            ))}
          </div>
        ) : (
          // MCP: Complex mechanical structure
          <div style={{ position: 'relative', width: '70%', height: '70%' }}>
            {/* Central hub */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 60,
                height: 60,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                border: `3px solid ${COLORS.secondary}`,
                boxShadow: `0 0 20px ${COLORS.secondary}50`,
              }}
            />
            {/* Connection lines */}
            {[0, 60, 120, 180, 240, 300].map((angle, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: 80,
                  height: 3,
                  background: `linear-gradient(90deg, ${COLORS.secondary}80, ${COLORS.accent}40)`,
                  transformOrigin: 'left center',
                  transform: `rotate(${angle}deg)`,
                  opacity: interpolate(
                    progress,
                    [0.5, 1],
                    [0, 0.7],
                    { extrapolateRight: 'clamp' }
                  ),
                }}
              />
            ))}
            {/* Outer nodes */}
            {[0, 120, 240].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const x = Math.cos(rad) * 70;
              const y = Math.sin(rad) * 70;
              return (
                <div
                  key={`node-${i}`}
                  style={{
                    position: 'absolute',
                    left: `calc(50% + ${x}px)`,
                    top: `calc(50% + ${y}px)`,
                    width: 20,
                    height: 20,
                    transform: 'translate(-50%, -50%)',
                    borderRadius: 4,
                    background: COLORS.accent,
                    boxShadow: `0 0 15px ${COLORS.accent}60`,
                    opacity: interpolate(
                      progress,
                      [0.6, 1],
                      [0, 1],
                      { extrapolateRight: 'clamp' }
                    ),
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Label below container */}
      <div
        style={{
          position: 'absolute',
          bottom: -60,
          left: 0,
          width: '100%',
          textAlign: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: TYPOGRAPHY.label,
          fontWeight: 600,
          color: glowColor,
          textShadow: `0 0 20px ${glowColor}50`,
          opacity: interpolate(
            progress,
            [0.7, 1],
            [0, 1],
            { extrapolateRight: 'clamp' }
          ),
        }}
      >
        {isLeft ? '?' : '?'}
      </div>
    </div>
  );
};

export const Scene1: React.FC<Scene1Props> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Question text animation - appears after containers
  const textProgress = spring({
    frame: frame - startFrame - 20,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 70 },
  });

  const textOpacity = interpolate(
    frame - startFrame,
    [20, 40],
    [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );

  return (
    <AbsoluteFill>
      {/* Mystery Containers */}
      <MysteryContainer side="left" delay={startFrame} />
      <MysteryContainer side="right" delay={startFrame + 6} />

      {/* Question Text */}
      <div
        style={{
          position: 'absolute',
          top: '12%',
          left: 0,
          width: '100%',
          textAlign: 'center',
          opacity: textOpacity,
          transform: `translateY(${(1 - textProgress) * 30}px)`,
        }}
      >
        <h1
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: TYPOGRAPHY.title,
            fontWeight: 700,
            color: COLORS.white,
            margin: 0,
            letterSpacing: '-0.02em',
            textShadow: `
              0 0 40px ${COLORS.primary}40,
              0 0 80px ${COLORS.secondary}30
            `,
          }}
        >
          Skills vs MCP?
        </h1>

        <p
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: TYPOGRAPHY.body,
            fontWeight: 400,
            color: `${COLORS.white}90`,
            margin: '20px 0 0 0',
            opacity: interpolate(
              frame - startFrame,
              [30, 50],
              [0, 1],
              { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
            ),
          }}
        >
          What&apos;s the difference?
        </p>
      </div>
    </AbsoluteFill>
  );
};
