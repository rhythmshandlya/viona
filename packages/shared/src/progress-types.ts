/** Live progress state — written to Redis HSET, read by frontend */
export interface ProgressState {
  percent: number;
  message: string;
  phase: string;
  phaseName: string;
  detail?: string;
  updatedAt: number;
  meta?: Record<string, unknown>;
  /** Which agent is currently working (Editor, Planner, Animator, Reviewer) */
  agentName?: string;
  /** Which track/region is being edited (Video, Overlay, Captions, Audio) */
  trackName?: string;
  /** Estimated seconds remaining for current phase */
  estimatedTimeRemaining?: number;
}

/** Subprocess health — published alongside progress */
export interface HealthState {
  processAlive: boolean;
  lastHeartbeat: number;
  lastFileChange: number;
  lastRedisUpdate: number;
  phase: string;
  retriesUsed: number;
  retriesMax: number;
}

/** Current activity state — singleton, not a log. Used by sandbox pipeline ActivityBar. */
export interface ActivityState {
  /** Which agent is currently active, or null if idle */
  agent: string | null;
  /** Human-readable description of current work, or null if idle */
  action: string | null;
  /** Pipeline phase: planning, trimming, editing, generating, reviewing, assembling */
  phase?: string;
  /** Timestamp when this activity started (epoch ms) */
  startedAt?: number;
}

/** Single entry in the activity log */
export interface ActivityEvent {
  timestamp: number;
  type: 'file' | 'phase' | 'checkpoint' | 'health' | 'error';
  detail: string;
  phase?: string;
}

/** Phase completion status */
export interface PhaseCheckpoint {
  status: 'pending' | 'running' | 'complete' | 'failed';
  completedAt?: number;
  artifacts: string[];
}

/** Animate phase has extra scene tracking */
export interface AnimatePhaseCheckpoint extends PhaseCheckpoint {
  scenesTotal: number;
  scenesComplete: number[];
  scenesFailed: number[];
}

/** Checkpoint file written to .checkpoint.json for crash recovery */
export interface CheckpointState {
  version: 1;
  jobId: string;
  updatedAt: number;
  phases: {
    plan: PhaseCheckpoint;
    animate: AnimatePhaseCheckpoint;
    verify: PhaseCheckpoint;
    bundle: PhaseCheckpoint;
  };
}

/** Redis key helpers — ensures consistent key naming across worker + API */
export const PROGRESS_KEYS = {
  state: (jobId: string) => `job:${jobId}:progress`,
  health: (jobId: string) => `job:${jobId}:health`,
  activity: (jobId: string) => `job:${jobId}:activity`,
} as const;

/* ── Agent Plan (chat redesign) ── */

export interface AgentSubtask {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  tools?: string[];
}

export interface AgentTask {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  agent?: string;
  subtasks?: AgentSubtask[];
}

export interface AgentPlan {
  title: string;
  tasks: AgentTask[];
}

/**
 * ProgressPayload is the MCP tool input shape (subset of ProgressState).
 * ProgressState (above) is the full Redis-persisted state with timestamps.
 */
export interface ProgressPayload {
  phase: string;
  percent?: number;
  message: string;
  agentName?: string;
  trackName?: string;
  estimatedTimeRemaining?: number;
}

/** Default empty checkpoint */
export function createEmptyCheckpoint(jobId: string): CheckpointState {
  const emptyPhase: PhaseCheckpoint = { status: 'pending', artifacts: [] };
  return {
    version: 1,
    jobId,
    updatedAt: Date.now(),
    phases: {
      plan: { ...emptyPhase },
      animate: { ...emptyPhase, scenesTotal: 0, scenesComplete: [], scenesFailed: [] },
      verify: { ...emptyPhase },
      bundle: { ...emptyPhase },
    },
  };
}
