# Pipeline V2 — Working Notes

## Problems with Current Pipeline

1. **Animator has no real prompt** — the old 1300-line system prompt is in `.old`, unused. Animators get a stub and rely on whatever Viona writes in the dispatch.
2. **Planner produces bad plans** — wrong scene types, bad timing, missing sections
3. **Layout Editor breaks the manifest** — wrong splits, missing audio pairs, wrong transforms
4. **Animators write broken code** — TypeScript errors, wrong dimensions, don't follow theme
5. **Orchestrator loses control** — skips phases, doesn't review, agents go off-script

## Phase 0: Init (workspace-init.ts — no changes needed)

Already correct:
- Downloads source.mp4, extracts audio.aac
- Generates proxy files (480p video, 64k audio)
- Writes manifest with video + audio items
- Copies template files, transcript, user brief, head tracking, guidelines
- One editing style (motion-graphics-focused), one theme (viona-glass) — hardcoded for now
- Later: when we have multiple styles/themes, Phase 1 can ask

## Phase 1: Brief (Orchestrator — should be near-instant)

Current: Reads transcript, calls analyze_transcript, asks 2-3 clarifying questions.
Problem: Wastes time asking questions when we only have one style/theme and the user already provided a brief.

**V2:** Read brief + transcript in thinking. Call analyze_transcript. Still ask proactive questions — but NOT about style/theme/editing approach (those are hardcoded). Instead ask about:
- **Assets:** Does the user have specific media (product images, logos, screenshots) they want included? Should we search for stock assets?
- **Visual metaphors:** If the transcript references metaphors (e.g., "the key to success"), should we interpret literally (animate a key) or abstractly?
- **Layout preferences:** Heavy on animations or keep the speaker prominent? Fullscreen scenes or mostly overlays?
- **Emphasis:** Any specific sections that matter most? Anything to skip or downplay?

Only ask what's genuinely needed for this specific video. If the user brief already covers it, skip and dispatch.

## Phase 2: Prepare (Trim Editor — simplified)

Current: Trims fillers, adds zoom punch-ins at cuts, J/L-cuts, generates captions — too much.

**V2 — audio cleanup + video prep only:**
1. Remove fillers (Tier 1, 2, 3) in reverse chronological order
2. Leave 100-200ms gaps at cut points (natural rhythm)
3. Zoom-to-fill video on 9:16 canvas (moved from Layout Editor)
4. Write trim-report.md
5. Verify audio/video marriage (startFrom values correct)
6. Done.

**Removed from this phase (moved to later):**
- Captions → after planning (Final Editor or dedicated step)
- Zoom punch-ins at edit points → Planner/Layout Editor decides where
- J-cuts, L-cuts → Layout Editor decides based on scene placement
- Jump cut coverage crops → Layout Editor after knowing scene positions

**Result:** Clean, trimmed, zoom-filled timeline ready for the Planner. The Planner can render stills and see actual framing.

## Style Vocabulary (what the Planner works with)

### 4 Spatial States

Each state defines WHERE the speaker and animation live on the canvas:

1. **Speaker** — speaker video at full canvas. Nothing else visible. Exists only as a spatial state for transitions (video start/end). The Planner never plans speaker-only time — the entire timeline is covered by scenes or overlays.

2. **Overlay** — speaker video IS the full-screen content. Animation elements are placed on it. Default placement: **lower third, center** (around speaker's chest area in a talking head). User can reposition. Dense real animations — logo morphing, mini data-viz, animated icons, key visual metaphors. Not text labels.

   **Overlay quality:** Overlays are NOT filler or basic text pop-ups. Same production quality as scene animations — viona-glass theme (glass effects, springs, motion), contextual to what the speaker is saying, meaningful durations (not <5 second flashes). Good overlays: animated icon sequences, mini data-viz that builds as speaker explains, glass cards with key terms + depth/parallax, abstract pattern animations for metaphors, logo morphing. Planner's animation brief for overlays must be just as detailed as for scenes.

3. **Stacked** — animation gets its own dedicated space by MOVING THE SPEAKER out of the way. Speaker shrinks to the bottom portion, animation occupies the top portion. Two separate zones. Default mode for most scenes. Split ratio defaults to 50/50, calculated from source video dimensions to fit speaker without black bars or excessive cropping.

4. **Fullscreen** — speaker video hidden (opacity 0, not removed), animation takes the full canvas. Speaker audio continues underneath. Used when the visual needs full viewer attention.

**Key distinction:** Overlay adds elements ON the speaker video. Stacked gives the animation its own space BY moving the speaker. Fullscreen removes the speaker entirely.

**Timeline coverage:** The Planner covers the ENTIRE timeline — there is no "speaker-only" in the plan:
- **Stacked / Fullscreen** for strict scene animations — structured content gets dedicated space
- **Overlay** for rest animations — when no scene is playing, the speaker always has overlays

The video is always visually active. Scenes chain directly (Stacked → Stacked, Overlay → Fullscreen, etc.). Speaker transitions only occur at video boundaries (start/end).

### Corrections to Current Style

- Overlays are NOT "lightweight annotations" — they are real dense animations
- Captions are a SEPARATE system — never part of scene animations
- Animations are DENSE not sparse (current "minimum 3 elements" is too low)
- No "kinetic typography" as a standalone technique — text animation is part of scenes

### Transitions (between states)

The Planner picks from a fixed set. The Layout Editor executes mechanically.

**Duration: 300ms for all transitions.** Synchronized, continuous. Both elements animate from their current spatial position to the target spatial position simultaneously. No sequential animations, no gaps between states, no gaps between scenes.

**Core principle:** Each state defines spatial positions for speaker and animation. A transition = animate both elements to their new positions at the same time, same speed, 300ms.

4 states × 4 targets each (minus Speaker→Speaker) = **15 transitions:**

**Same-mode transitions (content swap, no speaker movement):**

**Stacked → Stacked**
Scene A animation exits top. Scene B animation enters top. Speaker stays in bottom portion. Content swap only — no speaker position change. 300ms.

**Fullscreen → Fullscreen**
Scene A exits (fade/scale). Scene B enters (fade/scale). Speaker stays hidden. Content swap. 300ms.

**Overlay → Overlay**
Overlay A exits. Overlay B enters its position. Speaker stays full screen. Content swap. 300ms.

**Cross-state transitions (speaker position changes):**

**Speaker → Stacked**
Speaker shrinks from full canvas → bottom portion. Animation slides in from top → top portion. Simultaneous, 300ms.

**Speaker → Fullscreen**
Speaker shrinks away (scale down + fade → opacity 0). Animation expands in → full canvas. Simultaneous, 300ms.

**Speaker → Overlay**
Speaker stays full canvas (no movement). Overlay animation snaps/slides into its placement position. 300ms entrance.

**Stacked → Speaker**
Animation slides out → off top. Speaker expands from bottom → full canvas. Simultaneous, 300ms.

**Stacked → Fullscreen**
Animation expands from top portion → full canvas. Speaker shrinks from bottom → hidden (opacity 0). Simultaneous, 300ms.

**Stacked → Overlay**
Stacked animation slides out top. Speaker expands bottom → full canvas. Overlay snaps into placement position. All simultaneous, 300ms.

**Fullscreen → Speaker**
Animation shrinks away (scale down + fade). Speaker fades/scales back in → full canvas. Simultaneous, 300ms.

**Fullscreen → Stacked**
Animation contracts from full canvas → top portion. Speaker slides in from bottom → bottom portion. Simultaneous, 300ms.

**Fullscreen → Overlay**
Fullscreen animation shrinks away. Speaker fades/scales back in → full canvas. Overlay snaps into placement position. All simultaneous, 300ms.

**Overlay → Speaker**
Overlay snaps/slides out. Speaker stays full canvas (no change needed). 300ms exit.

**Overlay → Stacked**
Overlay snaps out. Speaker shrinks from full → bottom portion. Stacked animation slides in from top. All simultaneous, 300ms.

**Overlay → Fullscreen**
Overlay snaps out. Animation expands in → full canvas. Speaker shrinks away → hidden. All simultaneous, 300ms.

**Major section boundary (any state)**
Optional white flash frame (2-3 frames, 80% opacity) to signal new topic.

### Speaker Zoom/Punch-in

Used during overlay segments (speaker is full screen, overlay is a separate layer on top). Never during Stacked or Fullscreen (speaker is moved/hidden).
- Zoom 130-150%, centered on face
- 1-2 per minute during overlay segments
- Never two within 10 seconds
- Hard cut (split video, apply crop), not animated zoom
- The Planner decides exact timestamps — Layout Editor executes

### Animation Scene Types (what content maps to)

| Content pattern | Scene type |
|---|---|
| Lists, steps, reasons | Step cards |
| A vs B, pros/cons | Comparison columns |
| Process, workflow | Flowchart |
| Stats, percentages | Data visualization |
| Term definition | Definition card |
| Chronological events | Timeline |
| Structure, dependencies | Hierarchy/tree |
| Cause → effect | Arrow chain |
| Percentage, ratio | Progress indicator |
| Visual metaphor (door+key, morphing) | Custom animation |

**No content is "too abstract" for a scene.** If transcript content doesn't fit a structured type, use **Custom animation** with abstract visual metaphors. Example: "thinking outside the box" → animate a glowing dot (person) outside a box with other dots inside. The Planner interprets speech metaphors into literal/abstract visual concepts. Every segment can have a visual — the question is which display mode and scene type, not whether to skip it.

### Layout Patterns (composition within a scene)

Center-dominant, asymmetric, diagonal-flow, stacked-cascade, full-bleed, scattered.
No two adjacent scenes use the same pattern.

## Phase 3: Planning

The plan is the contract. Everything downstream follows it religiously.

The Planner reads: transcript (post-trim), editing-style.md, studio-theme.md, user brief, user answers from Phase 1, analyze_transcript output (content-type detection helps scene type decisions).

The Planner outputs: SCENE_PLAN.md with:
- Global section (canvas, scene count)
- Per-scene entries with EXACT values for every field (no ambiguity)
- Transitions between every scene (from the 15-transition set)
- Punch-in locations with timestamps
- Self-verification checklist

**Not in the plan:** Energy/intensity — this depends on how the Animator implements the animation in code. The Planner describes WHAT to show, the Animator decides HOW intensely.

**Key problem:** The Planner currently drifts — produces vague descriptions, wrong dimensions, missing fields. Needs to be constrained to the vocabulary above. Every scene type, display mode, transition, layout pattern must come from the defined set.

### Overlay Placement

The Planner describes overlay placement in natural language — "above speaker", "lower third of the video", "upper right corner", etc. The Layout Editor translates these descriptions into exact pixel transforms. The Planner does NOT need head-tracking data or pixel coordinates.

### Plan Validation

The user validates the plan before it goes to downstream agents. The orchestrator presents SCENE_PLAN.md to the user for approval. No automated validation layer between Planner and Layout Editor — the user is the gate.

### Punch-in Execution

Punch-ins are planned by the Planner (timestamps + zoom level) and executed by the Layout Editor (split video + apply crop). This is a Phase 4+ concern — the Layout Editor implementation details will be defined in the next phase of this redesign.

## Phase 4: Setup Agent (enables parallel animation)

**Core purpose:** Scaffold everything Animators need BEFORE they're dispatched in parallel. Every Animator opens their scene file and all imports, dimensions, data, and shared components are ready. No setup conflicts, no missing dependencies.

### What it reads:
- SCENE_PLAN.md (scene list, types, display modes, dimensions, key data)
- studio-theme.md (colors, springs, typography tokens)

### What it creates:

**1. `src/constants.ts`** — Theme tokens as code
- COLORS: primary, secondary, accent, background, text (from theme)
- SPRINGS: SNAPPY, SMOOTH, BOUNCY, HEAVY (spring configs)
- TIMING: stagger delays, entrance durations, idle speeds
- Every scene imports from here — single source of truth for theme

**2. `src/components/Background.tsx`** — Animated background component
- Glass theme: animated gradient surface, grain texture, continuous subtle motion
- Used by Stacked and Fullscreen scenes (overlay scenes have transparent background)
- Props: variant (default, dark, light), opacity

**3. `src/components/GlassCard.tsx`** — Reusable glass card component
- Glass surface + specular highlight + depth shadow + grain
- Animated entrance (spring-driven)
- Idle motion (float/breathe) built in
- Used across scene types for content containers

**4. Scene file skeletons** — One per scene in `src/scenes/`
Each skeleton includes:
- All imports wired (React, Remotion hooks, constants, shared components)
- Scene metadata as comments (display mode, scene type, layout pattern)
- Dimension constants (`SCENE_WIDTH`, `SCENE_HEIGHT`) from the plan
- `DATA` object pre-filled with key content from the plan (items, labels, stats — whatever the scene type needs)
- Basic component structure with Background already placed (for Stacked/Fullscreen)
- Correct `export default` signature

Example skeleton:
```tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS, SPRINGS, TIMING } from '../constants';
import { Background } from '../components/Background';
import { GlassCard } from '../components/GlassCard';

// Scene: "3 Steps to Success"
// Display Mode: stacked
// Scene Type: step-cards
// Layout Pattern: stacked-cascade
const SCENE_WIDTH = 1080;
const SCENE_HEIGHT = 960;

const DATA = {
  items: [
    { label: 'Listen actively', icon: 'ear' },
    { label: 'Speak clearly', icon: 'mic' },
    { label: 'Follow up', icon: 'checkmark' },
  ],
};

const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Background />
      {/* Implement animation here */}
    </div>
  );
};

export default Scene1;
```

**5. Any shared components** the plan calls for
- If multiple scenes need the same visual element (branded logo, icon set, common chart component), scaffold it once in `src/components/`
- Scene-specific logic stays in the scene file — shared means reused by 2+ scenes

### Key constraint:
Nothing the Setup Agent creates should need per-scene changes after scaffolding. If it's scene-specific, it's the Animator's job. Setup creates the shared foundation + pre-filled starting points.

### Registry:
Scene file skeletons trigger `scene-registry.ts` auto-generation. The Layout Editor can then place scene items pointing to these files. Before the Animator fills in the animation, SceneMockup renders the placeholder. After, the real component renders automatically.

## Phase 5: Layout Editor (heavy lifting)

The Layout Editor builds the entire timeline structure from SCENE_PLAN.md. It makes ZERO creative decisions — executes the plan mechanically.

### Key insight: Multiple video segments after trimming
After the Trim Editor removes fillers, the video track has MULTIPLE segments with gaps. The Layout Editor handles all of them — it does NOT assume one continuous video item.

### What it does:

**1. Set speaker transforms on all video segments**
- NO splitting for display modes — keyframes handle everything
- Enumerate ALL video items on the video track
- For each segment: determine which scene(s) it overlaps
- Segment within ONE scene → set static transform via update_item
- Segment spanning a scene boundary → add 300ms transition keyframes at the boundary
- Display mode states:
  - Overlay → full canvas, opacity 1
  - Stacked → bottom portion, opacity 1
  - Fullscreen → opacity 0 (hidden, audio on separate track)

**2. Place scene items for every scene**
- Each scene gets a scene item (type 'scene') pointing to the scene file (Setup Agent created the skeleton)
- data.sceneFile from plan's File field (Scene{N}.tsx)
- data.displayMode, data.sceneName, data.sceneType set
- All scene items on ONE overlay track (sequential, no overlap)
- Transform from plan's placement:
  - Fullscreen → full canvas
  - Stacked → top portion (exact dimensions from plan)
  - Overlay → exact pixels from placement preset map

**3. Add entrance/exit keyframes to scene items**
- Each scene item gets 300ms entrance and exit keyframes
- Entrance: Stacked slides from top, Fullscreen fades in, Overlay fades in
- Exit: Stacked slides out top, Fullscreen fades out, Overlay fades out
- Same-mode transitions: both scenes get 300ms crossfade

**4. Execute punch-ins (only reason to split video)**
- Split video + audio at punch-in timestamps
- Apply crop to punched segment
- Only during overlay segments
- split_item auto-redistributes keyframes

### Overlay Placement Presets (1080×1920):
| Preset | x | y | width | height |
|---|---|---|---|---|
| lower-third-center | 140 | 1200 | 800 | 480 |
| lower-third-left | 48 | 1200 | 700 | 480 |
| lower-third-right | 332 | 1200 | 700 | 480 |
| center-card | 140 | 480 | 800 | 640 |
| upper-third | 140 | 200 | 800 | 480 |
| small-corner-br | 680 | 1320 | 360 | 360 |
| small-corner-bl | 48 | 1320 | 360 | 360 |
| wide-band | 48 | 1100 | 984 | 320 |

The Planner specifies a preset name. The Layout Editor maps to exact pixels. No natural language interpretation.

### Track structure:
- Video track: speaker video segments (keyframed for transforms/opacity per display mode)
- Audio track: speaker audio segments (separate, plays regardless of video opacity)
- Scene track (type overlay): all scene items (sequential, no overlap)
- Caption track: added later by Final Editor

### SceneMockup fallback:
SceneItem.tsx has a built-in SceneMockup component that renders when the scene file hasn't been filled in by the Animator yet. Shows scene name, display mode, scene type, and dimensions as a styled violet placeholder. Once the Animator writes the real code, the registry regenerates and the real scene renders automatically.

## Phase 6: Animation (biggest gap — needs new prompt)

**Problem:** Animator has a STUB prompt: "You are a Remotion motion graphics engineer. Wait for a scene assignment." The old 1300-line prompt is unused in `.old`.

Animators are dispatched in parallel (one per scene). Each receives:
- Scene brief from SCENE_PLAN.md (description, key data, must-show items)
- Exact dimensions (different per display mode)
- Display mode
- Duration and sync points
- Studio theme reference

**What the Animator needs to know:**
- How to structure a scene file (export default, imports from constants/components)
- Theme compliance (viona-glass: glass effects, springs, stagger, idle motion)
- All interpolate() rules (clamp both sides)
- No useCurrentFrame() subtraction inside Sequence
- The 10 scene types and how to visually implement each one
- Display mode awareness (scene dimensions differ)
- Overlay scenes: transparent background, positioned by Layout Editor
- Stacked/Fullscreen scenes: Background component, glass cards, full scene composition
- Quality: dense animations, motion from frame 0, staggered entrances, idle motion

**TODO:** Write a proper Animator system prompt that covers all of the above.

## Phase 7: Review (Viona spot-checks)

After all animators return:
- Render stills at key scene frames
- Check scenes match the plan's description
- Check overlays don't cover speaker face
- If issues: dispatch fix agent (Animator subagent) with specific feedback
- Max 2 fix rounds per scene

## Phase 8: Final Assembly (Final Editor)

Already updated. Replaces Mockup.tsx references with real scene .tsx files, applies caption styling, validates tracks, renders verification stills.

## Phase 9-10: Final Review → Done

Viona renders final stills, verifies quality, tells user the video is ready.
