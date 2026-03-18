import { logger } from '../logger.js';
import { config } from '../config.js';

interface ProjectActivity {
  lastActivity: number;         // timestamp ms
  connectionCount: number;      // active WebSocket connections
  idleTimer: ReturnType<typeof setTimeout> | null;
  graceTimer: ReturnType<typeof setTimeout> | null;
}

const activityMap = new Map<string, ProjectActivity>();

type SuspendCallback = (projectId: string, reason: string) => Promise<void>;
let onSuspend: SuspendCallback | null = null;

/**
 * Register callback for when a project should be suspended.
 */
export function onSandboxIdle(cb: SuspendCallback): void {
  onSuspend = cb;
}

/**
 * Record activity for a project. Resets idle timer.
 */
export function touchActivity(projectId: string): void {
  let activity = activityMap.get(projectId);
  if (!activity) {
    activity = { lastActivity: Date.now(), connectionCount: 0, idleTimer: null, graceTimer: null };
    activityMap.set(projectId, activity);
  }

  activity.lastActivity = Date.now();

  // Clear any pending idle/grace timers
  if (activity.idleTimer) {
    clearTimeout(activity.idleTimer);
    activity.idleTimer = null;
  }
  if (activity.graceTimer) {
    clearTimeout(activity.graceTimer);
    activity.graceTimer = null;
  }
}

/**
 * Track WebSocket connection for a project.
 */
export function addConnection(projectId: string): void {
  touchActivity(projectId);
  const activity = activityMap.get(projectId)!;
  activity.connectionCount++;
}

/**
 * Track WebSocket disconnection. Starts grace period if no connections remain.
 */
export function removeConnection(projectId: string): void {
  const activity = activityMap.get(projectId);
  if (!activity) return;

  activity.connectionCount = Math.max(0, activity.connectionCount - 1);

  if (activity.connectionCount === 0) {
    // Start grace period before idle countdown
    activity.graceTimer = setTimeout(() => {
      activity.graceTimer = null;
      startIdleTimer(projectId);
    }, config.sandbox.reconnectionGraceMs);
  }
}

function startIdleTimer(projectId: string): void {
  const activity = activityMap.get(projectId);
  if (!activity || activity.connectionCount > 0) return;

  activity.idleTimer = setTimeout(async () => {
    activity.idleTimer = null;
    logger.info({ projectId }, 'Sandbox idle timeout — suspending');

    if (onSuspend) {
      try {
        await onSuspend(projectId, 'idle');
      } catch (err) {
        logger.error({ err, projectId }, 'Failed to suspend sandbox');
      }
    }
  }, config.sandbox.idleTimeoutMs);
}

/**
 * Clean up activity tracking for a project (on delete).
 */
export function removeActivity(projectId: string): void {
  const activity = activityMap.get(projectId);
  if (activity) {
    if (activity.idleTimer) clearTimeout(activity.idleTimer);
    if (activity.graceTimer) clearTimeout(activity.graceTimer);
  }
  activityMap.delete(projectId);
}
