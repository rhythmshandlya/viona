import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { COLORS, SPRING_CONFIG } from '../constants';
import { FollowIcon } from '../components/Icons';

interface Scene8Props {
  startFrame?: number;
}

// Celebration particle
const CelebrationParticle: React.FC<{
  index: number;
}> = ({ index }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Gentle floating motion
  const baseX = (index * 83) % width;
  const baseY = (index * 137) % height;

  const floatX = interpolate(
    (frame + index * 20) % 120,
    [0, 60, 120],
    [-15, 15, -15],
    { extrapolateRight: 'clamp' }
  );
  const floatY = interpolate(
    (frame + index * 30) % 150,
    [0, 75, 150],
    [0, -20, 0],
    { extrapolateRight: 'clamp' }
  );

  const opacity = interpolate(
    (frame + index * 25) % 100,
    [0, 50, 100],
    [0.2, 0.6, 0.2],
    { extrapolateRight: 'clamp' }
  );

  const size = 6 + (index % 5) * 3;
  const colors = [COLORS.primary, COLORS.secondary, COLORS.success, COLORS.accent];
  const color = colors[index % colors.length];

  return (
    <div
      style={{
        position: 'absolute',
        left: baseX + floatX,
        top: baseY + floatY,
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        opacity,
        boxShadow: `0 0 ${size * 2}px ${color}`,
      }}
    />
  );
};

// Follow button with pulse
const FollowButton: React.FC<{ pulseFrame: number }> = ({ pulseFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appear = spring({
    frame: frame - 40,
    fps,
    config: SPRING_CONFIG,
  });

  // Pulse at key sync (frame 125)
  const isPulseActive = frame >= pulseFrame && frame < pulseFrame + 40;
  const pulseScale = isPulseActive
    ? interpolate(
        (frame - pulseFrame) % 20,
        [0, 10, 20],
        [1, 1.1, 1],
        { extrapolateRight: 'clamp' }
      )
    : 1;

  const glowIntensity = isPulseActive ? 1.5 : 1;

  if (appear <= 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '24px 60px',
        background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.secondary})`,
        borderRadius: 50,
        transform: `scale(${appear * pulseScale})`,
        boxShadow: `
          0 0 ${30 * glowIntensity}px ${COLORS.accent}88,
          0 10px 40px ${COLORS.dark}88
        `,
        cursor: 'pointer',
      }}
    >
      <FollowIcon size={36} color={COLORS.white} />
      <span
        style={{
          fontSize: 36,
          fontWeight: 800,
          color: COLORS.white,
          fontFamily: 'system-ui, sans-serif',
          letterSpacing: 2,
          textTransform: 'uppercase',
        }}
      >
        Follow
      </span>
    </div>
  );
};

// Pinned comment callout
const PinnedComment: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appear = spring({
    frame: frame - 80,
    fps,
    config: SPRING_CONFIG,
  });

  if (appear <= 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '16px 28px',
        background: `${COLORS.dark}ee`,
        border: `2px solid ${COLORS.primary}44`,
        borderRadius: 16,
        transform: `scale(${appear})`,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: COLORS.success,
          boxShadow: `0 0 10px ${COLORS.success}`,
        }}
      />
      <span
        style={{
          fontSize: 22,
          color: COLORS.gray,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        Check the pinned comment for resources!
      </span>
    </div>
  );
};

export const Scene8: React.FC<Scene8Props> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame();
  useVideoConfig();

  // Key sync: "Follow" at relative frame 125
  const pulseFrame = 125;

  // Personal intro fade in
  const introOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill>
      {/* Celebration particles */}
      {Array.from({ length: 25 }).map((_, i) => (
        <CelebrationParticle key={`particle-${i}`} index={i} />
      ))}

      {/* Personal intro */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          opacity: introOpacity,
        }}
      >
        {/* Avatar placeholder */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
            margin: '0 auto 24px',
            border: `4px solid ${COLORS.primary}`,
            boxShadow: `0 0 30px ${COLORS.primary}44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 48,
            fontWeight: 800,
            color: COLORS.white,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          P
        </div>

        {/* Name */}
        <div
          style={{
            fontSize: 48,
            fontWeight: 800,
            color: COLORS.white,
            fontFamily: 'system-ui, sans-serif',
            marginBottom: 12,
          }}
        >
          Prasanna
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 24,
            color: COLORS.gray,
            fontFamily: 'system-ui, sans-serif',
            marginBottom: 8,
          }}
        >
          System Design Expert
        </div>

        {/* Company */}
        <div
          style={{
            fontSize: 20,
            color: COLORS.secondary,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          @ Zoho
        </div>
      </div>

      {/* Follow button */}
      <div
        style={{
          position: 'absolute',
          top: '55%',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        <FollowButton pulseFrame={pulseFrame} />
      </div>

      {/* Pinned comment */}
      <div
        style={{
          position: 'absolute',
          top: '70%',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        <PinnedComment />
      </div>

      {/* Bottom text */}
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          opacity: interpolate(frame, [100, 130], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 600,
            color: COLORS.primary,
            fontFamily: 'system-ui, sans-serif',
            marginBottom: 8,
          }}
        >
          More System Design Content
        </div>
        <div
          style={{
            fontSize: 20,
            color: COLORS.gray,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          Every week on this channel
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default Scene8;
