import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

interface GlowingOrbProps {
  /** Size multiplier (default: 1) */
  size?: number;
  /** Primary color (default: '#8b5cf6') */
  color?: string;
  /** Secondary color for gradient (optional) */
  secondaryColor?: string;
  /** Glow intensity (default: 1) */
  glowIntensity?: number;
  /** Pulse speed (default: 1) */
  pulseSpeed?: number;
  /** Add inner sparkle effect */
  sparkle?: boolean;
  /** Add outer ring */
  ring?: boolean;
  /** Ring color (defaults to color with low opacity) */
  ringColor?: string;
}

/**
 * GlowingOrb - Premium pulsing orb with layered glow effects
 *
 * Features multi-layered gradients, subtle inner highlights, and
 * sophisticated pulsing animation. Perfect for representing servers,
 * data nodes, or energy sources.
 *
 * @example
 * <GlowingOrb size={1.5} color="#06b6d4" sparkle />
 */
export const GlowingOrb: React.FC<GlowingOrbProps> = ({
  size = 1,
  color = '#8b5cf6',
  secondaryColor,
  glowIntensity = 1,
  pulseSpeed = 1,
  sparkle = false,
  ring = false,
  ringColor,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const minDim = Math.min(width, height);

  // Multi-frequency pulse for organic feel
  const cycleFrames = (fps * 2) / pulseSpeed;
  const pulseProgress = (frame % cycleFrames) / cycleFrames;
  const primaryPulse = Math.sin(pulseProgress * Math.PI * 2);
  const secondaryPulse = Math.sin(pulseProgress * Math.PI * 4) * 0.3;
  const combinedPulse = primaryPulse * 0.7 + secondaryPulse;

  // Scale varies with pulse
  const scale = 1 + combinedPulse * 0.06;

  // Glow intensity varies
  const glowFactor = glowIntensity * (1 + combinedPulse * 0.4);

  const orbSize = minDim * 0.08 * size;
  const actualSecondaryColor = secondaryColor || lightenColor(color, 30);

  // Create layered gradient for depth
  const gradient = `
    radial-gradient(circle at 35% 35%, ${lightenColor(color, 50)}90, transparent 40%),
    radial-gradient(circle at 50% 50%, ${actualSecondaryColor}, ${color} 60%, ${darkenColor(color, 20)} 100%)
  `;

  // Multi-layered glow
  const glowSize1 = orbSize * 0.4 * glowFactor;
  const glowSize2 = orbSize * 0.8 * glowFactor;
  const glowSize3 = orbSize * 1.2 * glowFactor;

  // Sparkle rotation
  const sparkleRotation = frame * 2;

  return (
    <div
      style={{
        position: 'relative',
        width: orbSize,
        height: orbSize,
      }}
    >
      {/* Outer ring */}
      {ring && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: orbSize * 1.6,
            height: orbSize * 1.6,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            border: `${orbSize * 0.02}px solid ${ringColor || `${color}40`}`,
            opacity: 0.5 + combinedPulse * 0.2,
          }}
        />
      )}

      {/* Outer glow layers */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: orbSize * 2.5,
          height: orbSize * 2.5,
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Main orb */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: gradient,
          boxShadow: `
            0 0 ${glowSize1}px ${color}60,
            0 0 ${glowSize2}px ${color}40,
            0 0 ${glowSize3}px ${color}20,
            inset 0 -${orbSize * 0.1}px ${orbSize * 0.2}px ${darkenColor(color, 30)}40,
            inset 0 ${orbSize * 0.05}px ${orbSize * 0.1}px ${lightenColor(color, 40)}30
          `,
          transform: `scale(${scale})`,
        }}
      />

      {/* Inner highlight */}
      <div
        style={{
          position: 'absolute',
          top: '15%',
          left: '20%',
          width: '30%',
          height: '20%',
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${lightenColor(color, 60)}80, transparent)`,
          filter: 'blur(2px)',
          pointerEvents: 'none',
        }}
      />

      {/* Sparkle effect */}
      {sparkle && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: orbSize * 1.2,
            height: orbSize * 1.2,
            transform: `translate(-50%, -50%) rotate(${sparkleRotation}deg)`,
            pointerEvents: 'none',
          }}
        >
          {[0, 90, 180, 270].map((angle) => (
            <div
              key={angle}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: 2,
                height: orbSize * 0.15,
                background: `linear-gradient(to bottom, ${lightenColor(color, 50)}, transparent)`,
                transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${orbSize * 0.5}px)`,
                opacity: 0.6 + primaryPulse * 0.4,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Color utilities
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 0, g: 0, b: 0 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function lightenColor(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const amt = Math.round(2.55 * percent);
  return rgbToHex(Math.min(255, r + amt), Math.min(255, g + amt), Math.min(255, b + amt));
}

function darkenColor(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const amt = Math.round(2.55 * percent);
  return rgbToHex(Math.max(0, r - amt), Math.max(0, g - amt), Math.max(0, b - amt));
}

export default GlowingOrb;
