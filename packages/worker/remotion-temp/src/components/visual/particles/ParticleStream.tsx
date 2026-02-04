import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

type Direction = 'left' | 'right' | 'up' | 'down';
type ParticleShape = 'circle' | 'dot' | 'line' | 'mixed';

interface ParticleStreamProps {
  /** Flow direction */
  direction?: Direction;
  /** Number of particles (default: 30) */
  density?: number;
  /** Primary particle color */
  color?: string;
  /** Secondary color for gradient effect */
  secondaryColor?: string;
  /** Speed multiplier (default: 1) */
  speed?: number;
  /** Size multiplier (default: 1) */
  particleSize?: number;
  /** Opacity (default: 0.8) */
  opacity?: number;
  /** Particle shape style */
  shape?: ParticleShape;
  /** Show motion trails behind particles */
  trails?: boolean;
  /** Trail length multiplier (default: 1) */
  trailLength?: number;
  /** Add depth variation (some particles appear closer) */
  depth?: boolean;
  /** Subtle pulse animation */
  pulse?: boolean;
  /** Glow intensity (default: 1) */
  glowIntensity?: number;
}

/**
 * ParticleStream - Premium particle flow visualization
 *
 * Features depth variation, motion trails, and sophisticated glow effects.
 * Perfect for data streaming, network traffic, or showing flow/direction.
 *
 * @example
 * <ParticleStream
 *   direction="right"
 *   density={50}
 *   color="#8b5cf6"
 *   trails
 *   depth
 * />
 */
export const ParticleStream: React.FC<ParticleStreamProps> = ({
  direction = 'right',
  density = 30,
  color = '#06b6d4',
  secondaryColor,
  speed = 1,
  particleSize = 1,
  opacity = 0.8,
  shape = 'circle',
  trails = false,
  trailLength = 1,
  depth = false,
  pulse = false,
  glowIntensity = 1,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const minDim = Math.min(width, height);

  // Generate deterministic particles with enhanced properties
  const particles = React.useMemo(() => {
    return Array.from({ length: density }, (_, i) => {
      // Use prime numbers for better distribution
      const hash1 = (i * 17 + 13) % 100;
      const hash2 = (i * 31 + 7) % 100;
      const hash3 = (i * 23 + 11) % 100;
      const hash4 = (i * 29 + 3) % 100;
      const hash5 = (i * 37 + 19) % 100;

      return {
        id: i,
        offset: hash1, // Position offset (0-100%)
        size: (hash2 * 0.6 + 40) / 100, // Size variation (0.4-1.0)
        speedVariation: (hash3 * 0.5 + 75) / 100, // Speed variation (0.75-1.25)
        delay: (hash4 / 100) * 90, // Spread delays across more frames
        depthLayer: depth ? (hash5 < 20 ? 'near' : hash5 < 70 ? 'mid' : 'far') : 'mid',
        shapeType: shape === 'mixed'
          ? (['circle', 'dot', 'line'] as const)[Math.floor(hash4 / 34)]
          : shape,
        colorShift: (hash5 - 50) / 100 * 0.15, // Subtle hue variation
      };
    });
  }, [density, depth, shape]);

  const baseSize = minDim * 0.008 * particleSize;
  const cycleFrames = (fps * 2.5) / speed; // Slightly longer cycle for smoother flow

  // Pulse animation
  const pulseValue = pulse
    ? 1 + Math.sin(frame * 0.1) * 0.15
    : 1;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {particles.map((particle) => {
        const adjustedFrame = (frame - particle.delay) * particle.speedVariation * speed;
        const progress = ((adjustedFrame % cycleFrames + cycleFrames) % cycleFrames) / cycleFrames;

        // Skip if not yet visible
        if (adjustedFrame < 0) return null;

        let x: number, y: number;
        const crossPos = particle.offset / 100;

        // Add slight wave motion for organic feel
        const waveOffset = Math.sin(progress * Math.PI * 3 + particle.offset) * minDim * 0.005;

        switch (direction) {
          case 'right':
            x = interpolate(progress, [0, 1], [-0.08, 1.08]) * width;
            y = crossPos * height + waveOffset;
            break;
          case 'left':
            x = interpolate(progress, [0, 1], [1.08, -0.08]) * width;
            y = crossPos * height + waveOffset;
            break;
          case 'down':
            x = crossPos * width + waveOffset;
            y = interpolate(progress, [0, 1], [-0.08, 1.08]) * height;
            break;
          case 'up':
            x = crossPos * width + waveOffset;
            y = interpolate(progress, [0, 1], [1.08, -0.08]) * height;
            break;
        }

        // Depth-based size and opacity
        const depthMultiplier = particle.depthLayer === 'near' ? 1.5
          : particle.depthLayer === 'far' ? 0.6
          : 1;
        const depthOpacity = particle.depthLayer === 'near' ? 1
          : particle.depthLayer === 'far' ? 0.5
          : 0.8;

        const size = baseSize * particle.size * depthMultiplier * pulseValue;

        // Fade in/out at edges with smoother curve
        const fadeOpacity = interpolate(
          progress,
          [0, 0.08, 0.92, 1],
          [0, 1, 1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );

        // Color with subtle variation
        const particleColor = secondaryColor
          ? `color-mix(in srgb, ${color} ${50 + particle.colorShift * 100}%, ${secondaryColor})`
          : color;

        // Trail gradient direction
        const trailDir = direction === 'right' ? '270deg'
          : direction === 'left' ? '90deg'
          : direction === 'down' ? '0deg'
          : '180deg';

        const actualTrailLength = trails ? size * 4 * trailLength : 0;

        // Multi-layered glow
        const glowLayers = [
          `0 0 ${size * 1.5 * glowIntensity}px ${particleColor}`,
          `0 0 ${size * 3 * glowIntensity}px ${particleColor}60`,
          `0 0 ${size * 5 * glowIntensity}px ${particleColor}30`,
        ].join(', ');

        return (
          <React.Fragment key={particle.id}>
            {/* Motion trail */}
            {trails && (
              <div
                style={{
                  position: 'absolute',
                  left: x,
                  top: y,
                  width: particle.shapeType === 'line' ? actualTrailLength : size,
                  height: particle.shapeType === 'line' ? size * 0.3 : size,
                  borderRadius: particle.shapeType === 'line' ? size * 0.15 : '50%',
                  background: `linear-gradient(${trailDir}, ${particleColor}, transparent)`,
                  opacity: fadeOpacity * opacity * depthOpacity * 0.4,
                  transform: `translate(-50%, -50%)`,
                }}
              />
            )}

            {/* Main particle */}
            <div
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: particle.shapeType === 'line' ? size * 2 : size,
                height: particle.shapeType === 'line' ? size * 0.4
                  : particle.shapeType === 'dot' ? size * 0.6
                  : size,
                borderRadius: particle.shapeType === 'line' ? size * 0.2 : '50%',
                background: particle.shapeType === 'dot'
                  ? particleColor
                  : `radial-gradient(circle at 30% 30%, ${lightenColor(particleColor, 30)}, ${particleColor})`,
                opacity: fadeOpacity * opacity * depthOpacity,
                boxShadow: glowLayers,
                transform: 'translate(-50%, -50%)',
              }}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
};

// Simple color lightening for particle highlights
function lightenColor(hex: string, percent: number): string {
  // Handle color-mix syntax - just return the hex for simplicity
  if (hex.startsWith('color-mix')) return hex;

  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
}

export default ParticleStream;
