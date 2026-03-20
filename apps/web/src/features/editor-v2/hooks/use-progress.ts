import { useState, useCallback, useRef } from 'react';
import type { ActivityState } from '@viona/shared';
import type { ActiveTask } from '../components/ai-chat/types';

// ---------------------------------------------------------------------------
// useActiveTasks — new resilient progress model
// ---------------------------------------------------------------------------

interface UseActiveTasksResult {
  tasks: ActiveTask[];
  busy: boolean;
  onTaskStarted: (task: ActiveTask) => void;
  onTaskUpdated: (id: string, action: string) => void;
  onTaskCompleted: (id: string) => void;
  onDone: () => void;
  restoreFromApi: (apiTasks: ActiveTask[], apiBusy: boolean) => void;
}

export function useActiveTasks(): UseActiveTasksResult {
  const [tasks, setTasks] = useState<ActiveTask[]>([]);
  const [busy, setBusy] = useState(false);
  // Track IDs with pending removal timers so restoreFromApi doesn't re-add them
  const pendingRemovals = useRef(new Set<string>());

  const onTaskStarted = useCallback((task: ActiveTask) => {
    // If this task was pending removal (e.g. restarted), cancel that
    pendingRemovals.current.delete(task.id);
    setTasks(prev => [...prev.filter(t => t.id !== task.id), task]);
    setBusy(true);
  }, []);

  const onTaskUpdated = useCallback((id: string, action: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, action } : t));
  }, []);

  const onTaskCompleted = useCallback((id: string) => {
    pendingRemovals.current.add(id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'completed' as const } : t));
    setTimeout(() => {
      setTasks(prev => prev.filter(t => t.id !== id));
      pendingRemovals.current.delete(id);
    }, 2500);
  }, []);

  const onDone = useCallback(() => {
    pendingRemovals.current.clear();
    setTasks([]);
    setBusy(false);
  }, []);

  const restoreFromApi = useCallback((apiTasks: ActiveTask[], apiBusy: boolean) => {
    setTasks(prev => {
      // Don't re-add tasks that have pending removal timers (already completed on frontend)
      const filtered = apiTasks.filter(t => !pendingRemovals.current.has(t.id));
      // Preserve completed tasks that are mid-fade-out (have pending timers)
      const completedPending = prev.filter(t =>
        t.status === 'completed' && pendingRemovals.current.has(t.id)
      );
      // Build merged list: API active tasks + transitioning-out completed tasks
      const apiIds = new Set(filtered.map(t => t.id));
      const merged = [...filtered];
      for (const ct of completedPending) {
        if (!apiIds.has(ct.id)) merged.push(ct);
      }
      return merged;
    });
    setBusy(apiBusy);
  }, []);

  return { tasks, busy, onTaskStarted, onTaskUpdated, onTaskCompleted, onDone, restoreFromApi };
}

// ---------------------------------------------------------------------------
// useActivity — legacy hook (kept for backward compat)
// ---------------------------------------------------------------------------

interface UseActivityResult {
  /** Current activity state (agent working, or null) */
  activity: ActivityState | null;
  /** Update from an SSE 'activity' event */
  onActivity: (data: Record<string, unknown>) => void;
  /** Update from an SSE 'progress' event (overrides action text only) */
  onProgress: (data: Record<string, unknown>) => void;
  /** Update from a stateful heartbeat */
  onHeartbeat: (data: Record<string, unknown>) => void;
  /** Clear all state */
  reset: () => void;
}

const DEBOUNCE_MS = 2000;

export function useActivity(): UseActivityResult {
  const [activity, setActivity] = useState<ActivityState | null>(null);
  // Use ref for debounce timestamp to avoid stale closures in setActivity updater
  const lastAgentChangeRef = useRef(0);

  const onActivity = useCallback((data: Record<string, unknown>) => {
    const agent = (data.agent as string) || null;
    const action = (data.action as string) || null;

    if (!agent) {
      // Explicit clear
      setActivity(null);
      lastAgentChangeRef.current = 0;
      return;
    }

    setActivity((prev: ActivityState | null) => {
      // Debounce rapid agent changes (Phase 5-6 interleaving)
      const now = Date.now();
      if (prev?.agent && prev.agent !== agent && (now - lastAgentChangeRef.current) < DEBOUNCE_MS) {
        return prev;
      }
      lastAgentChangeRef.current = now;
      return {
        agent,
        action,
        phase: (data.phase as string) || undefined,
        startedAt: (data.startedAt as number) || Date.now(),
      };
    });
  }, []);

  const onProgress = useCallback((data: Record<string, unknown>) => {
    // Progress overrides action text only — agent badge comes from activity events
    const message = data.message as string;
    if (!message) return;

    setActivity((prev: ActivityState | null) => {
      if (!prev) {
        // No active activity — create one from progress (LLM-only path)
        return {
          agent: (data.agentName as string) || null,
          action: message,
          phase: (data.phase as string) || undefined,
          startedAt: Date.now(),
        };
      }
      return { ...prev, action: message };
    });
  }, []);

  const onHeartbeat = useCallback((data: Record<string, unknown>) => {
    const heartbeatActivity = data.activity as ActivityState | null;
    if (heartbeatActivity?.agent) {
      setActivity((prev: ActivityState | null) => {
        // Only restore from heartbeat if we have no current state
        // (missed the original activity event)
        if (!prev) return heartbeatActivity;
        return prev;
      });
    }
  }, []);

  const reset = useCallback(() => {
    setActivity(null);
    lastAgentChangeRef.current = 0;
  }, []);

  return { activity, onActivity, onProgress, onHeartbeat, reset };
}
