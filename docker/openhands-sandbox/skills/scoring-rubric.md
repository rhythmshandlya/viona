# Visual Generation Scoring Rubric

**CRITICAL: Score ONLY on the criteria below. Do NOT invent new rules or deductions.**
- Do NOT deduct for "missing background motion" (not required)
- Do NOT require stagger > 12 frames (6-12 is correct)
- Do NOT require damping > 20 (15-25 is acceptable)
- ONLY deduct points for criteria explicitly listed below

Score the generated Remotion code on these criteria (25 points each, 100 total):

## 1. Correctness (25 points)

### TypeScript Validation (15 points)
- **15 points**: Zero TypeScript errors
- **10 points**: Only unused variable warnings (TS6133)
- **5 points**: Minor type errors that don't break rendering
- **0 points**: Critical type errors or missing imports

### Remotion Patterns (10 points)
- **10 points**: Uses useCurrentFrame, useVideoConfig, interpolate/spring correctly
- **5 points**: Minor pattern issues (e.g., missing extrapolateRight)
- **0 points**: Uses forbidden patterns (CSS transitions, setTimeout, useState for animation)

## 2. Completeness (25 points)

### File Structure (5 points)
- index.tsx exists with proper exports
- metadata.json with correct composition info
- constants.ts with color definitions

### Scene Coverage (10 points)
- All transcript segments have corresponding visuals
- Scene timing matches transcript timestamps
- No gaps in visual coverage

### Required Elements (10 points)
- All entities from concept_analysis are visualized
- All process animations are implemented
- Hero moments have special treatment

## 3. Visual Quality (25 points)

### Layout & Composition (5 points)
- **5 points**: No overlaps, proper spacing, subtitle zone respected
- **3 points**: Minor alignment issues
- **0 points**: Overlapping elements or content in safe zones

### Animation Quality (5 points)
- **5 points**: Smooth springs (damping ≥ 15), proper stagger (6+ frames), satisfying motion
- **3 points**: Animations work but feel mechanical
- **0 points**: No animations or jarring motion

**Stagger Rules (for reference):**
- Minimum stagger: 6 frames between sequential elements
- Acceptable: `index * 6` to `index * 12`
- Do NOT penalize stagger of 6-12 frames - this is correct

**Spring Damping Rules:**
- Minimum damping: 15 (values 15-25 are all acceptable)
- Do NOT penalize damping of 15-25 - this is premium motion

### Plan Compliance - build_sequence (10 points) **CRITICAL**

If a Visual Plan was provided, verify EACH build_sequence item is implemented:

For each `build_sequence` item in each scene:
- [ ] Component exists for the specified `element`
- [ ] The `technique` is properly implemented (not basic fade/opacity)
- [ ] The `at_frame` timing is respected (+/- 5 frames)
- [ ] Any `effects` listed are present in the code

**Technique Implementation Verification:**
| Plan Technique | Required Code Patterns |
|----------------|----------------------|
| `particle-emitter` | Physics (velocity, gravity), Array.from, particles.map |
| `mask-reveal` | clipPath or clip-path, animated radius/inset |
| `cell-division-animation` | Array.from with count, spring-based positioning |
| `drop-with-gravity` | Quadratic easing (t*t) or gravity calculation |
| `glass-shimmer` | Animated gradient, shimmer translate |
| `3d-rotation` | perspective, rotateX/Y, preserve-3d |
| `fade-in-blur` | filter: blur() with interpolation |
| `draw-stroke` | SVG strokeDasharray, strokeDashoffset |
| `scale-spring` | spring() with scale transform |
| `fill-animation` | scaleX/scaleY with interpolate |

Scoring:
- **10 points**: 90%+ of build_sequence items implemented with correct techniques
- **7 points**: 70-89% implemented correctly
- **4 points**: 50-69% implemented
- **0 points**: <50% implemented OR techniques replaced with basic opacity fades

### Plan Compliance - hero_moments (5 points) **CRITICAL**

For EACH `hero_moment` in the Visual Plan:
- [ ] Has visual emphasis (glow/drop-shadow, scale boost 1.1+, or particles)
- [ ] Frame timing matches the specified `frame_range`
- [ ] The `treatment` description is implemented (e.g., "slow zoom" = scale interpolation)

Scoring:
- **5 points**: All hero moments have proper visual emphasis
- **3 points**: Most hero moments implemented with some emphasis
- **0 points**: Hero moments use same animation as regular elements (no distinction)

## 4. Code Quality (25 points)

### Responsive Sizing (10 points)
- **10 points**: All sizes use percentages (width/height/minDim)
- **5 points**: Mostly responsive with a few hardcoded values
- **0 points**: Hardcoded pixel values throughout

### Code Organization (10 points)
- Reusable components for repeated elements
- Constants properly defined
- Clean, readable code structure

### React Best Practices (5 points)
- All .map() calls have key props
- No inline object creation in render
- Proper component structure

## Scoring Output Format

After evaluation, output ONLY this JSON:

```json
{
  "score": <0-100>,
  "breakdown": {
    "correctness": <0-25>,
    "completeness": <0-25>,
    "visualQuality": <0-25>,
    "codeQuality": <0-25>
  },
  "issues": [
    "Specific issue 1",
    "Specific issue 2"
  ],
  "suggestion": "Actionable fix instructions"
}
```

## Pass Threshold

- **90+**: Excellent - Ready for production
- **70-89**: Good - Minor issues to fix
- **50-69**: Needs work - Several issues
- **<50**: Significant problems - Major revision needed

Default quality threshold is 70. Code scoring below this will trigger another iteration with feedback.

## Automatic Deductions (Plan Violations)

These deductions apply REGARDLESS of other scores when a Visual Plan exists:

| Violation | Deduction |
|-----------|-----------|
| Plan specifies `particle-emitter` but code uses static divs | -5 points |
| Plan specifies `mask-reveal` but code uses basic opacity fade | -5 points |
| Plan specifies physics (`gravity`, `bounce`, `drop-with-gravity`) but code uses linear interpolation only | -5 points |
| Plan specifies `cell-division` but elements just appear without splitting animation | -5 points |
| Hero moment has NO visual distinction (no glow, no scale boost, no emphasis) | -3 points each |
| Plan specifies `glass-shimmer` but component is plain div | -3 points |
| Generated code is under 300 lines for 4+ scenes (too minimal) | -10 points |

## Code Volume Guidelines

For plans with multiple scenes, expect substantial code:

| Scenes | Minimum Expected Lines | Indicates |
|--------|----------------------|-----------|
| 2-3 | 200+ lines | Basic implementation |
| 4-5 | 350+ lines | Moderate complexity |
| 6+ | 450+ lines | Full implementation |

If code is significantly below these thresholds, animations are likely oversimplified.
