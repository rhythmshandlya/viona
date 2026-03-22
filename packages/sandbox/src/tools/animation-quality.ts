import { readFile } from 'fs/promises';

interface AnimationQualityWarning {
  check: 'frame_coverage' | 'property_variety' | 'idle_amplitude' | 'surface_treatment';
  message: string;
  severity: 'warning' | 'error';
}

interface AnimationQualityResult {
  passed: boolean;
  warnings: AnimationQualityWarning[];
}

/**
 * Check a) — Frame coverage.
 * Extract interpolate(frame, [A, B], ...) patterns. Compute union of active ranges.
 * If union < 50% of totalFrames, warn.
 */
function checkFrameCoverage(source: string, totalFrames: number): AnimationQualityWarning | null {
  // Match interpolate(frame, [A, B], ...) or interpolate(frame,[A,B],...)
  const interpolateRe = /interpolate\(\s*(?:frame|f)\s*,\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]/g;
  const ranges: [number, number][] = [];
  let match: RegExpExecArray | null;

  while ((match = interpolateRe.exec(source)) !== null) {
    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);
    if (isNaN(start) || isNaN(end) || start >= end) continue;

    // Skip idle patterns — look backwards ~80 chars for Math.sin
    const contextStart = Math.max(0, match.index - 80);
    const context = source.slice(contextStart, match.index);
    if (/Math\.sin/.test(context)) continue;

    ranges.push([start, end]);
  }

  if (ranges.length === 0) {
    return {
      check: 'frame_coverage',
      message: `No interpolate(frame, ...) calls found — scene may have no animation.`,
      severity: 'error',
    };
  }

  // Compute union of ranges
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    if (ranges[i][0] <= last[1]) {
      last[1] = Math.max(last[1], ranges[i][1]);
    } else {
      merged.push(ranges[i]);
    }
  }

  const covered = merged.reduce((sum, [a, b]) => sum + (b - a), 0);
  const ratio = covered / totalFrames;

  if (ratio < 0.5) {
    return {
      check: 'frame_coverage',
      message: `Animation covers only ${Math.round(ratio * 100)}% of ${totalFrames} frames. Scenes need mid-duration events (Build/Develop phases), not just Entrance + Exit.`,
      severity: 'warning',
    };
  }

  return null;
}

/**
 * Check b) — Property variety.
 * Count distinct CSS properties being animated.
 */
function checkPropertyVariety(source: string): AnimationQualityWarning | null {
  const propertyPatterns: [string, RegExp][] = [
    ['opacity', /opacity/i],
    ['translateX', /translateX/i],
    ['translateY', /translateY/i],
    ['scale', /scale[^A-Z]/i],
    ['rotate', /rotate/i],
    ['width', /width[^s]/i],
    ['height', /height[^s]/i],
    ['strokeDashoffset', /strokeDashoffset/i],
    ['fill/stroke/color', /(?:fill|stroke|color)\s*[=:]/i],
    ['borderRadius', /borderRadius/i],
    ['clipPath', /clipPath/i],
    ['boxShadow', /boxShadow/i],
    ['fontSize', /fontSize.*interpolate|interpolate.*fontSize/i],
    ['letterSpacing', /letterSpacing.*interpolate|interpolate.*letterSpacing/i],
  ];

  // Count properties that appear in the source — heuristic: most property mentions in Remotion scenes are animated
  const animatedProps = new Set<string>();
  for (const [name, re] of propertyPatterns) {
    if (re.test(source)) {
      animatedProps.add(name);
    }
  }

  if (animatedProps.size < 4) {
    return {
      check: 'property_variety',
      message: `Only ${animatedProps.size} animated properties found (${[...animatedProps].join(', ')}). Scenes need at least 4 distinct animated properties for visual richness.`,
      severity: 'warning',
    };
  }

  return null;
}

/**
 * Check c) — Idle amplitude.
 * Match Math.sin(...) * N patterns. Flag if N is below minimums.
 */
function checkIdleAmplitude(source: string): AnimationQualityWarning | null {
  const sinRe = /Math\.sin\([^)]*\)\s*\*\s*([\d.]+)/g;
  const violations: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = sinRe.exec(source)) !== null) {
    const amplitude = parseFloat(match[1]);
    if (isNaN(amplitude)) continue;

    // Look at surrounding context to determine property type
    const contextStart = Math.max(0, match.index - 120);
    const contextEnd = Math.min(source.length, match.index + match[0].length + 80);
    const context = source.slice(contextStart, contextEnd).toLowerCase();

    if (context.includes('scale') || context.includes('breathe')) {
      if (amplitude < 0.02) {
        violations.push(`scale amplitude ${amplitude} < 0.025 minimum`);
      }
    } else if (context.includes('translate') || context.includes('float') || context.includes('drift')) {
      if (amplitude < 4) {
        violations.push(`translate amplitude ${amplitude}px < 5px minimum`);
      }
    } else if (context.includes('rotate') || context.includes('tilt')) {
      if (amplitude < 1.5) {
        violations.push(`rotation amplitude ${amplitude}° < 2° minimum`);
      }
    }
  }

  if (violations.length > 0) {
    return {
      check: 'idle_amplitude',
      message: `Idle motion below perceptible minimum: ${violations.join('; ')}. Increase amplitudes so viewers can actually see the motion.`,
      severity: 'warning',
    };
  }

  return null;
}

/**
 * Check d) — Surface treatment.
 * Flag flat rgba/rgb backgrounds without gradients or filters.
 */
function checkSurfaceTreatment(source: string): AnimationQualityWarning | null {
  // Match background: 'rgba(...)' or backgroundColor: 'rgba(...)' that are NOT gradient
  const bgRe = /(?:background|backgroundColor)\s*:\s*['"`](rgba?\([^)]+\))['"`]/g;
  const flatSurfaces: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = bgRe.exec(source)) !== null) {
    const value = match[1];
    // Check surrounding context for gradient, url, filter usage
    const contextStart = Math.max(0, match.index - 200);
    const contextEnd = Math.min(source.length, match.index + 200);
    const context = source.slice(contextStart, contextEnd);

    // Skip if it's inside a gradient or has filter nearby
    if (/gradient|url\(|filter|opacity:\s*0\.[01]/i.test(context)) continue;

    // Skip decorative elements (very small or low opacity)
    if (/opacity.*0\.[01]\d/i.test(context)) continue;

    flatSurfaces.push(value);
  }

  if (flatSurfaces.length > 0) {
    return {
      check: 'surface_treatment',
      message: `${flatSurfaces.length} flat surface(s) found (plain rgba without gradient/filter). Surfaces need at least 2 animated treatments: gradient shift, depth shadow, shimmer, or blur.`,
      severity: 'warning',
    };
  }

  return null;
}

export function validateAnimationQuality(source: string, totalFrames: number): AnimationQualityResult {
  const warnings: AnimationQualityWarning[] = [];

  const frameCoverage = checkFrameCoverage(source, totalFrames);
  if (frameCoverage) warnings.push(frameCoverage);

  const propertyVariety = checkPropertyVariety(source);
  if (propertyVariety) warnings.push(propertyVariety);

  const idleAmplitude = checkIdleAmplitude(source);
  if (idleAmplitude) warnings.push(idleAmplitude);

  const surfaceTreatment = checkSurfaceTreatment(source);
  if (surfaceTreatment) warnings.push(surfaceTreatment);

  return {
    passed: warnings.length === 0,
    warnings,
  };
}

export const validateAnimationQualityTool = {
  name: 'validate_animation_quality',
  description:
    'Validate a scene file for animation quality: checks frame coverage (>50%), ' +
    'property variety (>=4 animated properties), idle amplitude (above perceptible minimums), ' +
    'and surface treatment (no flat rgba backgrounds). Returns structured warnings.',
  input_schema: {
    type: 'object' as const,
    properties: {
      sceneFile: {
        type: 'string' as const,
        description: 'Path to the .tsx scene file (relative to /workspace or absolute)',
      },
      totalFrames: {
        type: 'number' as const,
        description: 'Total frames in the scene (from SCENE_PLAN.md time range and fps)',
      },
    },
    required: ['sceneFile', 'totalFrames'],
  },
  async execute(input: { sceneFile?: string; totalFrames?: number }): Promise<string> {
    try {
      const sceneFile = input.sceneFile ?? '';
      const totalFrames = input.totalFrames ?? 0;

      if (!sceneFile) return JSON.stringify({ passed: false, warnings: [{ check: 'frame_coverage', message: 'No sceneFile provided', severity: 'error' }] });
      if (totalFrames <= 0) return JSON.stringify({ passed: false, warnings: [{ check: 'frame_coverage', message: 'totalFrames must be > 0', severity: 'error' }] });

      // Resolve path — support both /workspace relative and absolute
      const filePath = sceneFile.startsWith('/') ? sceneFile : `/workspace/${sceneFile}`;
      const source = await readFile(filePath, 'utf-8');
      const result = validateAnimationQuality(source, totalFrames);
      return JSON.stringify(result, null, 2);
    } catch (err: any) {
      return JSON.stringify({
        passed: false,
        warnings: [{ check: 'frame_coverage', message: `Failed to validate: ${err.message}`, severity: 'error' }],
      });
    }
  },
};
