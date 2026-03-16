import { useState, useRef, useCallback } from 'react';
import type { ProgressState, HealthState, ActivityEvent } from '@viona/shared';

type ProgressSource = 'sse' | 'ws' | 'http' | null;

interface UseProgressResult {
  progress: ProgressState | null;
  health: HealthState | null;
  activity: ActivityEvent[];
  source: ProgressSource;
  onSSEProgress: (data: Record<string, unknown>) => void;
  onSSEActivity: (data: Record<string, unknown>) => void;
  onSSEHealth: (data: Record<string, unknown>) => void;
  onWSProgress: (data: Record<string, unknown>) => void;
  onWSHealth: (data: Record<string, unknown>) => void;
  onHTTPProgress: (data: Record<string, unknown>) => void;
  reset: () => void;
}

export function useProgress(): UseProgressResult {
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [health, setHealth] = useState<HealthState | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [source, setSource] = useState<ProgressSource>(null);
  const highWaterRef = useRef(0);
  const sourceRef = useRef<ProgressSource>(null);

  const updateProgress = useCallback((data: Record<string, unknown>, src: ProgressSource) => {
    const priority: Record<string, number> = { sse: 3, ws: 2, http: 1 };
    const currentPriority = priority[sourceRef.current ?? ''] ?? 0;
    const newPriority = priority[src ?? ''] ?? 0;

    if (newPriority < currentPriority) return;

    const percent = Math.max(
      (data.percent as number) ?? 0,
      highWaterRef.current,
    );
    highWaterRef.current = percent;

    sourceRef.current = src;
    setSource(src);
    setProgress({
      percent,
      message: (data.message as string) || 'Processing...',
      phase: (data.phase as string) || 'unknown',
      phaseName: (data.phaseName as string) || 'Processing',
      detail: (data.detail as string) || undefined,
      updatedAt: Date.now(),
      meta: (data.meta as Record<string, unknown>) || undefined,
      agentName: (data.agentName as string) || undefined,
      trackName: (data.trackName as string) || undefined,
      estimatedTimeRemaining: (data.estimatedTimeRemaining as number) || undefined,
    });
  }, []);

  const onSSEProgress = useCallback((data: Record<string, unknown>) => updateProgress(data, 'sse'), [updateProgress]);
  const onWSProgress = useCallback((data: Record<string, unknown>) => updateProgress(data, 'ws'), [updateProgress]);
  const onHTTPProgress = useCallback((data: Record<string, unknown>) => updateProgress(data, 'http'), [updateProgress]);

  const onSSEActivity = useCallback((data: Record<string, unknown>) => {
    const event = data as unknown as ActivityEvent;
    setActivity((prev) => [...prev.slice(-99), event]);
  }, []);

  const onSSEHealth = useCallback((data: Record<string, unknown>) => {
    setHealth(data as unknown as HealthState);
  }, []);

  const onWSHealth = useCallback((data: Record<string, unknown>) => {
    setHealth(data as unknown as HealthState);
  }, []);

  const reset = useCallback(() => {
    setProgress(null);
    setHealth(null);
    setActivity([]);
    setSource(null);
    sourceRef.current = null;
    highWaterRef.current = 0;
  }, []);

  return {
    progress,
    health,
    activity,
    source,
    onSSEProgress,
    onSSEActivity,
    onSSEHealth,
    onWSProgress,
    onWSHealth,
    onHTTPProgress,
    reset,
  };
}
