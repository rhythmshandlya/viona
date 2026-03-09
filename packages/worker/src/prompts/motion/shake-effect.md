const getShake = (frame: number, intensity: number, minDim: number) => {
  if (intensity <= 0) return { x: 0, y: 0 };
  return {
    x: Math.sin(frame * 1.5) * intensity * minDim * 0.008,
    y: Math.cos(frame * 1.8) * intensity * minDim * 0.005,
  };
};