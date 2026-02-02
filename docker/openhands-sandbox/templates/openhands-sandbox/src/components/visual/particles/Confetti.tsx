import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

interface ConfettiProps {
  /** Frame when confetti explodes */
  triggerFrame: number;
  /** Array of colors (default: rainbow) */
  colors?: string[];
  /** Number of confetti pieces (default: 50) */
  count?: number;
  /** Center X position as percentage (default: 50) */
  originX?: number;
  /** Center Y position as percentage (default: 50) */
  originY?: number;
  /** Duration in frames (default: 90) */
  durationFrames?: number;
}

/**
 * Confetti - Celebration effect with colorful confetti
 *
 * Use for: success states, celebrations, achievements
 *
 * @example
 * <Confetti triggerFrame={120} colors={['#8b5cf6', '#06b6d4', '#22c55e']} />
 */
export const Confetti: React.FC<ConfettiProps> = ({
  triggerFrame,
  colors = ['#8b5cf6', '#3b82f6', '#06b6d4', '#22c55e', '#eab308', '#ef4444', '#ec4899'],
  count = 50,
  originX = 50,
  originY = 50,
  durationFrames = 90,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const minDim = Math.min(width, height);

  // Generate deterministic confetti pieces
  const pieces = React.useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      color: colors[i % colors.length],
      angle: (i * 137.5) % 360, // Golden angle distribution
      velocity: 0.5 + ((i * 31) % 50) / 100, // 0.5-1.0
      rotationSpeed: ((i * 17) % 20) - 10, // -10 to 10
      size: 0.6 + ((i * 23) % 40) / 100, // 0.6-1.0
      shape: i % 3, // 0: square, 1: rectangle, 2: circle
    }));
  }, [count, colors]);

  const localFrame = frame - triggerFrame;

  if (localFrame < 0 || localFrame > durationFrames) {
    return null;
  }

  const originXPx = (originX / 100) * width;
  const originYPx = (originY / 100) * height;
  const baseSize = minDim * 0.015;

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
      {pieces.map((piece) => {
        const progress = localFrame / durationFrames;

        // Initial burst then gravity
        const angleRad = (piece.angle * Math.PI) / 180;
        const burstDistance = minDim * 0.5 * piece.velocity;

        // Horizontal: constant velocity
        const x = originXPx + Math.cos(angleRad) * burstDistance * progress;

        // Vertical: initial upward burst, then gravity
        const initialVelocityY = -burstDistance * 0.8;
        const gravity = burstDistance * 2;
        const y = originYPx +
          Math.sin(angleRad) * burstDistance * progress * 0.5 +
          initialVelocityY * progress +
          gravity * progress * progress;

        // Rotation
        const rotation = piece.rotationSpeed * localFrame;

        // Fade out
        const opacity = interpolate(
          progress,
          [0, 0.7, 1],
          [1, 1, 0],
          { extrapolateRight: 'clamp' }
        );

        const size = baseSize * piece.size;

        let shapeStyle: React.CSSProperties = {
          position: 'absolute',
          left: x,
          top: y,
          background: piece.color,
          opacity,
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        };

        switch (piece.shape) {
          case 0: // Square
            shapeStyle = { ...shapeStyle, width: size, height: size };
            break;
          case 1: // Rectangle
            shapeStyle = { ...shapeStyle, width: size * 0.5, height: size * 1.5, borderRadius: 2 };
            break;
          case 2: // Circle
            shapeStyle = { ...shapeStyle, width: size, height: size, borderRadius: '50%' };
            break;
        }

        return <div key={piece.id} style={shapeStyle} />;
      })}
    </div>
  );
};

export default Confetti;
