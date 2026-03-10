import { useRef, useState, useEffect } from 'react';

interface SmoothProgressOptions {
  targetPercent: number;
  isActive: boolean;
  speed?: number;
  creepRate?: number;
  maxCreepAhead?: number;
}

interface SmoothProgressResult {
  displayPercent: number;
  isCreeping: boolean;
}

export function useSmoothProgress(options: SmoothProgressOptions): SmoothProgressResult {
  const {
    targetPercent,
    isActive,
    speed = 0.08,
    creepRate = 0.1,
    maxCreepAhead = 3,
  } = options;

  const [displayPercent, setDisplayPercent] = useState(0);
  const currentRef = useRef(0);
  const lastUpdateRef = useRef(Date.now());
  const animFrameRef = useRef<number | null>(null);
  const isCreepingRef = useRef(false);

  useEffect(() => {
    if (!isActive) {
      currentRef.current = 0;
      setDisplayPercent(0);
      return;
    }

    lastUpdateRef.current = Date.now();

    const animate = () => {
      const now = Date.now();
      const target = targetPercent;
      const current = currentRef.current;

      const diff = target - current;
      if (Math.abs(diff) > 0.1) {
        currentRef.current += diff * speed;
        isCreepingRef.current = false;
      } else {
        const elapsedSec = (now - lastUpdateRef.current) / 1000;
        const creep = elapsedSec * creepRate;
        const maxPercent = Math.min(target + maxCreepAhead, 99);
        currentRef.current = Math.min(current + creep * 0.016, maxPercent);
        isCreepingRef.current = true;
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
    isCreeping: isCreepingRef.current,
  };
}
