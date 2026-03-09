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