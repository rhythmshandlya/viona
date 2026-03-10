// packages/worker/src/monitor/progress-mapper.ts

import type { ProgressState, CheckpointState } from '@viona/shared';
import type { ProgressMapper } from './types.js';

export interface PhaseWeights {
  [phase: string]: { start: number; end: number; label: string };
}

export const DEFAULT_PHASE_WEIGHTS: PhaseWeights = {
  plan:    { start: 15, end: 35,  label: 'Planning scenes' },
  animate: { start: 35, end: 65,  label: 'Animating scenes' },
  verify:  { start: 65, end: 75,  label: 'Verifying scenes' },
  bundle:  { start: 75, end: 90,  label: 'Bundling' },
  upload:  { start: 90, end: 100, label: 'Uploading' },
};

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * Math.max(0, Math.min(1, t)));
}

export class BaseProgressMapper implements ProgressMapper {
  protected weights: PhaseWeights;

  constructor(weights: PhaseWeights = DEFAULT_PHASE_WEIGHTS) {
    this.weights = weights;
  }

  mapFilesToProgress(checkpoint: CheckpointState): Partial<ProgressState> {
    if (checkpoint.phases.bundle.status === 'running' || checkpoint.phases.bundle.status === 'complete') {
      const w = this.weights.bundle;
      return { percent: w.start, phase: 'bundle', phaseName: w.label };
    }

    if (checkpoint.phases.verify.status === 'running' || checkpoint.phases.verify.status === 'complete') {
      const w = this.weights.verify;
      return { percent: w.start, phase: 'verify', phaseName: w.label };
    }

    if (checkpoint.phases.animate.status === 'running') {
      const w = this.weights.animate;
      const total = checkpoint.phases.animate.scenesTotal;
      const done = checkpoint.phases.animate.scenesComplete.length;
      const t = total > 0 ? done / total : 0;
      return {
        percent: lerp(w.start, w.end, t),
        phase: 'animate',
        phaseName: w.label,
        detail: total > 0 ? `Scene ${done}/${total}` : undefined,
      };
    }

    if (checkpoint.phases.animate.status === 'complete') {
      const w = this.weights.animate;
      return { percent: w.end, phase: 'animate', phaseName: w.label };
    }

    if (checkpoint.phases.plan.status === 'running') {
      const w = this.weights.plan;
      return { percent: w.start, phase: 'plan', phaseName: w.label };
    }

    if (checkpoint.phases.plan.status === 'complete') {
      const w = this.weights.plan;
      return { percent: w.end, phase: 'plan', phaseName: w.label };
    }

    return { percent: 10, phase: 'starting', phaseName: 'Starting' };
  }

  mapHeartbeatToProgress(phase: string, detail: string): Partial<ProgressState> {
    const w = this.weights[phase];
    if (!w) return { phase, phaseName: phase, detail };
    return { phase, phaseName: w.label, detail };
  }

  mapStdoutToProgress(
    percent: number,
    message: string,
    meta?: Record<string, unknown>,
  ): Partial<ProgressState> {
    return {
      percent,
      message,
      phase: (meta?.phase as string) || undefined,
      phaseName: (meta?.phaseName as string) || undefined,
    };
  }
}
