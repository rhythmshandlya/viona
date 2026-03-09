const getSquashStretch = (velocity: number, settled: boolean) => {
  if (settled) return { scaleX: 1, scaleY: 1 };
  const stretch = Math.min(velocity * 0.02, 0.3);
  return {
    scaleX: 1 - stretch * 0.2,
    scaleY: 1 + stretch * 0.3,
  };
};