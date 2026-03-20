# Agent Pipeline Overhaul — Design Spec

## Goal

Redesign the Viona agent pipeline to produce professional-quality edited videos — orchestrated by a proactive, conversational creative director (Viona).

The pipeline combines custom Remotion animations, punch-ins, transitions, captions, and spatial composition across three scene display modes:

- **Fullscreen content scenes** — animation replaces the speaker entirely (B-roll style). Speaker audio continues underneath.
- **Stacked / split-screen scenes** — speaker video shrinks and repositions to the bottom portion of the frame; animation fills the top. Both visible simultaneously.
- **Overlay scenes** — transparent-background Remotion scenes of any size placed on top of the speaker video in safe zones (lower thirds, stat callouts, headings, progress bars, bullet lists, etc.)

Phase 1 scope: all visuals are custom Remotion scenes. No stock footage, no audio effects (SFX/music are future phases).

## Guideline System

Two hardcoded files wire into the pipeline:

### Editing Style (`motion-graphics-focused.md`)

Given to the **Planner**. Dictates which techniques to use and when. All visuals are purpose-built Remotion animations. No stock footage. Defines:
- Primary and secondary techniques with usage rules
- Pacing rules (max speaker-only duration, scene coverage %, stagger timing)
- Display mode selection (fullscreen vs split-screen vs overlay decision tree)
- Scene content strategy (pattern matching: enumeration → cards, comparison → columns, process → flowchart, etc.)
- When NOT to add a scene (personal anecdotes, rhetorical questions, emotional moments)

### Studio Theme (`viona-glass.md`)

Given to the **Setup Agent** and all **Animators**. The visual DNA for all scene code:
- Color palette (dark base `#08080C`, violet accent `#8B5CF6`, opacity-based text hierarchy)
- Glass effect recipe (backdrop blur 40px, saturate 180%, specular highlights, shadows)
- Typography (Sora font, max weight 500, size scale for 1080x1920)
- Spring configuration (damping: 30, mass: 1, stiffness: 500)
- Animation timing (stagger 6-10 frames, entrance 20 frames, exit 12 frames)
- Shape, spacing, shadow system
- Full code examples (three-step process, data comparison, floating label overlay)

---

## Architecture

### Agents

| Agent | Role |
|-------|------|
| **Viona (Orchestrator)** | Creative director, conversational partner, reviewer. Has transcript + full workspace context. Dispatches agents, reviews output, does minor manifest tweaks only. |
| **Trim Editor** | Removes fillers, silences, retakes. Tightens pacing. Creates clean timeline. Generates captions on a dedicated caption track. |
| **Planner** | The brain. Decides everything — scene boundaries, technique placements, display modes, overlay scenes, transitions, punch-ins, caption style. Outputs detailed plan in markdown. |
| **Setup Agent** | Scaffolds workspace — writes `constants.ts` with theme values, shared components (`Background.tsx`, etc.), prepares file structure for parallel animation. |
| **Layout Editor** | Executes the plan on the manifest — splits video at scene boundaries, sets speaker transforms per display mode, creates tracks, places colored rectangle mockups, sets up punch-in crops, places overlay scene placeholders. Builds the entire timeline skeleton. |
| **Animators (N in parallel)** | Write Remotion `.tsx` scene files — both content scenes and overlay scenes. Each gets one scene assignment, exact dimensions, theme, transcript segment, plan description. All run concurrently. |
| **Final Editor** | Replaces mockups with real scene items, applies caption styling, validates all tracks (no overlaps, correct z-order, no gaps), final quality pass. Hooks everything together into a finished video. |

### Pipeline Flow

```
1. User sends creative brief
2. Viona reads transcript, asks user 2-3 clarifying questions
3. Viona dispatches Trim Editor → clean timeline, synced transcript, captions generated
4. Viona dispatches Planner → comprehensive plan (with style guide + theme + brief + user answers)
5. Viona dispatches Setup Agent → constants.ts, shared components, workspace scaffolding
6. Viona dispatches Layout Editor → timeline skeleton (splits, transforms, mockups, transitions, punch-ins)
7. Viona dispatches multiple Animators in parallel → each writes one .tsx scene file
8. Viona reviews animations → render stills, inspect scenes
9. Viona dispatches fix agents for issues → iterate until satisfied
10. Viona dispatches Final Editor → replaces mockups, caption styling, track validation, final quality
11. Viona does final review
12. Done — user sees finished video
```

Viona can converse with the user at any point. The user can interrupt, give feedback, or ask questions. Viona can ask the user for direction if unsure.

---

## Viona (Orchestrator)

### Role
Creative director and conversational partner. She is the leader — she understands the content, has opinions, and makes informed decisions about what to do and when.

### What Viona has in context
- Full transcript (word-level timing)
- Creative brief + user's answers to clarifying questions
- Editing style guide (`motion-graphics-focused.md`)
- Studio theme (`viona-glass.md`)
- Current manifest state
- Knowledge of all available techniques and tools

### What Viona does
- **Before pipeline:** Reads transcript, understands content, asks user clarifying questions about creative direction
- **During pipeline:** Dispatches agents in order, reviews output after animators and after final editor
- **Reviews:** Renders stills at key frames, inspects manifest, checks scenes. Dispatches fix agents for issues.
- **Minor tweaks:** Can do small manifest patches herself (timing adjustment, opacity fix, etc.) — anything that doesn't need a full subagent
- **Conversational:** User can talk to her at any time. She can ask questions mid-pipeline.

### What Viona does NOT do
- Write scene files (animators do that)
- Complex multi-item manifest edits (editors do that)
- Trim (trim editor does that)
- Plan (planner does that)

### Proactive behavior
Viona is proactive, not reactive. She:
- Makes creative decisions without waiting for the user to specify every detail
- Anticipates what the video needs by reading the transcript
- Knows all her capabilities and uses them
- Tells her team (subagents) exactly what to do based on her creative vision
- Reviews output critically and catches issues before the user sees them

---

## Trim Editor

### Role
First agent in the pipeline. Cleans up the raw timeline and generates captions.

### Prerequisite
Word-level transcript with timing (`startMs`, `endMs` per word) must exist before the Trim Editor runs. This comes from the transcription step that happens during upload — it is NOT part of this pipeline. The transcript is at `/workspace/docs/transcript.json`.

### What it does
- Removes filler words, silences (>750ms), retakes, false starts
- Creates jump cuts with 100-200ms gaps (not hard cuts)
- Adds 3-8% zoom punch-ins at each cut point to mask jumps
- Generates captions on a dedicated caption track from the word-level transcript
- Re-syncs transcript timing after each trim edit (adjusting word timestamps to match the new timeline)

### Output
- Clean manifest with tightened timeline
- Synced transcript at `/workspace/docs/transcript.json`
- Caption items on caption track

---

## Planner

### Role
The brain of the pipeline. Outputs a comprehensive plan that specifies every visual and editorial decision.

### Input
- Post-trim transcript (word-level timing)
- Editing style guide (`motion-graphics-focused.md`)
- Studio theme (`viona-glass.md`)
- Creative brief + user's answers to Viona's clarifying questions
- Current manifest state (canvas dimensions, duration, tracks)

### Output: `SCENE_PLAN.md`

Structured markdown with a global section and per-scene entries. Each entry is a mechanical instruction that the Layout Editor can execute without creative judgment — and a creative brief that the Animator can build from.

#### Global section
- Canvas dimensions (e.g., 1080x1920)
- Caption style (font, color, active word color, display mode — applies to entire video)
- Energy arc summary

#### Per-scene entry schema

Every scene entry in the plan follows this exact structure:

```markdown
## Scene N: [Name]

**Time:** startMs – endMs
**Transcript:** "exact words the speaker says during this segment"
**Display mode:** fullscreen | split-screen [top%/bottom%] | overlay
**Energy:** 1-5

### Speaker layout (for Layout Editor)
- Speaker transform: { x, y, width, height } — OR "opacity: 0" for fullscreen (keep item for audio, hide visually)
- Speaker crop: { x, y, scale } — optional, for punch-in effect. x/y are center-point percentages (0-100), scale is zoom factor (e.g., 1.3 for 130% punch-in)

### Scene placement (for Layout Editor)
- Scene dimensions: widthxheight (e.g., 1080x960, 800x120)
- Scene transform: { x, y, width, height }
- Track: overlay (all scene items go on `overlay`-type tracks in the manifest)
- Z-order: above speaker, below captions

### Transitions (for Layout Editor)
- Entry: crossfade 12f | flash 3f | none
- Exit: crossfade 12f | fade 8f | none

### Animation brief (for Animator)
- Scene type: step-cards | comparison | flowchart | data-viz | definition | timeline | hierarchy | cause-effect | progress | custom
- Description: "Three glass cards appear one by one showing the three benefits: faster iteration, lower costs, better retention. Each card has a checkmark icon and the benefit text."
- Key data: ["Faster iteration", "Lower costs", "Better retention"]
- Must show: exact items/numbers from transcript
```

**Example: 50/50 stacked layout**
```markdown
## Scene 3: Three Benefits

**Time:** 45000 – 58000
**Display mode:** split-screen 50/50

### Speaker layout
- Speaker transform: { x: 0, y: 960, width: 1080, height: 960 }

### Scene placement
- Scene dimensions: 1080x960
- Scene transform: { x: 0, y: 0, width: 1080, height: 960 }
- Track: overlay
```

**Example: small overlay**
```markdown
## Scene 5: Stat Callout

**Time:** 72000 – 78000
**Display mode:** overlay

### Speaker layout
- Speaker transform: full size (no change)

### Scene placement
- Scene dimensions: 280x160
- Scene transform: { x: 750, y: 600, width: 280, height: 160 }
- Track: overlay
```

The Layout Editor reads the `Speaker layout` and `Scene placement` sections mechanically — no interpretation needed. The Animator reads the `Animation brief` section and builds the scene creatively.

#### Additional entries (not per-scene)

- Punch-in locations within speaker-only segments (timestamps, crop %)
- Multi-angle cut positions (timestamps, crop regions)

### What the planner decides
- Where to cut the video into scenes
- What kind of animation each scene gets (the concept, not the internal design)
- Display mode per scene
- Every technique placement: punch-ins, multi-angle cuts, transitions, headings, lower thirds, bullet points, overlay scenes
- The energy arc across the whole video
- Caption treatment (global style)

### What the planner does NOT decide
- Internal animation design (how elements move, spring configs, layout) — that's the animator's job guided by the theme
- Specific Remotion code — planner describes intent, animator implements

---

## Setup Agent

### Role
Scaffolds the workspace so parallel animators can run. Writes shared code files that all scenes depend on.

### Input
- Plan (`SCENE_PLAN.md`)
- Studio theme (`viona-glass.md`)

### What it creates
- **`src/constants.ts`** — COLORS, SPRING_CONFIG, TIMING, EASING, FONTS, GLASS, SPACING, SHADOWS matching the theme exactly
- **`src/components/Background.tsx`** — shared background component with variants:
  - `solid` — single color fill
  - `gradient` — linear gradient with configurable colors and direction
  - `mesh` — radial gradient mesh (violet/blue tints from theme)
  - Props: `variant`, `colors` (optional override), `opacity` (optional)
- **Any other shared components** the plan calls for (glass card wrapper, common layouts)
- Ensures `src/scenes/` directory exists
- Ensures Sora font is available in the rendering environment

### Why this must be a separate step
All animators import `../constants` and `../components/Background`. If these don't exist when animators run in parallel, they all fail. Setup must complete before any animator starts.

---

## Layout Editor

### Role
Executes the plan on the manifest. Builds the entire timeline skeleton before animations are created.

### Input
- Plan (`SCENE_PLAN.md`)
- Post-setup manifest

### What it does
- Splits video items at scene boundaries
- Splits video items at multi-angle cut positions (each segment gets a different crop value to simulate angle switches)
- Sets speaker transforms per display mode:
  - Fullscreen scenes: speaker video item kept (audio must continue) but set to opacity 0 via keyframes
  - Split-screen: speaker scaled/positioned to bottom portion per plan's `Speaker transform` values
  - Overlay: speaker at full size (no transform change)
- Creates overlay tracks for scene items
- Places colored rectangle mockup items where real scenes will go (correct time range, correct transform/dimensions)
- Sets up punch-in crops on speaker video at planned timestamps (splits video at punch-in points, sets crop on the punched-in segment)
- Creates tracks for overlay scenes with correct z-ordering
- Applies transition effects where possible:
  - Crossfade: opacity keyframes on adjacent items
  - Flash: shape item (white rectangle, 2-3 frames, 80% opacity) between sections

### Implementation notes
- Punch-ins and multi-angle cuts require splitting the video item at each point, since `crop` is per-item (not keyframeable)
- Transitions like crossfade are implemented via opacity keyframes on items, not via a manifest transition primitive
- The manifest's `data.transition` field on scene items exists but is loosely typed — prefer keyframe-based transitions for reliability

### Output
A fully laid-out timeline where every element is in the right place and time, but scene items are mockup placeholders waiting to be replaced with real animations.

---

## Animators (Parallel)

### Role
Write Remotion `.tsx` scene files. Each animator handles one scene — either a content scene or an overlay scene.

### Input (per animator)
- One scene assignment from the plan (description, type, transcript segment)
- Exact dimensions to render within
- Studio theme (`viona-glass.md`)
- Shared constants and components (already scaffolded by Setup Agent)

### Two categories of scenes

**Content Scenes** — fullscreen or split-screen, with background
- Complex explanatory visuals: flowcharts, comparisons, data visualizations, timelines, step cards, hierarchy diagrams, process breakdowns
- Rendered at the dimensions specified by the plan
- Use the glass theme for all visual elements

**Overlay Scenes** — transparent background, placed on top of speaker video

This is an **unconstrained creative engine.** The animator can build literally anything React can render. There is no fixed menu of overlay types. The planner invents what would best illustrate the content, describes it, specifies dimensions + placement. The animator builds it. The editor places it.

Any dimensions — the planner specifies size and position based on the content need. Examples: lower thirds, headings, bullet lists, progress bars synced to the topic, floating stats, callout arrows, quote cards, icon badges, annotations, checklists, labels, timers — anything that illustrates the moment.

The key principle: **dimension the scene only as large as what it needs to show.** A lower third doesn't need a 1080x1920 canvas — it needs 800x120. A stat callout needs 300x180. The scene is rendered at its natural size, then placed on the video via manifest transform (x, y, width, height).

### How Overlay Scenes Work (with examples)

**Canvas: 1080x1920 (9:16 vertical video). Speaker is centered, face in top ~35% of frame. Captions at the bottom ~15%.**

#### Example 1: Lower Third (Speaker Introduction)

Speaker starts talking. A lower third slides in with their name and title.

**Scene file:** `LowerThird_Intro.tsx` — renders at **800x120**
```tsx
// Transparent background — no <Background> component
const LowerThirdIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const slideX = interpolate(frame, [0, 15], [-100, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  return (
    <div style={{
      opacity,
      transform: `translateX(${slideX}px)`,
      background: 'rgba(28, 28, 35, 0.55)',
      backdropFilter: 'blur(40px) saturate(180%) brightness(1.1)',
      borderRadius: 14,
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderTop: '1px solid rgba(255, 255, 255, 0.12)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
      padding: '14px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }}>
      <div style={{ color: 'rgba(255,255,255,0.95)', fontSize: 28, fontFamily: 'Sora', fontWeight: 500 }}>
        Sarah Chen
      </div>
      <div style={{ color: '#8B5CF6', fontSize: 18, fontFamily: 'Sora', fontWeight: 400 }}>
        Product Designer at Stripe
      </div>
    </div>
  );
};
export default LowerThirdIntro;
```

**Manifest placement:**
```json
{
  "type": "scene",
  "data": { "sceneFile": "LowerThird_Intro.tsx" },
  "transform": { "x": 48, "y": 1400, "width": 800, "height": 120 }
}
```
→ Placed bottom-left, above caption area, away from face. Small glass pill with name + title.

---

#### Example 2: Stat Callout (Speaker mentions "73% of users")

Speaker says a statistic. A floating stat pops in to the right of the speaker.

**Scene file:** `Stat_73Percent.tsx` — renders at **280x160**
```tsx
const Stat73: React.FC = () => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 18], [0.85, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const count = Math.round(interpolate(frame, [8, 30], [0, 73], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  }));
  return (
    <div style={{
      opacity,
      transform: `scale(${scale})`,
      background: 'rgba(28, 28, 35, 0.55)',
      backdropFilter: 'blur(40px) saturate(180%) brightness(1.1)',
      borderRadius: 20,
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderTop: '1px solid rgba(255, 255, 255, 0.12)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
      padding: '20px 28px',
      textAlign: 'center',
    }}>
      <div style={{ color: '#8B5CF6', fontSize: 52, fontFamily: 'Sora', fontWeight: 500 }}>
        {count}%
      </div>
      <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 16, fontFamily: 'Sora' }}>
        of users prefer this
      </div>
    </div>
  );
};
export default Stat73;
```

**Manifest placement:**
```json
{
  "type": "scene",
  "data": { "sceneFile": "Stat_73Percent.tsx" },
  "transform": { "x": 750, "y": 600, "width": 280, "height": 160 }
}
```
→ Placed right side, mid-frame, away from face. Counting number animates up to 73%.

---

#### Example 3: Topic Heading (New section starts)

Speaker transitions to a new topic. A heading appears at the top of the frame.

**Scene file:** `Heading_GrowthStrategy.tsx` — renders at **900x70**
```tsx
const HeadingGrowth: React.FC = () => {
  const frame = useCurrentFrame();
  const y = interpolate(frame, [0, 15], [-30, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  return (
    <div style={{
      opacity,
      transform: `translateY(${y}px)`,
      background: 'rgba(139, 92, 246, 0.12)',
      borderRadius: 40,
      border: '1px solid rgba(139, 92, 246, 0.2)',
      padding: '12px 32px',
      textAlign: 'center',
    }}>
      <span style={{ color: '#8B5CF6', fontSize: 22, fontFamily: 'Sora', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Growth Strategy
      </span>
    </div>
  );
};
export default HeadingGrowth;
```

**Manifest placement:**
```json
{
  "type": "scene",
  "data": { "sceneFile": "Heading_GrowthStrategy.tsx" },
  "transform": { "x": 90, "y": 60, "width": 900, "height": 70 }
}
```
→ Centered at top of frame. Small violet pill with topic label. Well above speaker's face.

---

#### Example 4: Progress Bar (Speaker covers 3 of 5 topics)

Speaker is covering a list of topics. A thin progress bar at the very top shows progress.

**Scene file:** `Progress_3of5.tsx` — renders at **1080x24**
```tsx
const Progress3of5: React.FC = () => {
  const frame = useCurrentFrame();
  const width = interpolate(frame, [0, 20], [40, 60], { // 40% → 60% (topic 3 of 5)
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  return (
    <div style={{
      opacity,
      width: '100%',
      height: '100%',
      background: 'rgba(255, 255, 255, 0.06)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${width}%`,
        height: '100%',
        background: 'linear-gradient(90deg, #7C3AED, #8B5CF6)',
        borderRadius: 12,
      }} />
    </div>
  );
};
export default Progress3of5;
```

**Manifest placement:**
```json
{
  "type": "scene",
  "data": { "sceneFile": "Progress_3of5.tsx" },
  "transform": { "x": 0, "y": 8, "width": 1080, "height": 24 }
}
```
→ Full width at the very top edge. Only 24px tall. Minimal, doesn't interfere with anything.

---

#### Example 5: Bullet List (Speaker lists 3 benefits)

Speaker is listing benefits one by one. A glass card with checkmarks builds up on the left side.

**Scene file:** `Bullets_Benefits.tsx` — renders at **420x320**
```tsx
const BulletsBenefits: React.FC = () => {
  const frame = useCurrentFrame();
  const items = ['Faster iteration', 'Lower costs', 'Better retention'];
  return (
    <div style={{
      background: 'rgba(28, 28, 35, 0.55)',
      backdropFilter: 'blur(40px) saturate(180%) brightness(1.1)',
      borderRadius: 20,
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderTop: '1px solid rgba(255, 255, 255, 0.12)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      {items.map((item, i) => {
        const delay = i * 30; // each item appears 1 second apart (30 frames at 30fps)
        const opacity = interpolate(frame, [delay, delay + 15], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });
        const x = interpolate(frame, [delay, delay + 15], [20, 0], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });
        return (
          <div key={item} style={{
            opacity,
            transform: `translateX(${x}px)`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <div style={{ color: '#8B5CF6', fontSize: 22 }}>✓</div>
            <div style={{ color: 'rgba(255,255,255,0.95)', fontSize: 24, fontFamily: 'Sora' }}>
              {item}
            </div>
          </div>
        );
      })}
    </div>
  );
};
export default BulletsBenefits;
```

**Manifest placement:**
```json
{
  "type": "scene",
  "data": { "sceneFile": "Bullets_Benefits.tsx" },
  "transform": { "x": 36, "y": 900, "width": 420, "height": 320 }
}
```
→ Left side, below the speaker's face, above captions. Each bullet appears as the speaker says it (staggered by 30 frames = 1 second).

---

### Overlay sizing principle

**Dimension the scene to exactly what it needs to show — no larger.** The scene renders its content at its natural size. The manifest transform places it on the canvas.

| Overlay type | Typical dimensions | Typical position |
|---|---|---|
| Lower third | 700-900 x 100-140 | Bottom-left, y: 1350-1450 |
| Topic heading | 600-900 x 60-80 | Top-center, y: 40-80 |
| Stat callout | 200-350 x 120-200 | Right side, y: 500-800 |
| Progress bar | 1080 x 16-30 | Full width, y: 0-10 |
| Bullet list | 350-500 x 200-400 | Left side, y: 800-1100 |
| Floating label | 250-400 x 80-120 | Any safe zone corner |
| Small icon badge | 80-120 x 80-120 | Corner or beside heading |

These are guidelines, not fixed — the planner decides dimensions based on actual content.

### Who needs to know about overlays

All three agents involved in overlay scenes must understand the overlay system:

- **Planner** — decides WHAT overlay to create, its dimensions, its position on the canvas, and which safe zone it occupies. Writes this into `SCENE_PLAN.md` with exact `{ x, y, width, height }` for each overlay scene.
- **Animator** — builds the overlay scene `.tsx` at the exact dimensions the planner specified. Renders content with transparent background. Follows the theme. Does not decide placement — that's already in the plan.
- **Layout Editor** — places the mockup placeholder at the planner's specified position and dimensions. Creates the overlay track with correct z-ordering (above speaker, below captions).
- **Final Editor** — replaces mockups with real scene files. Verifies placement still complies with safe zones. Validates no overlay covers the face or overlaps captions.

The overlay system is a chain: **Planner invents → Animator builds → Layout Editor places → Final Editor validates.**

### Overlay Placement Rules

These rules apply to ALL overlay scenes and must be known by ALL agents — Viona, Planner, Layout Editor, Animators, and Final Editor:

1. **NEVER cover the speaker's face.** This is the #1 rule. No exceptions.
2. **NEVER overlap with captions.** Captions occupy the lower portion of the frame.
3. **Safe zones for overlays:**
   - Above the speaker's head
   - Sides of the frame (left/right of speaker)
   - Near the chest area (below face, above captions)
   - Corners of the frame
4. **Speaker head position** is available from `speaker-grid.json` — use it to determine safe zones dynamically. If head-tracking data is unavailable, assume speaker face is centered in the top 40% of the frame.
5. **Overlay scenes should be small and focused** — they supplement the speaker, not compete with them.

### Scene quality rules
- Follow `viona-glass.md` theme exactly
- All `interpolate()` calls must have BOTH `extrapolateLeft: 'clamp'` AND `extrapolateRight: 'clamp'`
- No `useCurrentFrame()` subtraction inside `<Sequence>` — frame is already 0-relative
- `overflow: 'hidden'` on all containers with moving elements
- Motion from frame 0 — never a static opening frame
- Minimum 3 distinct animated elements per content scene
- `export default` on the scene component

---

## Final Editor

### Role
Hooks everything together after animations are reviewed. Replaces mockups with real scenes and does the final quality pass.

### Input
- Plan (`SCENE_PLAN.md`)
- Manifest with mockups (from Layout Editor)
- Completed scene files (from Animators)

### What it does
- Replaces all mockup placeholder items with real scene items (correct `sceneFile` references)
- Applies caption styling (global style: display mode, font, colors, animation, active word highlighting)
- Validates all tracks:
  - No two audio items on the same track at the same time
  - No overlapping items on the same track
  - Correct track z-ordering (speaker below scenes, scenes below overlays, captions on top)
  - No gaps in the timeline
  - All scene files exist and are referenced correctly
- Verifies transitions are applied correctly between scenes
- Verifies punch-in crops are correct on speaker video items
- Ensures overlay scenes comply with placement rules (not covering face, not overlapping captions)
- Runs `validate_timeline` tool for structural validation
- Final render stills at key frames to spot-check

### Output
A finished, validated timeline ready for rendering.

---

## Techniques Reference

All agents need to know what techniques are available in the animation-heavy editing style.

### Camera/Framing (executed by Layout Editor via manifest)
- **Punch-in** — splits speaker video at emphasis moments, applies tighter crop on the punched-in segment. Hard cut, not animated zoom.
- **Multi-angle cuts** — splits speaker video at interval points, applies different crop regions to simulate angle switches. Breaks monotony every ~30 seconds.

### Transitions (executed by Layout Editor + Final Editor via manifest)
- **Jump cuts** — foundation of trimming (Trim Editor removes dead air)
- **Crossfade** — opacity keyframes on adjacent items for smooth blend
- **Flash/white frame** — shape item (white rectangle, 2-3 frames, 80% opacity) between major sections

### Scene Animations (executed by Animators)
- **Content scenes** — fullscreen or split-screen explanatory visuals with background
- **Overlay scenes** — transparent background, any size, unconstrained creative freedom within placement rules

### Captions (created by Trim Editor, styled by Final Editor)
- **Animated captions** — word-by-word or phrase-based, synced to speech
- **Active word highlighting** — current word changes color/scale

---

## Known Limitations

- **Caption style is global** — cannot vary caption styling per section. The planner decides one style for the entire video.
- **No undo/rollback** — if an agent corrupts the manifest, recovery requires restarting. Consider manifest snapshots between pipeline steps (future improvement).
- **Transitions are loosely typed** — `data.transition` on scene items is not schema-validated. Prefer keyframe-based transitions for reliability.
- **speaker-grid.json may not exist** — head-tracking is optional. Fallback: assume speaker face centered in top 40% of frame.
- **Sora font must be available** — Setup Agent must ensure the font is present in the Remotion rendering environment.

---

## What This Design Does NOT Cover

- **Stock footage / B-roll** — future addition: Pexels/Unsplash search, photo/video overlays, Ken Burns
- **Music & SFX** — future addition: background music, sound effects, audio ducking
- **Frontend changes** — editor UI, preview, timeline display
- **Theme customization UI** — future: user picks/customizes themes from frontend
- **Editing style auto-selection** — future: Viona auto-detects content type and picks style
- **Multi-language support** — transcript analyzer assumes single language
