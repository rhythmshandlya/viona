import { useRef, useState, useEffect } from 'react';

interface SmoothProgressOptions {
  targetPercent: number;
  isActive: boolean;
  /** Lerp speed toward target (0–1). Higher = snappier catch-up. */
  speed?: number;
  /** % per second to creep when waiting for next backend update. */
  creepRate?: number;
  /** Max % the bar can creep beyond the last known target. */
  maxCreepAhead?: number;
}

/**
 * Smoothly animates a progress bar toward a target value, and slowly
 * "creeps" forward when the backend is silent — so the user always
 * sees movement and knows work is happening.
 *
 * Creep uses a decaying rate: fast at first, slowing as it approaches
 * the ceiling so it never jumps ahead too far.
 */
export function useSmoothProgress(options: SmoothProgressOptions): { displayPercent: number } {
  const {
    targetPercent,
    isActive,
    speed = 0.12,
    creepRate = 0.8,
    maxCreepAhead = 12,
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
        // Catching up to backend — lerp toward target
        currentRef.current += diff * speed;
      } else {
        // Waiting for next backend update — creep forward with decay
        const ceiling = Math.min(target + maxCreepAhead, 99);
        const headroom = ceiling - current;
        if (headroom > 0.05) {
          // Decay: creep fast at first, slow down as we near the ceiling
          const decayFactor = headroom / maxCreepAhead;
          const effectiveRate = creepRate * decayFactor;
          currentRef.current = Math.min(
            current + effectiveRate * (deltaMs / 1000),
            ceiling,
          );
        }
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
