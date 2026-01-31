/**
 * Physics simulation code snippets for reference examples.
 * These demonstrate frame-based physics that work with Remotion's rendering model.
 */

export const BALL_PHYSICS_SIMULATION = `
// Frame-based physics simulation for falling objects
// Works with Remotion because it's a pure function of frame number
const simulateBallPhysics = (
  frame: number,
  dropFrame: number,
  targetY: number,
  fps: number
): { y: number; settled: boolean } => {
  const elapsed = frame - dropFrame;
  if (elapsed < 0) return { y: -100, settled: false };

  const gravity = 0.004; // Acceleration per frame²
  const bounceDamping = 0.5; // Energy loss per bounce
  const maxBounces = 4;

  let y = 0;
  let velocity = 0;
  let bounces = 0;

  for (let t = 0; t < elapsed; t++) {
    velocity += gravity;
    y += velocity;

    if (y >= targetY) {
      y = targetY;
      velocity = -velocity * bounceDamping;
      bounces++;

      if (bounces >= maxBounces || Math.abs(velocity) < 0.02) {
        return { y: targetY, settled: true };
      }
    }
  }

  return { y: Math.min(y, targetY), settled: false };
};
`;

export const SQUASH_STRETCH = `
// Squash and stretch based on velocity
const getSquashStretch = (velocity: number, settled: boolean) => {
  if (settled) return { scaleX: 1, scaleY: 1 };

  const stretch = Math.min(velocity * 0.02, 0.3);
  return {
    scaleX: 1 - stretch * 0.2,
    scaleY: 1 + stretch * 0.3,
  };
};
`;

export const SHAKE_EFFECT = `
// Shake intensity based on stress level
const getShake = (frame: number, intensity: number, minDim: number) => {
  if (intensity <= 0) return { x: 0, y: 0 };

  return {
    x: Math.sin(frame * 1.5) * intensity * minDim * 0.008,
    y: Math.cos(frame * 1.8) * intensity * minDim * 0.005,
  };
};
`;

export const EXPLOSION_PARTICLES = `
// Generate explosion particles with gravity
const generateParticles = (
  count: number,
  explosionProgress: number,
  minDim: number
) => {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + i * 0.5;
    const velocity = minDim * 0.3 + (i % 5) * minDim * 0.1;
    const size = minDim * 0.015 + (i % 3) * minDim * 0.01;

    return {
      x: Math.cos(angle) * velocity * explosionProgress,
      y: Math.sin(angle) * velocity * explosionProgress
         - (explosionProgress * explosionProgress * minDim * 0.2), // gravity
      size: size * (1 - explosionProgress * 0.5),
      opacity: 1 - explosionProgress,
      rotation: explosionProgress * 360 * (i % 2 === 0 ? 1 : -1),
    };
  });
};
`;
