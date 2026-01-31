/**
 * Physics simulation patterns for Remotion animations.
 *
 * NOTE: These patterns are now included in COMMON_PATTERNS in visual-references.ts.
 * This file is kept for backwards compatibility and direct imports.
 *
 * All physics must be frame-based (pure functions of frame number) to work with
 * Remotion's rendering model where each frame is rendered independently.
 */

/**
 * Ball physics with gravity and bounce.
 * Simulates a falling ball that bounces and settles.
 */
export const BALL_PHYSICS_SIMULATION = `
const simulateBallPhysics = (
  frame: number,
  dropFrame: number,
  targetY: number,
  fps: number
): { y: number; settled: boolean } => {
  const elapsed = frame - dropFrame;
  if (elapsed < 0) return { y: -100, settled: false };

  const gravity = 0.004;
  const bounceDamping = 0.5;
  let y = 0, velocity = 0, bounces = 0;

  for (let t = 0; t < elapsed; t++) {
    velocity += gravity;
    y += velocity;
    if (y >= targetY) {
      y = targetY;
      velocity = -velocity * bounceDamping;
      if (++bounces >= 4 || Math.abs(velocity) < 0.02) {
        return { y: targetY, settled: true };
      }
    }
  }
  return { y: Math.min(y, targetY), settled: false };
};
`;

/**
 * Squash and stretch deformation based on velocity.
 * Creates more natural-looking motion for falling/bouncing objects.
 */
export const SQUASH_STRETCH = `
const getSquashStretch = (velocity: number, settled: boolean) => {
  if (settled) return { scaleX: 1, scaleY: 1 };
  const stretch = Math.min(velocity * 0.02, 0.3);
  return {
    scaleX: 1 - stretch * 0.2,
    scaleY: 1 + stretch * 0.3,
  };
};
`;

/**
 * Shake effect that intensifies with stress level.
 * Useful for showing system strain or impending failure.
 */
export const SHAKE_EFFECT = `
const getShake = (frame: number, intensity: number, minDim: number) => {
  if (intensity <= 0) return { x: 0, y: 0 };
  return {
    x: Math.sin(frame * 1.5) * intensity * minDim * 0.008,
    y: Math.cos(frame * 1.8) * intensity * minDim * 0.005,
  };
};
`;

/**
 * Explosion particles with gravity.
 * Creates a burst effect with particles that fall due to gravity.
 */
export const EXPLOSION_PARTICLES = `
const generateParticles = (count: number, progress: number, minDim: number) => {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + i * 0.5;
    const velocity = minDim * 0.3 + (i % 5) * minDim * 0.1;
    const size = minDim * 0.015 + (i % 3) * minDim * 0.01;
    return {
      x: Math.cos(angle) * velocity * progress,
      y: Math.sin(angle) * velocity * progress - (progress * progress * minDim * 0.2),
      size: size * (1 - progress * 0.5),
      opacity: 1 - progress,
      rotation: progress * 360 * (i % 2 === 0 ? 1 : -1),
    };
  });
};
`;
