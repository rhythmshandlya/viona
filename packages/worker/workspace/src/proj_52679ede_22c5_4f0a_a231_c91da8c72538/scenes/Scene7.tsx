import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { COLORS, SPRING_CONFIG } from '../constants';
import { CheckCircleIcon, ClockIcon } from '../components/Icons';

interface Scene7Props {
  startFrame?: number;
}

// Logo card component
const LogoCard: React.FC<{
  name: string;
  description: string;
  color: string;
  delay: number;
}> = ({ name, description, color, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appear = spring({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG,
  });

  if (appear <= 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        transform: `scale(${appear})`,
      }}
    >
      {/* Logo placeholder */}
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: 24,
          background: `linear-gradient(135deg, ${color}33, ${color}11)`,
          border: `3px solid ${color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 30px ${color}44`,
        }}
      >
        <ClockIcon size={60} color={color} />
      </div>

      {/* Name */}
      <div
        style={{
          fontSize: 32,
          fontWeight: 800,
          color: COLORS.white,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {name}
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: 18,
          color: COLORS.gray,
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          maxWidth: 200,
        }}
      >
        {description}
      </div>

      {/* Checkmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <CheckCircleIcon size={24} color={COLORS.success} />
        <span style={{ fontSize: 16, color: COLORS.success, fontWeight: 600 }}>
          Uses Timing Wheels
        </span>
      </div>
    </div>
  );
};

// Performance bar
const PerformanceBar: React.FC<{
  label: string;
  value: number;
  maxValue: number;
  color: string;
  delay: number;
}> = ({ label, value, maxValue, color, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 60 },
  });

  const barWidth = Math.max(0, progress) * (value / maxValue) * 100;
  const displayValue = Math.round(progress * value);

  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: COLORS.white,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 20,
            fontWeight: 700,
            color,
            fontFamily: 'monospace',
          }}
        >
          {displayValue.toLocaleString()} ops/sec
        </span>
      </div>
      <div
        style={{
          width: '100%',
          height: 30,
          background: `${COLORS.dark}`,
          borderRadius: 8,
          overflow: 'hidden',
          border: `1px solid ${COLORS.gray}44`,
        }}
      >
        <div
          style={{
            width: `${barWidth}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            borderRadius: 8,
            boxShadow: `0 0 15px ${color}66`,
          }}
        />
      </div>
    </div>
  );
};

export const Scene7: React.FC<Scene7Props> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame();
  useVideoConfig();

  // Title fade in
  const titleOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });

  // Key sync is at relative frame 165
  const logosDelay = 30; // Start logos a bit before key sync

  return (
    <AbsoluteFill>
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: '5%',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 42,
          fontWeight: 800,
          color: COLORS.success,
          fontFamily: 'system-ui, sans-serif',
          textShadow: `0 0 20px ${COLORS.success}66`,
          opacity: titleOpacity,
          textAlign: 'center',
        }}
      >
        REAL-WORLD VALIDATION
      </div>

      {/* Subtitle */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 24,
          color: COLORS.gray,
          fontFamily: 'system-ui, sans-serif',
          opacity: interpolate(frame, [20, 50], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        Production systems using timing wheels
      </div>

      {/* Logo cards */}
      <div
        style={{
          position: 'absolute',
          top: '18%',
          left: '0',
          right: '0',
          display: 'flex',
          justifyContent: 'space-around',
          padding: '0 10%',
        }}
      >
        <LogoCard
          name="Apache Kafka"
          description="Distributed event streaming platform"
          color={COLORS.primary}
          delay={logosDelay}
        />
        <LogoCard
          name="Netty"
          description="Async event-driven network framework"
          color={COLORS.secondary}
          delay={logosDelay + 15}
        />
      </div>

      {/* Performance comparison */}
      <div
        style={{
          position: 'absolute',
          bottom: '12%',
          left: '10%',
          right: '10%',
          padding: '30px',
          background: `${COLORS.dark}ee`,
          border: `2px solid ${COLORS.primary}44`,
          borderRadius: 20,
          opacity: interpolate(frame, [80, 110], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        <div
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: COLORS.white,
            fontFamily: 'system-ui, sans-serif',
            marginBottom: 24,
            textAlign: 'center',
          }}
        >
          Throughput Comparison
        </div>

        <PerformanceBar
          label="Binary Heap"
          value={50000}
          maxValue={500000}
          color={COLORS.accent}
          delay={120}
        />

        <PerformanceBar
          label="Timing Wheel"
          value={500000}
          maxValue={500000}
          color={COLORS.success}
          delay={140}
        />

        {/* Improvement indicator */}
        <div
          style={{
            textAlign: 'center',
            marginTop: 20,
            fontSize: 28,
            fontWeight: 800,
            color: COLORS.success,
            opacity: interpolate(frame, [180, 210], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          10x Performance Improvement!
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default Scene7;
