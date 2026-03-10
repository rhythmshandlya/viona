// packages/worker/src/processors/generate-visuals/visual-progress-mapper.ts

import { BaseProgressMapper, DEFAULT_PHASE_WEIGHTS } from '../../monitor/progress-mapper.js';
import type { CheckpointState, ProgressState } from '@viona/shared';

/**
 * ProgressMapper specialized for visual generation.
 * Adds scene-level detail and smarter file-to-progress mapping.
 */
export class VisualProgressMapper extends BaseProgressMapper {
  constructor() {
    super(DEFAULT_PHASE_WEIGHTS);
  }

  override mapFilesToProgress(checkpoint: CheckpointState): Partial<ProgressState> {
    const base = super.mapFilesToProgress(checkpoint);

    if (base.phase === 'animate' && checkpoint.phases.animate.scenesTotal > 0) {
      const done = checkpoint.phases.animate.scenesComplete.length;
      const total = checkpoint.phases.animate.scenesTotal;
      base.detail = `Scene ${done}/${total}`;
      base.message = `Animating scene ${done + 1} of ${total}`;
    }

    return base;
  }

  override mapHeartbeatToProgress(phase: string, detail: string): Partial<ProgressState> {
    const base = super.mapHeartbeatToProgress(phase, detail);
    base.detail = detail;
    return base;
  }
}
