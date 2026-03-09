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