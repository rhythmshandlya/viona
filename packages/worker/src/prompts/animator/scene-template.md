You are implementing Scene {scene_number} of a Remotion animation.

## YOUR SINGLE TASK
Implement ONLY `scenes/Scene{scene_number}.tsx` based on the plan and scene data provided.

## CRITICAL FRAME TIMING RULE
This scene component renders inside `<Sequence from={{sceneStart}}>`.
Remotion's `useCurrentFrame()` ALREADY returns 0-relative frames inside the Sequence.
**DO NOT subtract the scene's global start frame — this causes BLANK scenes!**

```tsx
// ❌ WRONG (causes ALL elements to be invisible):
const localFrame = frame - TIMING.scene{scene_number}Start;

// ✅ CORRECT:
const frame = useCurrentFrame(); // Already 0, 1, 2, ... relative to scene start
const keySyncProgress = spring({{ frame: frame - TIMING.scene{scene_number}KeySync, fps, config: SPRING_CONFIG }});
```

All TIMING sync values are pre-computed as LOCAL offsets. Use `frame` directly.

## DISPLAY MODE RULES
{display_mode_rules}

## SPEAKER GRID (overlay scenes only)
If your scene data includes a `speakerGrid` object, use it to verify placement:
- `speakerGrid.occupancy` — percentage of canvas occupied by speaker
- `speakerGrid.safePlacement` — array of safe zone names (e.g., "bottom", "top", "bottom-left")
- Place ALL elements in listed safe zones
- If occupancy is very low (<10%), the speaker may not be consistently on screen — still use standard overlay zones (top strip / lower-third)

## MANDATORY WORKFLOW — FOLLOW IN ORDER

### Step 1: READ (before any code)
- Read `constants.ts` to understand available TIMING values and colors
- Read `SCENE_PLAN.md` for narrative context
- Read the scene data JSON below for sync points and visual description

### Step 2: PLAN (write reasoning to IMPLEMENTATION_LOG.md)
Before writing ANY code, append your scene plan to IMPLEMENTATION_LOG.md:
```markdown
## Scene {scene_number} Plan

### Content (what the viewer needs to understand):
- Key message: [the main point from the transcript]
- Key sync word: [word] at local frame [N]

### Visual Layer Hierarchy:
- Layer 1 (Primary): [text/data content that EXPLAINS the transcript]
- Layer 2 (Supporting): [visual metaphors — icons with labels, diagrams, flow arrows]
- Layer 3 (Ambient): [atmospheric depth — gradient drift, glow pulse, grid shift at opacity ≤ 0.15]
- Attention-grabbing count (Layer 1+2): [≤ 4?]

### Layout (3 zones):
- TOP: [title text — what text, what animation]
- MIDDLE: [primary content — card/diagram/counter]
- BOTTOM: [supporting text or empty]

### Timing:
- Frames 0-[keySync]: [what builds up as anticipation]
- Frame [keySync]: [main visual event triggers]
- Frames [keySync]-end: [what appears after]

### Transcript Coverage Check (CRITICAL):
- Full transcript for this scene: "[paste narration text]"
- Phrase-by-phrase visual mapping:
  1. "[phrase 1]" → [visual treatment]
  2. "[phrase 2]" → [visual treatment]
  3. "[phrase 3]" → [visual treatment]
- Any uncovered phrases? → Add visuals for them
- Visual beat count: [N] beats across [M] frames
```

### Step 3: IMPLEMENT (write the scene file)
- Create the file `scenes/Scene{scene_number}.tsx` using the Write tool
- **CRITICAL**: You MUST create this file. If you finish without writing `scenes/Scene{scene_number}.tsx`, your task has FAILED.
- Do NOT modify constants.ts, components/*, other scene files, or index.tsx
- Export the component as: `export const Scene{scene_number}: React.FC`
- Import from '../constants': `SPRINGS`, `STAGGER`, `COLORS` (use `SPRINGS.SMOOTH` for default, `SPRINGS.SNAPPY` for hero reveals)
- For non-overlay scenes: Import `Background` from '../components/Background'
- For overlay scenes: DO NOT import Background — overlay uses transparent canvas (see display mode rules above)
- **EVERY interpolate() call MUST include BOTH `extrapolateLeft: 'clamp'` AND `extrapolateRight: 'clamp'`** — no exceptions

### Step 4: VERIFY (check against the checklist below)

## SCENE IMPLEMENTATION CHECKLIST
After writing the scene, verify:
- [ ] **File exists**: `scenes/Scene{scene_number}.tsx` was created (not just edited into another file)
- [ ] **NO scene start subtraction** — `useCurrentFrame()` used directly (NOT `frame - TIMING.sceneNStart`)
- [ ] Key sync triggers at the correct local frame offset (absolute frame - scene start frame)
- [ ] Additional syncPoints trigger at their correct local frames
- [ ] Has overflow: 'hidden' clipping container
- [ ] Elements staggered by 6+ frames using `STAGGER.NORMAL` (not all at once)
- [ ] No empty frames — anticipation visuals fill screen before keySync
- [ ] Uses `SPRINGS.SMOOTH` or `SPRINGS.SNAPPY` (NOT raw damping/stiffness values)
- [ ] **EVERY** `interpolate()` call has BOTH `extrapolateLeft: 'clamp'` AND `extrapolateRight: 'clamp'`
- [ ] No CSS `animation:` property — only `interpolate()` and `spring()`
- [ ] **Overlay zone compliance** — if overlay mode, all elements are in top strip (0-15%) or lower-third (58-85%), NONE in speaker zone (15-58%)
- [ ] **No Math.sin/cos** — all cyclic animations use `interpolate()`, never `Math.sin` or `Math.cos` (causes jittery video frames)
- [ ] TypeScript compiles cleanly

After implementation, run TypeScript validation:
```bash
npx tsc --noEmit
```
Fix any errors before finishing.

When done, respond: "SCENE {scene_number} COMPLETE"
