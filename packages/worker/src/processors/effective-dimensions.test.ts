import { describe, it, expect } from 'vitest';

/**
 * Unit tests for per-scene dimension-aware visual generation.
 *
 * Tests the core logic used in generate-visuals.ts and plan-visuals.ts
 * for computing effective dimensions per scene based on displayMode
 * and layout mode.
 */

// -------------------------------------------------------------------
// Types (mirrors queue.ts)
// -------------------------------------------------------------------
type VisualsLayoutMode = 'pip' | 'stacked';

interface VisualsDimensions {
  width: number;
  height: number;
}

// -------------------------------------------------------------------
// Pure functions extracted from generate-visuals.ts logic
// -------------------------------------------------------------------

/**
 * Resolve the effective pip dimensions.
 * If pipEffective is not provided, falls back to full canvas.
 */
function resolvePipEffective(
  pipEffective: VisualsDimensions | undefined,
  canvasWidth: number,
  canvasHeight: number,
): VisualsDimensions {
  return pipEffective || { width: canvasWidth, height: canvasHeight };
}

/**
 * Compute effective dimensions for a single scene based on its displayMode.
 * Fullscreen and overlay scenes always use the full canvas.
 * Pip scenes use the pip-effective area (which may be smaller in split layouts).
 */
function computeSceneEffectiveDimensions(
  displayMode: string | undefined,
  canvasWidth: number,
  canvasHeight: number,
  pipEffective: VisualsDimensions,
): { effectiveWidth: number; effectiveHeight: number; displayMode: string } {
  const dm = displayMode || 'default';
  if (dm === 'fullscreen' || dm === 'overlay') {
    return { effectiveWidth: canvasWidth, effectiveHeight: canvasHeight, displayMode: dm };
  }
  return { effectiveWidth: pipEffective.width, effectiveHeight: pipEffective.height, displayMode: dm };
}

/**
 * Enrich an array of scenes with effectiveDimensions (used before writing scenes.json).
 */
function enrichScenesWithDimensions(
  scenes: Array<Record<string, unknown>>,
  canvasWidth: number,
  canvasHeight: number,
  pipEffective: VisualsDimensions,
): Array<Record<string, unknown>> {
  return scenes.map((scene) => {
    const dm = (scene.displayMode as string) || 'default';
    if (dm === 'fullscreen' || dm === 'overlay') {
      return { ...scene, effectiveDimensions: { width: canvasWidth, height: canvasHeight } };
    }
    return { ...scene, effectiveDimensions: { width: pipEffective.width, height: pipEffective.height } };
  });
}

// ===================================================================
// Tests
// ===================================================================

describe('resolvePipEffective', () => {
  it('returns provided pipEffective when present', () => {
    const result = resolvePipEffective({ width: 540, height: 1920 }, 1080, 1920);
    expect(result).toEqual({ width: 540, height: 1920 });
  });

  it('falls back to full canvas when pipEffective is undefined', () => {
    const result = resolvePipEffective(undefined, 1080, 1920);
    expect(result).toEqual({ width: 1080, height: 1920 });
  });
});

describe('pipEffective computation for each layout mode', () => {
  const canvas = { width: 1080, height: 1920 };

  it('pip layout — pipEffective equals full canvas (no split)', () => {
    // In pip mode, there is no split so the visual area is the full canvas
    const pipEff = resolvePipEffective(undefined, canvas.width, canvas.height);
    expect(pipEff).toEqual({ width: 1080, height: 1920 });
  });

  it('stacked — pipEffective is top half (full width, half height)', () => {
    const pipEff: VisualsDimensions = { width: 1080, height: 960 };
    const resolved = resolvePipEffective(pipEff, canvas.width, canvas.height);
    expect(resolved).toEqual({ width: 1080, height: 960 });
  });
});

describe('computeSceneEffectiveDimensions', () => {
  const canvasW = 1080;
  const canvasH = 1920;
  const pipEff: VisualsDimensions = { width: 1080, height: 960 };

  it('default scenes use pipEffective dimensions', () => {
    const result = computeSceneEffectiveDimensions('default', canvasW, canvasH, pipEff);
    expect(result.effectiveWidth).toBe(1080);
    expect(result.effectiveHeight).toBe(960);
    expect(result.displayMode).toBe('default');
  });

  it('fullscreen scenes use full canvas dimensions', () => {
    const result = computeSceneEffectiveDimensions('fullscreen', canvasW, canvasH, pipEff);
    expect(result.effectiveWidth).toBe(canvasW);
    expect(result.effectiveHeight).toBe(canvasH);
    expect(result.displayMode).toBe('fullscreen');
  });

  it('overlay scenes use full canvas dimensions', () => {
    const result = computeSceneEffectiveDimensions('overlay', canvasW, canvasH, pipEff);
    expect(result.effectiveWidth).toBe(canvasW);
    expect(result.effectiveHeight).toBe(canvasH);
    expect(result.displayMode).toBe('overlay');
  });

  it('missing displayMode defaults to default', () => {
    const result = computeSceneEffectiveDimensions(undefined, canvasW, canvasH, pipEff);
    expect(result.displayMode).toBe('default');
    expect(result.effectiveWidth).toBe(pipEff.width);
    expect(result.effectiveHeight).toBe(pipEff.height);
  });
});

describe('scene enrichment (enrichScenesWithDimensions)', () => {
  const canvasW = 1080;
  const canvasH = 1920;
  const pipEff: VisualsDimensions = { width: 540, height: 1920 };

  it('enriches default scenes with pipEffective dimensions', () => {
    const scenes = [{ id: 1, displayMode: 'default', title: 'Intro' }];
    const enriched = enrichScenesWithDimensions(scenes, canvasW, canvasH, pipEff);
    expect(enriched[0].effectiveDimensions).toEqual({ width: 540, height: 1920 });
  });

  it('enriches fullscreen scenes with full canvas dimensions', () => {
    const scenes = [{ id: 2, displayMode: 'fullscreen', title: 'Big Reveal' }];
    const enriched = enrichScenesWithDimensions(scenes, canvasW, canvasH, pipEff);
    expect(enriched[0].effectiveDimensions).toEqual({ width: 1080, height: 1920 });
  });

  it('enriches overlay scenes with full canvas dimensions', () => {
    const scenes = [{ id: 3, displayMode: 'overlay', title: 'Speaker Focus' }];
    const enriched = enrichScenesWithDimensions(scenes, canvasW, canvasH, pipEff);
    expect(enriched[0].effectiveDimensions).toEqual({ width: 1080, height: 1920 });
  });

  it('handles mixed displayModes correctly', () => {
    const scenes = [
      { id: 1, displayMode: 'default' },
      { id: 2, displayMode: 'fullscreen' },
      { id: 3, displayMode: 'overlay' },
      { id: 4, displayMode: 'default' },
    ];
    const enriched = enrichScenesWithDimensions(scenes, canvasW, canvasH, pipEff);

    expect(enriched[0].effectiveDimensions).toEqual({ width: 540, height: 1920 }); // default
    expect(enriched[1].effectiveDimensions).toEqual({ width: 1080, height: 1920 }); // fullscreen
    expect(enriched[2].effectiveDimensions).toEqual({ width: 1080, height: 1920 }); // overlay
    expect(enriched[3].effectiveDimensions).toEqual({ width: 540, height: 1920 }); // default
  });

  it('defaults missing displayMode to default', () => {
    const scenes = [{ id: 1, title: 'No displayMode set' }];
    const enriched = enrichScenesWithDimensions(scenes, canvasW, canvasH, pipEff);
    expect(enriched[0].effectiveDimensions).toEqual({ width: 540, height: 1920 });
  });

  it('missing pipEffective defaults to full canvas', () => {
    const fullCanvasPip = resolvePipEffective(undefined, canvasW, canvasH);
    const scenes = [{ id: 1, displayMode: 'default' }];
    const enriched = enrichScenesWithDimensions(scenes, canvasW, canvasH, fullCanvasPip);
    expect(enriched[0].effectiveDimensions).toEqual({ width: 1080, height: 1920 });
  });
});

describe('timeline item creation (effective dimensions per scene)', () => {
  const canvasW = 1080;
  const canvasH = 1920;

  function buildTimelineItemData(
    scene: { displayMode?: string; startMs: number; endMs: number; description?: string; transition?: unknown },
    pipEffective: VisualsDimensions,
  ) {
    const sceneDm = scene.displayMode || 'default';
    const sceneEffectiveW = (sceneDm === 'fullscreen' || sceneDm === 'overlay')
      ? canvasW : pipEffective.width;
    const sceneEffectiveH = (sceneDm === 'fullscreen' || sceneDm === 'overlay')
      ? canvasH : pipEffective.height;

    return {
      type: 'visual',
      startMs: scene.startMs,
      endMs: scene.endMs,
      data: {
        width: canvasW,
        height: canvasH,
        effectiveWidth: sceneEffectiveW,
        effectiveHeight: sceneEffectiveH,
        displayMode: sceneDm,
        transition: scene.transition || undefined,
        description: scene.description || 'AI-generated visual',
      },
    };
  }

  it('default scene in stacked layout stores correct effective dimensions', () => {
    const pipEff: VisualsDimensions = { width: 1080, height: 960 };
    const item = buildTimelineItemData(
      { displayMode: 'default', startMs: 0, endMs: 5000 },
      pipEff,
    );
    expect(item.data.effectiveWidth).toBe(1080);
    expect(item.data.effectiveHeight).toBe(960);
    expect(item.data.width).toBe(1080); // full canvas always stored
    expect(item.data.height).toBe(1920);
    expect(item.data.displayMode).toBe('default');
  });

  it('fullscreen scene always stores full canvas dimensions', () => {
    const pipEff: VisualsDimensions = { width: 1080, height: 960 };
    const item = buildTimelineItemData(
      { displayMode: 'fullscreen', startMs: 5000, endMs: 10000 },
      pipEff,
    );
    expect(item.data.effectiveWidth).toBe(1080);
    expect(item.data.effectiveHeight).toBe(1920);
    expect(item.data.displayMode).toBe('fullscreen');
  });

  it('overlay scene always stores full canvas dimensions', () => {
    const pipEff: VisualsDimensions = { width: 540, height: 1920 };
    const item = buildTimelineItemData(
      { displayMode: 'overlay', startMs: 10000, endMs: 15000 },
      pipEff,
    );
    expect(item.data.effectiveWidth).toBe(1080);
    expect(item.data.effectiveHeight).toBe(1920);
    expect(item.data.displayMode).toBe('overlay');
  });

  it('missing displayMode defaults to default with pipEffective', () => {
    const pipEff: VisualsDimensions = { width: 540, height: 1920 };
    const item = buildTimelineItemData(
      { startMs: 0, endMs: 3000 },
      pipEff,
    );
    expect(item.data.displayMode).toBe('default');
    expect(item.data.effectiveWidth).toBe(540);
    expect(item.data.effectiveHeight).toBe(1920);
  });

  it('preserves transition data in timeline item', () => {
    const pipEff: VisualsDimensions = { width: 1080, height: 960 };
    const transition = {
      enter: { type: 'fade', durationMs: 300 },
      exit: { type: 'cut', durationMs: 0 },
    };
    const item = buildTimelineItemData(
      { displayMode: 'default', startMs: 0, endMs: 5000, transition },
      pipEff,
    );
    expect(item.data.transition).toEqual(transition);
  });
});

describe('audio projects always use full canvas', () => {
  it('audio project (no pipEffective) defaults effective to full canvas for all modes', () => {
    const canvasW = 1080;
    const canvasH = 1920;
    // Audio projects never provide pipEffective
    const pipEff = resolvePipEffective(undefined, canvasW, canvasH);

    const pip = computeSceneEffectiveDimensions('default', canvasW, canvasH, pipEff);
    const fullscreen = computeSceneEffectiveDimensions('fullscreen', canvasW, canvasH, pipEff);
    const overlay = computeSceneEffectiveDimensions('overlay', canvasW, canvasH, pipEff);

    // All should be full canvas
    expect(pip.effectiveWidth).toBe(canvasW);
    expect(pip.effectiveHeight).toBe(canvasH);
    expect(fullscreen.effectiveWidth).toBe(canvasW);
    expect(fullscreen.effectiveHeight).toBe(canvasH);
    expect(overlay.effectiveWidth).toBe(canvasW);
    expect(overlay.effectiveHeight).toBe(canvasH);
  });
});

describe('edge cases', () => {
  it('zero-dimension pipEffective falls back correctly', () => {
    // The actual code would use || which treats 0 as falsy, so let's verify
    const pipEff: VisualsDimensions = { width: 0, height: 0 };
    // If someone provides {width: 0, height: 0}, resolvePipEffective still returns it
    // because the object itself is truthy
    const resolved = resolvePipEffective(pipEff, 1080, 1920);
    expect(resolved).toEqual({ width: 0, height: 0 });
  });

  it('very large canvas dimensions are handled', () => {
    const result = computeSceneEffectiveDimensions(
      'default', 3840, 2160, { width: 1920, height: 2160 },
    );
    expect(result.effectiveWidth).toBe(1920);
    expect(result.effectiveHeight).toBe(2160);
  });

  it('square canvas with split', () => {
    const canvasW = 1080;
    const canvasH = 1080;
    const pipEff: VisualsDimensions = { width: 540, height: 1080 };
    const result = computeSceneEffectiveDimensions('default', canvasW, canvasH, pipEff);
    expect(result.effectiveWidth).toBe(540);
    expect(result.effectiveHeight).toBe(1080);
  });
});
