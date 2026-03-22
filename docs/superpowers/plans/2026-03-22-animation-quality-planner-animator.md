# Animation Quality: Planner + Animator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise animation quality from "PowerPoint with springs" to professional motion design by fixing both the planning (structured timelines, creative concepts) and execution (craft techniques, enforced minimums, programmatic validation).

**Architecture:** Six changes across 6 files — all in `packages/sandbox/`. Planner prompt gets structured Animation Timeline + creative guidance. Animator prompt gets concrete technique patterns + raised idle minimums. New validation MCP tool catches quality violations. Orchestrator calls validation after each Animator.

**Tech Stack:** Markdown prompts, TypeScript (MCP tool), regex-based code analysis, Claude Agent SDK tool pattern.

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `packages/sandbox/src/prompts/planner/system.md` | Replace Animation Brief with Visual Concept + Animation Timeline; add creative guidance; add checklist items |
| Rewrite | `packages/sandbox/src/prompts/planner/examples/good-plan.md` | Full replacement with phased timelines and creative concepts |
| Modify | `packages/sandbox/src/prompts/animator/system.md` | Add Techniques for Visual Richness section; raise idle minimums |
| Create | `packages/sandbox/src/tools/animation-quality.ts` | New `validate_animation_quality` MCP tool with 4 regex checks |
| Modify | `packages/sandbox/src/mcp-servers.ts` | Register the new tool on the `analysis` server |
| Modify | `packages/sandbox/src/prompts/orchestrator/system.md` | Add validation step after each Animator in Phase 6 |

---

### Task 1: Replace Animation Brief with Visual Concept + Animation Timeline in Planner

> **Note:** Tasks 1-3 all modify `planner/system.md` sequentially. Line numbers below reference the **unmodified** file. After each task, line numbers shift. Find content by **text match**, not line number.

**Files:**
- Modify: `packages/sandbox/src/prompts/planner/system.md:90-127` (the `<per_scene_schema>` section)

- [ ] **Step 1: Replace the Animation brief block in `<per_scene_schema>`**

In `packages/sandbox/src/prompts/planner/system.md`, find lines 123-127 (the `### Animation brief` block inside the per-scene schema code fence):

```markdown
### Animation brief
- Description: [detailed visual description for the Animator — what elements appear, how they animate, timing, spatial arrangement]
- Key data: [exact items/numbers/terms extracted from the transcript]
- Must show: [what MUST appear on screen — verbatim from the transcript]
```

Replace with:

```markdown
### Visual concept
[1-2 sentences: the creative idea — a metaphor, visual relationship, or motion concept. NOT a layout description.]

### Key data
[exact items/numbers/terms extracted from the transcript]

### Must show
[verbatim text/numbers that must appear on screen]

### Animation timeline
| Phase | Frames | What happens |
|-------|--------|-------------|
| Entrance | 0–F1 | [what enters, how, from where] |
| Build | F1–F2 | [what develops, transforms, reveals] |
| Develop | F2–F3 | [how the visual evolves mid-scene] |
| Payoff | F3–F4 | [emphasis, reveal, climax] |
| Exit | F4–end | [how it departs] |
```

- [ ] **Step 2: Add Animation Timeline rules after the schema code fence**

After the closing ` ``` ` of the per-scene schema (around line 127), and before the Overlay Placement Presets table, add:

```markdown
### Animation Timeline Rules
1. Every scene MUST have 3-5 phases covering the full frame range
2. **Build** and **Develop** phases are MANDATORY — they fill the middle 60-70% that's currently dead
3. No phase may span more than 40% of the scene duration without at least 2 distinct visual events inside it
4. Elements must CHANGE during the scene (morph shape, shift color, rearrange position, reveal new content) — not just enter and sit
5. At least one element must do something other than enter/idle/exit — it must transform, react, or evolve mid-scene
```

- [ ] **Step 3: Verify the file is well-formed markdown**

Read back lines 90-155 of the modified file to confirm the schema and rules are correctly placed, the code fence is properly closed, and the Overlay Placement Presets section follows unbroken.

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/prompts/planner/system.md
git commit -m "feat(sandbox): replace Animation Brief with Visual Concept + Animation Timeline in planner schema"
```

---

### Task 2: Add Creative Ambition Guidance and Anti-Patterns to Planner

**Files:**
- Modify: `packages/sandbox/src/prompts/planner/system.md` — insert new section after `</per_scene_schema>` and before `<plan_structure>`

- [ ] **Step 1: Add creative ambition guidance section**

After the `</per_scene_schema>` closing tag (line 145) and before `<plan_structure>` (line 147), insert a new XML section:

```markdown
<creative_ambition>
## Visual Concept Guidance

**Visual concept** is NOT a layout description. It's the creative idea. Ask yourself: "If I described this scene to a motion designer, what would make them excited to build it?" A comparison doesn't have to be two columns. It could be a scale/balance that tips, a thermometer that splits into two paths, elements that transform from one state to another. Think in metaphors and motion, not in grids.

### AVOID these generic concepts:
- "Two-column layout with X on left and Y on right" — that's a layout, not a concept
- "Three connected nodes with arrows" — that's a flowchart diagram, think of something more visual
- "Progress ring that fills to N%" — only use if the content is literally about a single percentage
- "Glass card with text inside" — that's a container, not a concept

### Instead, think about:
- What RELATIONSHIP between ideas does this scene show? (contrast, growth, collapse, transformation, sequence)
- What MOTION tells that story? (something rising vs falling, expanding vs contracting, connecting vs separating)
- What makes the viewer WATCH for the full duration? (progressive reveal, building tension, visual surprise)
</creative_ambition>
```

- [ ] **Step 2: Read back the area around the insertion to verify**

Read lines 145-175 of the file to confirm the new section sits cleanly between `</per_scene_schema>` and `<plan_structure>`.

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/planner/system.md
git commit -m "feat(sandbox): add creative ambition guidance and anti-patterns to planner prompt"
```

---

### Task 3: Add Self-Verification Checklist Items to Planner

**Files:**
- Modify: `packages/sandbox/src/prompts/planner/system.md:167-185` (the self-verification checklist in `<plan_structure>`)

- [ ] **Step 1: Add 4 new checklist items**

Find the last checklist item (line 184):
```markdown
- [ ] **No two adjacent scenes share the same scene type** — vary the visual approach between consecutive scenes
```

After it, add these 4 items:

```markdown
- [ ] Every scene has an **Animation timeline** table with 3-5 phases
- [ ] Every scene has a **Build** and **Develop** phase (not just Entrance + Exit)
- [ ] No single phase spans more than 40% of the scene's total frame count
- [ ] Every **Visual concept** describes a creative idea, not a layout ("two-column", "three cards")
```

- [ ] **Step 2: Read back the checklist to verify all 20 items**

Read lines 167-192 of the file to confirm the checklist now has 20 items total (16 original + 4 new).

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/planner/system.md
git commit -m "feat(sandbox): add animation timeline checklist items to planner self-verification"
```

---

### Task 4: Rewrite the Example Plan

**Files:**
- Rewrite: `packages/sandbox/src/prompts/planner/examples/good-plan.md`

- [ ] **Step 1: Write the new example plan**

Replace the entire file content. The new example must demonstrate:
- 6 scenes with phased Animation Timelines (every scene has 3-5 phases, Build + Develop mandatory)
- Creative Visual Concepts (no "glass card", "three nodes with arrows", "progress ring" patterns)
- At least one each of Overlay, Stacked, Fullscreen display modes
- At least 4 different scene types (including `custom`, `data-viz`, `flowchart`, `cause-effect` — avoid `step-cards` dominance)
- Mid-scene transformations in every Build/Develop phase
- The complete 20-item self-verification checklist (16 original + 4 new)

The example topic should be different from "communication tips" to provide variety. Use a topic like "why most people fail at fitness" or similar — enough concrete data points for data-viz and comparison scenes.

Structure each scene with:
```markdown
## Scene N: [Title]
**File:** Scene{N}.tsx
**Time:** startMs – endMs
**Transcript:** "[verbatim]"
**Display mode:** ...
**Scene type:** ...
**Layout pattern:** ...

### Speaker layout
### Scene dimensions
### Scene placement
### Transition IN
### Transition OUT

### Visual concept
[Creative metaphor, NOT a layout description]

### Key data
### Must show

### Animation timeline
| Phase | Frames | What happens |
|-------|--------|-------------|
| Entrance | ... | ... |
| Build | ... | ... |
| Develop | ... | ... |
| Payoff | ... | ... |
| Exit | ... | ... |
```

Keep the `<example>` wrapper tags. Include Global section, Punch-in locations, and full self-verification checklist.

- [ ] **Step 2: Verify the example has no anti-patterns**

Check that:
- No scene uses "glass card", "frosted glass", "three connected nodes" in its Visual concept
- Every Animation timeline has Build + Develop phases
- No two adjacent scenes share the same layout pattern or scene type
- At most 1 scene uses `step-cards` (30% budget with 6 scenes)
- At least 3 different scene types are used

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/planner/examples/good-plan.md
git commit -m "feat(sandbox): rewrite planner example plan with phased timelines and creative concepts"
```

---

### Task 5: Add Techniques for Visual Richness to Animator

**Files:**
- Modify: `packages/sandbox/src/prompts/animator/system.md` — add new section after line 127 (after `## Thoughtful Exits` / before `## Scene Type Visual Approaches`)

- [ ] **Step 1: Add the Techniques for Visual Richness section**

After the "Thoughtful Exits" section (ends around line 127, before `---` and `## Scene Type Visual Approaches`), insert:

````markdown
### 7. Techniques for Visual Richness

These are concrete React/SVG/CSS patterns you can apply from scratch in any scene. Use them to create texture, depth, and cinematic feel — not just spring-animated rectangles.

**Texture & grain (SVG filters):**
```tsx
// Creates subtle noise texture overlay — add to background layer
<svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
  <filter id="grain">
    <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves={4} />
    <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.08 0" />
  </filter>
  <rect width="100%" height="100%" filter="url(#grain)" />
</svg>
```

**Organic shapes (generated clip-path):**
```tsx
// Irregular edge — generate polygon points with controlled randomness
// Uses Remotion's deterministic random(): import { random } from 'remotion';
const points = Array.from({length: 20}, (_, i) => {
  const angle = (i / 20) * Math.PI * 2;
  const r = baseRadius + random(`edge-${i}`) * variance;
  return `${50 + Math.cos(angle) * r}% ${50 + Math.sin(angle) * r}%`;
});
style={{ clipPath: `polygon(${points.join(', ')})` }}
```

**Depth via multi-layer shadows:**
```tsx
// Animated depth — shadow grows as element enters
const shadowDepth = interpolate(frame, [enter, enter+15], [0, 1], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
});
boxShadow: `0 ${2*shadowDepth}px ${8*shadowDepth}px rgba(0,0,0,0.15),
            0 ${8*shadowDepth}px ${32*shadowDepth}px rgba(0,0,0,0.25)`
```

**Cinematic zoom-to-focus:**
```tsx
// Camera push: scale up while fading surroundings
const zoom = interpolate(frame, [start, end], [1, 2.5], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
});
const surroundFade = interpolate(frame, [start, end-5], [1, 0], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
});
// Apply zoom to container, surroundFade to non-focal elements
```

**SVG path drawing:**
```tsx
// Animated path that draws itself
const pathLength = 500; // measure or estimate
const draw = interpolate(frame, [start, end], [pathLength, 0], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
});
<path d="..." strokeDasharray={pathLength} strokeDashoffset={draw} />
// Add glow duplicate underneath:
<path d="..." strokeDasharray={pathLength} strokeDashoffset={draw}
      stroke={color} strokeWidth={6} opacity={0.3} filter="url(#blur)" />
```

**Perspective for 3D feel:**
```tsx
// Container with perspective — child rotates in 3D space
<div style={{ perspective: 1200 }}>
  <div style={{ transform: `rotateX(${rx}deg) rotateY(${ry}deg)` }}>
    {content}
  </div>
</div>
```

**Gradient animation:**
```tsx
// Animated gradient angle for living surfaces
const angle = 135 + Math.sin(frame * 0.02) * 15;
background: `linear-gradient(${angle}deg, color1, color2, color3)`
```

**Typography hierarchy:**
```tsx
// Hero number: tight tracking, heavy weight, multi-layer shadow
{ fontSize: SCENE_HEIGHT * 0.15, fontWeight: 800, letterSpacing: '-0.03em',
  textShadow: '0 2px 8px rgba(0,0,0,0.4), 0 0 40px rgba(accent, 0.3)' }
// Supporting label: wide tracking, lighter weight
{ fontSize: SCENE_HEIGHT * 0.04, fontWeight: 500, letterSpacing: '0.08em',
  textTransform: 'uppercase' }
```
````

- [ ] **Step 2: Read back the inserted section to verify code fences are balanced**

Read lines 126-220 of the modified file. Confirm all code fences (```) are opened and closed, and the section flows into `## Scene Type Visual Approaches`.

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/animator/system.md
git commit -m "feat(sandbox): add Techniques for Visual Richness section to animator prompt"
```

---

### Task 6: Raise Idle Animation Minimums in Animator

**Files:**
- Modify: `packages/sandbox/src/prompts/animator/system.md:69-77` (the idle motion examples in section 2)

- [ ] **Step 1: Replace the idle motion example values**

Find lines 72-75 (the idle motion examples):

```markdown
- **Float:** `translateY(Math.sin(frame * 0.03) * 3)` — gentle vertical bob
- **Breathe:** `scale(1 + Math.sin(frame * 0.025) * 0.015)` — subtle pulse
- **Rotate drift:** `rotate(Math.sin(frame * 0.02) * 1.5)` — barely perceptible tilt
- **Glow pulse:** oscillating box-shadow opacity or border brightness
```

Replace with:

```markdown
- **Float:** `translateY(Math.sin(frame * 0.03) * 5)` — visible vertical bob (5px minimum)
- **Breathe:** `scale(1 + Math.sin(frame * 0.025) * 0.025)` — visible pulse (2.5% minimum)
- **Rotate drift:** `rotate(Math.sin(frame * 0.02) * 2)` — perceptible tilt (2° minimum)
- **Glow pulse:** `opacity: 0.3 + Math.sin(frame * 0.04) * 0.15` — visible glow range (0.15-0.45)

**Minimum amplitudes (below these = viewer cannot perceive it):**
- Scale: `* 0.025` | Translate: `* 5` | Rotation: `* 2` | Glow: base `0.3`, amplitude `0.15`
```

- [ ] **Step 2: Read back lines 69-82 to verify the replacement**

Confirm the old values are gone and the new values + minimum amplitudes callout are in place.

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/animator/system.md
git commit -m "feat(sandbox): raise idle animation minimums in animator prompt"
```

---

### Task 7: Create `validate_animation_quality` MCP Tool

**Files:**
- Create: `packages/sandbox/src/tools/animation-quality.ts`
- Modify: `packages/sandbox/src/mcp-servers.ts:7-8` (add import) and line 181 (register tool)

- [ ] **Step 1: Create the animation quality validation tool**

Create `packages/sandbox/src/tools/animation-quality.ts` with the following:

```typescript
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
```

- [ ] **Step 2: Register the tool in the analysis MCP server**

In `packages/sandbox/src/mcp-servers.ts`, add import at line 8 (after `validateTimelineTool` import):

```typescript
import { validateAnimationQualityTool } from './tools/animation-quality.js';
```

Then find line 181:
```typescript
    tools: [wrapTool(analyzeTranscriptTool), wrapTool(validateTimelineTool)],
```

Replace with:
```typescript
    tools: [wrapTool(analyzeTranscriptTool), wrapTool(validateTimelineTool), wrapTool(validateAnimationQualityTool)],
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/sandbox && npx tsc --noEmit --pretty false 2>&1 | head -20`
Expected: No errors from `animation-quality.ts` or `mcp-servers.ts`

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/tools/animation-quality.ts packages/sandbox/src/mcp-servers.ts
git commit -m "feat(sandbox): add validate_animation_quality MCP tool with 4 regex checks"
```

---

### Task 8: Update Orchestrator to Call Validation After Animators

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator/system.md:120-138` (Phase 6 section)

- [ ] **Step 1: Add validation step to Phase 6**

Find the end of Phase 6 (around line 138, after the "Update plan after EACH animator returns" paragraph). After the progress line:

```markdown
Progress after each scene: `{ phase: "generating", message: "Scene N of M: <name>" }`
```

Add:

```markdown

**Quality validation after each Animator:**
After each Animator completes and the scene file is written, call `mcp__analysis__validate_animation_quality` with the scene file path and frame count (derive from scene duration and fps). If the result contains warnings:
1. Re-dispatch the Animator for that scene with the specific warnings as fix instructions (e.g., "Frame coverage is 35% — add Build/Develop phase animations between frames 40-200")
2. Maximum 1 quality fix round per scene — if the second attempt still has warnings, accept it and move on
3. Update the plan subtask status to reflect the validation pass/fail
```

- [ ] **Step 2: Read back Phase 6 to verify the addition**

Read lines 120-150 of the file to confirm the validation step is cleanly placed after the existing Phase 6 content and before Phase 7.

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/orchestrator/system.md
git commit -m "feat(sandbox): add post-animator quality validation step to orchestrator Phase 6"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Verify all modified files are syntactically correct markdown**

Read the first 30 lines and last 30 lines of each modified prompt file to ensure no broken XML tags or unclosed code fences:
- `packages/sandbox/src/prompts/planner/system.md`
- `packages/sandbox/src/prompts/animator/system.md`
- `packages/sandbox/src/prompts/orchestrator/system.md`
- `packages/sandbox/src/prompts/planner/examples/good-plan.md`

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/sandbox && npx tsc --noEmit --pretty false 2>&1 | head -20`
Expected: Clean compile

- [ ] **Step 3: Verify all 5 files are tracked in git**

Run: `git diff --stat HEAD`
Should show changes in:
- `packages/sandbox/src/prompts/planner/system.md`
- `packages/sandbox/src/prompts/planner/examples/good-plan.md`
- `packages/sandbox/src/prompts/animator/system.md`
- `packages/sandbox/src/prompts/orchestrator/system.md`
- `packages/sandbox/src/tools/animation-quality.ts` (new)
- `packages/sandbox/src/mcp-servers.ts`
