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
