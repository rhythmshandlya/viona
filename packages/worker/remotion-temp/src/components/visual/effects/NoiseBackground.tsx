import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { noise2D, noise3D } from '@remotion/noise';

interface NoiseBackgroundProps {
  /** Base color for the noise */
  color?: string;
  /** Secondary color for gradient effect */
  secondaryColor?: string;
  /** Noise scale (smaller = larger patterns, default: 0.005) */
  scale?: number;
  /** Animation speed (default: 1, 0 for static) */
  speed?: number;
  /** Noise intensity/contrast (default: 1) */
  intensity?: number;
  /** Noise type: 'perlin' | 'grain' | 'clouds' */
  type?: 'perlin' | 'grain' | 'clouds';
  /** Opacity (default: 0.3) */
  opacity?: number;
  /** Resolution divisor for performance (default: 4, higher = faster but blockier) */
  resolution?: number;
  /** Seed for deterministic noise */
  seed?: string;
}

/**
 * NoiseBackground - Procedural noise texture using @remotion/noise
 *
 * Creates animated or static noise patterns for premium backgrounds.
 * Uses canvas for performance with configurable resolution.
 *
 * @example
 * <NoiseBackground color="#8b5cf6" type="clouds" speed={0.5} />
 */
export const NoiseBackground: React.FC<NoiseBackgroundProps> = ({
  color = '#8b5cf6',
  secondaryColor,
  scale = 0.005,
  speed = 1,
  intensity = 1,
  type = 'perlin',
  opacity = 0.3,
  resolution = 4,
  seed = 'noise',
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Calculate dimensions at lower resolution for performance
  const canvasWidth = Math.ceil(width / resolution);
  const canvasHeight = Math.ceil(height / resolution);

  // Time dimension for animation
  const time = frame * 0.02 * speed;

  // Parse colors
  const primaryRgb = hexToRgb(color);
  const secondaryRgb = secondaryColor ? hexToRgb(secondaryColor) : primaryRgb;

  // Generate noise pixels
  const pixels = React.useMemo(() => {
    const data: { x: number; y: number; value: number }[] = [];

    for (let y = 0; y < canvasHeight; y++) {
      for (let x = 0; x < canvasWidth; x++) {
        let value: number;

        switch (type) {
          case 'grain':
            // High-frequency grain noise
            value = noise2D(seed, x * 0.5, y * 0.5 + time * 10);
            value = value * value * (value > 0 ? 1 : -1); // Sharpen
            break;

          case 'clouds':
            // Multi-octave cloud-like noise
            const n1 = noise3D(seed, x * scale, y * scale, time);
            const n2 = noise3D(seed + '2', x * scale * 2, y * scale * 2, time * 1.5) * 0.5;
            const n3 = noise3D(seed + '3', x * scale * 4, y * scale * 4, time * 2) * 0.25;
            value = (n1 + n2 + n3) / 1.75;
            break;

          case 'perlin':
          default:
            // Standard perlin noise
            value = noise3D(seed, x * scale, y * scale, time);
            break;
        }

        // Apply intensity
        value = value * intensity;

        // Clamp to -1 to 1
        value = Math.max(-1, Math.min(1, value));

        data.push({ x, y, value });
      }
    }

    return data;
  }, [canvasWidth, canvasHeight, type, scale, seed, time, intensity]);

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
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        preserveAspectRatio="none"
        style={{ opacity }}
      >
        {pixels.map(({ x, y, value }, i) => {
          // Interpolate between colors based on noise value
          const t = (value + 1) / 2; // Map -1,1 to 0,1
          const r = Math.round(primaryRgb.r + (secondaryRgb.r - primaryRgb.r) * t);
          const g = Math.round(primaryRgb.g + (secondaryRgb.g - primaryRgb.g) * t);
          const b = Math.round(primaryRgb.b + (secondaryRgb.b - primaryRgb.b) * t);
          const alpha = Math.abs(value) * 0.5 + 0.5;

          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={1.1}
              height={1.1}
              fill={`rgba(${r}, ${g}, ${b}, ${alpha})`}
            />
          );
        })}
      </svg>
    </div>
  );
};

// Helper to parse hex color
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

export default NoiseBackground;
