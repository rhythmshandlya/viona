import { describe, it, expect } from 'vitest';
import { buildSplitPrompt } from './split-visual-scene.js';

// ============================================
// Frame Calculation Logic
// ============================================

describe('split-visual-scene frame calculations', () => {
  const fps = 30;

  it('calculates left and right frame durations correctly for a mid-scene split', () => {
    const sceneStartMs = 5000;
    const sceneEndMs = 15000;
    const splitAtMs = 10000;

    const totalSceneDurationMs = sceneEndMs - sceneStartMs; // 10000ms
    const splitOffsetMs = splitAtMs - sceneStartMs; // 5000ms
    const leftDurationFrames = Math.round((splitOffsetMs / 1000) * fps); // 150
    const rightDurationFrames = Math.round(((totalSceneDurationMs - splitOffsetMs) / 1000) * fps); // 150
    const totalSceneFrames = Math.round((totalSceneDurationMs / 1000) * fps); // 300

    expect(leftDurationFrames).toBe(150);
    expect(rightDurationFrames).toBe(150);
    expect(totalSceneFrames).toBe(300);
    expect(leftDurationFrames + rightDurationFrames).toBe(totalSceneFrames);
  });

  it('handles asymmetric split (early cut)', () => {
    const sceneStartMs = 0;
    const sceneEndMs = 9000;
    const splitAtMs = 3000;

    const totalSceneDurationMs = sceneEndMs - sceneStartMs;
    const splitOffsetMs = splitAtMs - sceneStartMs;
    const leftDurationFrames = Math.round((splitOffsetMs / 1000) * fps);
    const rightDurationFrames = Math.round(((totalSceneDurationMs - splitOffsetMs) / 1000) * fps);

    expect(leftDurationFrames).toBe(90);   // 3s * 30fps
    expect(rightDurationFrames).toBe(180); // 6s * 30fps
  });

  it('handles asymmetric split (late cut)', () => {
    const sceneStartMs = 2000;
    const sceneEndMs = 12000;
    const splitAtMs = 10000;

    const totalSceneDurationMs = sceneEndMs - sceneStartMs;
    const splitOffsetMs = splitAtMs - sceneStartMs;
    const leftDurationFrames = Math.round((splitOffsetMs / 1000) * fps);
    const rightDurationFrames = Math.round(((totalSceneDurationMs - splitOffsetMs) / 1000) * fps);

    expect(leftDurationFrames).toBe(240);  // 8s * 30fps
    expect(rightDurationFrames).toBe(60);  // 2s * 30fps
  });

  it('handles non-standard fps (24fps)', () => {
    const customFps = 24;
    const sceneStartMs = 0;
    const sceneEndMs = 5000;
    const splitAtMs = 2500;

    const totalSceneDurationMs = sceneEndMs - sceneStartMs;
    const splitOffsetMs = splitAtMs - sceneStartMs;
    const leftDurationFrames = Math.round((splitOffsetMs / 1000) * customFps);
    const rightDurationFrames = Math.round(((totalSceneDurationMs - splitOffsetMs) / 1000) * customFps);

    expect(leftDurationFrames).toBe(60);  // 2.5s * 24fps
    expect(rightDurationFrames).toBe(60); // 2.5s * 24fps
  });

  it('handles fractional millisecond split points', () => {
    const sceneStartMs = 1000;
    const sceneEndMs = 8333;
    const splitAtMs = 4567;

    const totalSceneDurationMs = sceneEndMs - sceneStartMs; // 7333ms
    const splitOffsetMs = splitAtMs - sceneStartMs; // 3567ms
    const leftDurationFrames = Math.round((splitOffsetMs / 1000) * fps); // round(107.01) = 107
    const rightDurationFrames = Math.round(((totalSceneDurationMs - splitOffsetMs) / 1000) * fps); // round(112.98) = 113
    const totalSceneFrames = Math.round((totalSceneDurationMs / 1000) * fps); // round(219.99) = 220

    expect(leftDurationFrames).toBe(107);
    expect(rightDurationFrames).toBe(113);
    expect(totalSceneFrames).toBe(220);
    // Note: due to rounding, left + right may differ from total by 1 frame at most
    expect(Math.abs((leftDurationFrames + rightDurationFrames) - totalSceneFrames)).toBeLessThanOrEqual(1);
  });
});

// ============================================
// Scene ID Assignment
// ============================================

describe('split-visual-scene ID assignment', () => {
  it('assigns sequential IDs after the max existing scene ID', () => {
    const scenes = [
      { id: 1, timestampRange: [0, 5] as [number, number] },
      { id: 2, timestampRange: [5, 10] as [number, number] },
      { id: 3, timestampRange: [10, 15] as [number, number] },
    ];

    const maxExistingId = Math.max(...scenes.map((s) => s.id));
    const leftSceneId = maxExistingId + 1;
    const rightSceneId = maxExistingId + 2;

    expect(leftSceneId).toBe(4);
    expect(rightSceneId).toBe(5);
  });

  it('handles gaps in existing scene IDs (from prior splits)', () => {
    // After a previous split of scene_2, scenes are: 1, 3, 4, 5
    const scenes = [
      { id: 1, timestampRange: [0, 5] as [number, number] },
      { id: 3, timestampRange: [10, 15] as [number, number] },
      { id: 4, timestampRange: [5, 7.5] as [number, number] },
      { id: 5, timestampRange: [7.5, 10] as [number, number] },
    ];

    const maxExistingId = Math.max(...scenes.map((s) => s.id));
    const leftSceneId = maxExistingId + 1;
    const rightSceneId = maxExistingId + 2;

    expect(leftSceneId).toBe(6);
    expect(rightSceneId).toBe(7);
  });

  it('handles single scene project', () => {
    const scenes = [
      { id: 1, timestampRange: [0, 30] as [number, number] },
    ];

    const maxExistingId = Math.max(...scenes.map((s) => s.id));
    const leftSceneId = maxExistingId + 1;
    const rightSceneId = maxExistingId + 2;

    expect(leftSceneId).toBe(2);
    expect(rightSceneId).toBe(3);
  });
});

// ============================================
// Timestamps Array Update Logic
// ============================================

describe('split-visual-scene timestamps update', () => {
  it('replaces the target scene entry with two new entries', () => {
    const sourceSceneId = 2;
    const leftSceneId = 4;
    const rightSceneId = 5;
    const splitAtMs = 7500;

    const currentTimestamps = [
      { startMs: 0, endMs: 5000, type: 'process', description: 'Scene 1', sourceSceneId: 1 },
      { startMs: 5000, endMs: 10000, type: 'chart', description: 'Scene 2', sourceSceneId: 2 },
      { startMs: 10000, endMs: 15000, type: 'process', description: 'Scene 3', sourceSceneId: 3 },
    ];

    const newTimestamps = currentTimestamps.flatMap((ts) => {
      if (ts.sourceSceneId === sourceSceneId) {
        return [
          { startMs: ts.startMs, endMs: splitAtMs, type: ts.type, description: 'Left half', sourceSceneId: leftSceneId },
          { startMs: splitAtMs, endMs: ts.endMs, type: ts.type, description: 'Right half', sourceSceneId: rightSceneId },
        ];
      }
      return [ts];
    });

    expect(newTimestamps).toHaveLength(4);
    expect(newTimestamps[0].sourceSceneId).toBe(1);
    expect(newTimestamps[1].sourceSceneId).toBe(4);
    expect(newTimestamps[1].startMs).toBe(5000);
    expect(newTimestamps[1].endMs).toBe(7500);
    expect(newTimestamps[2].sourceSceneId).toBe(5);
    expect(newTimestamps[2].startMs).toBe(7500);
    expect(newTimestamps[2].endMs).toBe(10000);
    expect(newTimestamps[3].sourceSceneId).toBe(3);
  });

  it('preserves all other timestamps unchanged', () => {
    const sourceSceneId = 1;
    const currentTimestamps = [
      { startMs: 0, endMs: 5000, type: 'process', description: 'Scene 1', sourceSceneId: 1 },
      { startMs: 5000, endMs: 10000, type: 'chart', description: 'Scene 2', sourceSceneId: 2 },
    ];

    const newTimestamps = currentTimestamps.flatMap((ts) => {
      if (ts.sourceSceneId === sourceSceneId) {
        return [
          { ...ts, endMs: 2500, sourceSceneId: 3 },
          { ...ts, startMs: 2500, sourceSceneId: 4 },
        ];
      }
      return [ts];
    });

    // Scene 2 should be completely untouched
    const scene2 = newTimestamps.find((t) => t.sourceSceneId === 2);
    expect(scene2).toBeDefined();
    expect(scene2!.startMs).toBe(5000);
    expect(scene2!.endMs).toBe(10000);
    expect(scene2!.type).toBe('chart');
    expect(scene2!.description).toBe('Scene 2');
  });

  it('handles split of the first scene', () => {
    const sourceSceneId = 1;
    const splitAtMs = 3000;

    const currentTimestamps = [
      { startMs: 0, endMs: 7000, type: 'process', description: 'First scene', sourceSceneId: 1 },
      { startMs: 7000, endMs: 14000, type: 'chart', description: 'Second scene', sourceSceneId: 2 },
    ];

    const newTimestamps = currentTimestamps.flatMap((ts) => {
      if (ts.sourceSceneId === sourceSceneId) {
        return [
          { startMs: 0, endMs: splitAtMs, type: ts.type, description: 'Left', sourceSceneId: 3 },
          { startMs: splitAtMs, endMs: ts.endMs, type: ts.type, description: 'Right', sourceSceneId: 4 },
        ];
      }
      return [ts];
    });

    expect(newTimestamps).toHaveLength(3);
    expect(newTimestamps[0].startMs).toBe(0);
    expect(newTimestamps[0].endMs).toBe(3000);
    expect(newTimestamps[1].startMs).toBe(3000);
    expect(newTimestamps[1].endMs).toBe(7000);
    expect(newTimestamps[2].startMs).toBe(7000);
  });

  it('handles split of the last scene', () => {
    const sourceSceneId = 3;
    const splitAtMs = 12000;

    const currentTimestamps = [
      { startMs: 0, endMs: 5000, type: 'process', description: 'S1', sourceSceneId: 1 },
      { startMs: 5000, endMs: 10000, type: 'chart', description: 'S2', sourceSceneId: 2 },
      { startMs: 10000, endMs: 15000, type: 'process', description: 'S3', sourceSceneId: 3 },
    ];

    const newTimestamps = currentTimestamps.flatMap((ts) => {
      if (ts.sourceSceneId === sourceSceneId) {
        return [
          { startMs: ts.startMs, endMs: splitAtMs, type: ts.type, description: 'Left', sourceSceneId: 4 },
          { startMs: splitAtMs, endMs: ts.endMs, type: ts.type, description: 'Right', sourceSceneId: 5 },
        ];
      }
      return [ts];
    });

    expect(newTimestamps).toHaveLength(4);
    expect(newTimestamps[2].endMs).toBe(12000);
    expect(newTimestamps[3].startMs).toBe(12000);
    expect(newTimestamps[3].endMs).toBe(15000);
  });
});

// ============================================
// Build Split Prompt
// ============================================

describe('buildSplitPrompt', () => {
  const defaultOpts = {
    sourceSceneId: 2,
    leftSceneId: 4,
    rightSceneId: 5,
    sceneStartSec: 5.0,
    sceneEndSec: 15.0,
    splitSec: 10.0,
    totalSceneFrames: 300,
    leftDurationFrames: 150,
    rightDurationFrames: 150,
    fps: 30,
    targetScene: { visual: 'Animated chart showing growth' },
  };

  it('includes source scene ID', () => {
    const prompt = buildSplitPrompt(defaultOpts);
    expect(prompt).toContain('scene_2');
  });

  it('includes new scene IDs for left and right halves', () => {
    const prompt = buildSplitPrompt(defaultOpts);
    expect(prompt).toContain('scene_4');
    expect(prompt).toContain('Scene4');
    expect(prompt).toContain('scene_5');
    expect(prompt).toContain('Scene5');
  });

  it('includes correct frame durations', () => {
    const prompt = buildSplitPrompt(defaultOpts);
    expect(prompt).toContain('exactly 150 frames total');
    // Both halves should have 150 frames in this symmetric split
    expect(prompt.match(/exactly 150 frames total/g)?.length).toBe(2);
  });

  it('includes original scene timestamp range', () => {
    const prompt = buildSplitPrompt(defaultOpts);
    expect(prompt).toContain('5.000s to 15.000s');
  });

  it('includes split point', () => {
    const prompt = buildSplitPrompt(defaultOpts);
    expect(prompt).toContain('10.000s from video start');
  });

  it('includes scene visual description in scenes.json update', () => {
    const prompt = buildSplitPrompt(defaultOpts);
    expect(prompt).toContain('Animated chart showing growth');
  });

  it('escapes double quotes in visual description', () => {
    const opts = {
      ...defaultOpts,
      targetScene: { visual: 'Chart showing "growth" metrics' },
    };
    const prompt = buildSplitPrompt(opts);
    expect(prompt).toContain('Chart showing \\"growth\\" metrics');
    expect(prompt).not.toContain('"growth"');
  });

  it('falls back to default description when visual is undefined', () => {
    const opts = { ...defaultOpts, targetScene: {} };
    const prompt = buildSplitPrompt(opts);
    expect(prompt).toContain('Left half of scene 2');
    expect(prompt).toContain('Right half of scene 2');
  });

  it('includes all 5 steps', () => {
    const prompt = buildSplitPrompt(defaultOpts);
    expect(prompt).toContain('STEP 1');
    expect(prompt).toContain('STEP 2');
    expect(prompt).toContain('STEP 3');
    expect(prompt).toContain('STEP 4');
    expect(prompt).toContain('STEP 5');
  });

  it('tells Claude not to modify other files', () => {
    const prompt = buildSplitPrompt(defaultOpts);
    expect(prompt).toContain('Do NOT modify SCENE_PLAN.md');
    expect(prompt).toContain('constants.ts');
  });

  it('includes interpolation scaling instructions', () => {
    const prompt = buildSplitPrompt(defaultOpts);
    expect(prompt).toContain(`[0, ${defaultOpts.totalSceneFrames}] to [0, ${defaultOpts.leftDurationFrames}]`);
    expect(prompt).toContain(`[0, ${defaultOpts.totalSceneFrames}] to [0, ${defaultOpts.rightDurationFrames}]`);
  });

  it('handles asymmetric frame counts', () => {
    const opts = {
      ...defaultOpts,
      leftDurationFrames: 90,
      rightDurationFrames: 210,
      splitSec: 8.0,
    };
    const prompt = buildSplitPrompt(opts);
    expect(prompt).toContain('exactly 90 frames total');
    expect(prompt).toContain('exactly 210 frames total');
  });

  it('generates valid scenes.json timestampRange values', () => {
    const prompt = buildSplitPrompt(defaultOpts);
    // Left half: [5.000, 10.000]
    expect(prompt).toContain(`[5.000, 10.000]`);
    // Right half: [10.000, 15.000]
    expect(prompt).toContain(`[10.000, 15.000]`);
  });
});

// ============================================
// CompositionId format handling
// ============================================

describe('split-visual-scene compositionId format', () => {
  it('converts hyphen compositionId to underscore for workspace', () => {
    const compositionId = 'proj-abc-def';
    const workspaceCompositionId = compositionId.replace(/-/g, '_');
    expect(workspaceCompositionId).toBe('proj_abc_def');
  });

  it('converts underscore compositionId to hyphen for source download', () => {
    const compositionId = 'proj_abc_def';
    const sourceCompositionId = compositionId.replace(/_/g, '-');
    expect(sourceCompositionId).toBe('proj-abc-def');
  });

  it('handles compositionId with no hyphens (already underscore)', () => {
    const compositionId = 'proj_abc_def';
    const workspaceCompositionId = compositionId.replace(/-/g, '_');
    expect(workspaceCompositionId).toBe('proj_abc_def');
  });

  it('handles compositionId with no underscores (already hyphen)', () => {
    const compositionId = 'proj-abc-def';
    const sourceCompositionId = compositionId.replace(/_/g, '-');
    expect(sourceCompositionId).toBe('proj-abc-def');
  });
});

// ============================================
// Job data validation
// ============================================

describe('split-visual-scene job data', () => {
  it('validates all required fields are present', () => {
    const jobData = {
      projectId: 'proj-123',
      jobId: 'job-456',
      compositionId: 'proj-abc-def',
      sourceSceneId: 2,
      splitAtMs: 7500,
      leftItemId: 'uuid-left',
      rightItemId: 'uuid-right',
    };

    expect(jobData.projectId).toBeTruthy();
    expect(jobData.jobId).toBeTruthy();
    expect(jobData.compositionId).toBeTruthy();
    expect(jobData.sourceSceneId).toBeGreaterThanOrEqual(1);
    expect(jobData.splitAtMs).toBeGreaterThanOrEqual(0);
    expect(jobData.leftItemId).toBeTruthy();
    expect(jobData.rightItemId).toBeTruthy();
  });

  it('transcript is optional', () => {
    const jobData = {
      projectId: 'proj-123',
      jobId: 'job-456',
      compositionId: 'proj-abc-def',
      sourceSceneId: 1,
      splitAtMs: 5000,
      leftItemId: 'uuid-left',
      rightItemId: 'uuid-right',
      transcript: undefined,
    };

    expect(jobData.transcript).toBeUndefined();
  });

  it('sourceSceneId must be 1-indexed (positive integer)', () => {
    const valid = [1, 2, 3, 10, 100];
    const invalid = [0, -1, 0.5];

    for (const id of valid) {
      expect(Number.isInteger(id) && id >= 1).toBe(true);
    }
    for (const id of invalid) {
      expect(Number.isInteger(id) && id >= 1).toBe(false);
    }
  });
});

// ============================================
// Timeline item data update logic
// ============================================

describe('split-visual-scene timeline item data update', () => {
  it('preserves all existing data fields when updating sourceSceneId', () => {
    const originalData = {
      visualId: 'vis-123',
      compositionId: 'proj-abc-def',
      bundleUrl: '/bundles/proj-abc-def',
      type: 'chart',
      description: 'Growth chart',
      width: 1080,
      height: 1920,
      fps: 30,
      sourceSceneId: 2,
      displayMode: 'default',
    };

    const updatedData = { ...originalData, sourceSceneId: 4 };

    expect(updatedData.sourceSceneId).toBe(4);
    expect(updatedData.visualId).toBe('vis-123');
    expect(updatedData.compositionId).toBe('proj-abc-def');
    expect(updatedData.type).toBe('chart');
    expect(updatedData.description).toBe('Growth chart');
    expect(updatedData.width).toBe(1080);
    expect(updatedData.height).toBe(1920);
    expect(updatedData.displayMode).toBe('default');
  });

  it('left and right items get different scene IDs', () => {
    const leftData = { sourceSceneId: 4 };
    const rightData = { sourceSceneId: 5 };

    expect(leftData.sourceSceneId).not.toBe(rightData.sourceSceneId);
    expect(rightData.sourceSceneId).toBe(leftData.sourceSceneId + 1);
  });
});
