import { useRef, useState, useEffect } from 'react';

interface SmoothProgressOptions {
  targetPercent: number;
  isActive: boolean;
  speed?: number;
  creepRate?: number;
  maxCreepAhead?: number;
}

export function useSmoothProgress(options: SmoothProgressOptions): { displayPercent: number } {
  const {
    targetPercent,
    isActive,
    speed = 0.08,
    creepRate = 0.1,
    maxCreepAhead = 3,
  } = options;

  const [displayPercent, setDisplayPercent] = useState(0);
  const currentRef = useRef(0);
  const lastFrameRef = useRef(Date.now());
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      currentRef.current = 0;
      setDisplayPercent(0);
      return;
    }

    lastFrameRef.current = Date.now();

    const animate = () => {
      const now = Date.now();
      const deltaMs = now - lastFrameRef.current;
      lastFrameRef.current = now;

      const target = targetPercent;
      const current = currentRef.current;

      const diff = target - current;
      if (Math.abs(diff) > 0.1) {
        currentRef.current += diff * speed;
      } else {
        const maxPercent = Math.min(target + maxCreepAhead, 99);
        currentRef.current = Math.min(current + creepRate * (deltaMs / 1000), maxPercent);
      }

      setDisplayPercent(Math.min(Math.round(currentRef.current * 10) / 10, 100));
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isActive, targetPercent, speed, creepRate, maxCreepAhead]);

  useEffect(() => {
    if (targetPercent >= 100) {
      currentRef.current = 100;
      setDisplayPercent(100);
    }
  }, [targetPercent]);

  return {
    displayPercent,
  };
}
