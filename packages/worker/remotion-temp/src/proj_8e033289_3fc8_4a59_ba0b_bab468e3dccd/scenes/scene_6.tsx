import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  useVideoConfig,
  useCurrentFrame,
  interpolate,
  spring,
  Easing,
} from 'remotion';
import {
  FadeIn,
  GlowPulse,
  BounceIn,
  PremiumStagger,
  ScaleIn,
} from '../../animations';

const PostelsLawFinal = () => {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const minDim = Math.min(width, height);

  // Constants
  const colors = {
    bg: '#0F172A',
    primary: '#3B82F6',   // Blue
    secondary: '#10B981', // Green (Liberal/Input)
    accent: '#F59E0B',    // Amber (Conservative/Output)
    text: '#F8FAFC',
    glass: 'rgba(255, 255, 255, 0.05)',
  };

  const API_X = width * 0.5;
  const CLIENT_X = width * 0.15;
  const DB_X = width * 0.85;

  // Animation Progressions
  // 1. Camera Pull Back (Zoom Out)
  const zoomProgress = spring({
    frame: frame - 10,
    fps,
    config: { damping: 20, stiffness: 60 },
  });

  const scale = interpolate(zoomProgress, [0, 1], [2.5, 1]);
  const centerY = interpolate(zoomProgress, [0, 1], [height * 0.7, height * 0.5]);
  const centerX = interpolate(zoomProgress, [0, 1], [DB_X, width * 0.5]);

  // 2. Loop Data Packets
  const loopDuration = 90;
  const loopProgress = (frame % loopDuration) / loopDuration;

  // Render Logic
  const renderDataPacket = (x: number, y: number, color: string, label: string) => (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        padding: `${minDim * 0.01}px ${minDim * 0.02}px`,
        background: color,
        borderRadius: minDim * 0.01,
        color: 'white',
        fontSize: minDim * 0.02,
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: `0 0 20px ${color}66`,
        zIndex: 10,
      }}
    >
      <img
        src="https://unpkg.com/lucide-static@latest/icons/package.svg"
        width={minDim * 0.02}
        height={minDim * 0.02}
        style={{ filter: 'brightness(0) invert(1)' }}
      />
      {label}
    </div>
  );

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, overflow: 'hidden' }}>
      {/* Container that handles the "Camera" Zoom */}
      <div
        style={{
          width: '100%',
          height: '100%',
          transformOrigin: `${centerX}px ${centerY}px`,
          transform: `scale(${scale})`,
          position: 'relative',
        }}
      >
        {/* Persistent Tracks */}
        <svg style={{ position: 'absolute', width: '100%', height: '100%' }}>
          {/* Request Path (Top) */}
          <path
            d={`M ${CLIENT_X} ${height * 0.45} L ${DB_X} ${height * 0.45}`}
            stroke={colors.glass}
            strokeWidth={minDim * 0.01}
            fill="none"
            strokeDasharray="10 10"
          />
          {/* Response Path (Bottom) */}
          <path
            d={`M ${DB_X} ${height * 0.65} L ${CLIENT_X} ${height * 0.65}`}
            stroke={colors.glass}
            strokeWidth={minDim * 0.01}
            fill="none"
            strokeDasharray="10 10"
          />
        </svg>

        {/* Database (End position from previous scene) */}
        <div
          style={{
            position: 'absolute',
            left: DB_X,
            top: height * 0.55,
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
          }}
        >
          <img
            src="https://api.iconify.design/mdi/database.svg?color=%233B82F6"
            width={minDim * 0.12}
            height={minDim * 0.12}
          />
          <div style={{ color: colors.primary, fontSize: minDim * 0.02, marginTop: 10, fontWeight: 'bold' }}>STORAGE</div>
        </div>

        {/* Gateway / API Divider */}
        <div
          style={{
            position: 'absolute',
            left: API_X,
            top: height * 0.55,
            height: height * 0.4,
            width: minDim * 0.005,
            background: `linear-gradient(to bottom, transparent, ${colors.primary}, transparent)`,
            transform: 'translateX(-50%)',
          }}
        />

        {/* Central Core Icon */}
        <div
          style={{
            position: 'absolute',
            left: API_X,
            top: height * 0.55,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <GlowPulse color={colors.primary}>
            <div style={{
              width: minDim * 0.15,
              height: minDim * 0.15,
              borderRadius: '50%',
              background: 'rgba(15, 23, 42, 0.9)',
              border: `4px solid ${colors.primary}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
            }}>
              <img
                src="https://unpkg.com/lucide-static@latest/icons/cpu.svg"
                width={minDim * 0.08}
                height={minDim * 0.08}
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            </div>
          </GlowPulse>
        </div>

        {/* Client End */}
        <div
          style={{
            position: 'absolute',
            left: CLIENT_X,
            top: height * 0.55,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <img
            src="https://unpkg.com/lucide-static@latest/icons/layout.svg"
            width={minDim * 0.1}
            height={minDim * 0.1}
            style={{ opacity: 0.6, filter: 'brightness(0) invert(1)' }}
          />
          <div style={{ color: 'white', fontSize: minDim * 0.02, textAlign: 'center', opacity: 0.6 }}>CLIENT</div>
        </div>

        {/* Continuous Data Flowing */}
        {/* 1. Incoming "Messy" Data being Liberal */}
        {renderDataPacket(
          interpolate(loopProgress, [0, 1], [CLIENT_X, DB_X]),
          height * 0.45,
          loopProgress < 0.5 ? colors.secondary : colors.primary,
          loopProgress < 0.5 ? 'USER_NAME' : 'user_name'
        )}

        {/* 2. Outgoing "Clean" Data being Conservative */}
        {renderDataPacket(
          interpolate(loopProgress, [0, 1], [DB_X, CLIENT_X]),
          height * 0.65,
          colors.accent,
          '✓ valid_json'
        )}
      </div>

      {/* Overlay: Labels and Title */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        {/* Title Block - Top 15% */}
        <div style={{ height: '15%', padding: minDim * 0.05, textAlign: 'center' }}>
          <BounceIn delay={20}>
            <h1 style={{
              color: 'white',
              fontSize: minDim * 0.06,
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: 4,
            }}>
              Postel's Law
            </h1>
          </BounceIn>
          <FadeIn delay={40}>
            <p style={{ color: colors.primary, fontSize: minDim * 0.03, margin: 0, fontWeight: 'bold' }}>
              The Robustness Principle
            </p>
          </FadeIn>
        </div>

        {/* Bottom Labels - 25% */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          width: '100%',
          height: '25%',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: minDim * 0.04,
        }}>
          <ScaleIn delay={60}>
            <div style={{
              background: `${colors.secondary}22`,
              borderLeft: `5px solid ${colors.secondary}`,
              padding: minDim * 0.03,
              borderRadius: 8,
              width: width * 0.38,
            }}>
              <span style={{ color: colors.secondary, fontSize: minDim * 0.02, display: 'block' }}>LIBERAL ACCEPTANCE</span>
              <span style={{ color: 'white', fontSize: minDim * 0.03, fontWeight: '500' }}>Parse flexible formats</span>
            </div>
          </ScaleIn>

          <ScaleIn delay={80}>
            <div style={{
              background: `${colors.accent}22`,
              borderLeft: `5px solid ${colors.accent}`,
              padding: minDim * 0.03,
              borderRadius: 8,
              width: width * 0.38,
            }}>
              <span style={{ color: colors.accent, fontSize: minDim * 0.02, display: 'block' }}>STRICT EMISSION</span>
              <span style={{ color: 'white', fontSize: minDim * 0.03, fontWeight: '500' }}>Validate perfect output</span>
            </div>
          </ScaleIn>
        </div>
      </AbsoluteFill>

      {/* Final Success Glow */}
      {frame > 140 && (
        <FadeIn duration={30}>
          <div style={{
            position: 'absolute',
            inset: 0,
            boxShadow: `inset 0 0 ${minDim * 0.2}px ${colors.primary}44`,
            pointerEvents: 'none',
          }} />
        </FadeIn>
      )}
    </AbsoluteFill>
  );
};

export default PostelsLawFinal;