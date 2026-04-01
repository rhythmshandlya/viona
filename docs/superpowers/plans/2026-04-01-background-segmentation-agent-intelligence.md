# Background Segmentation: Agent Intelligence

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update all agent prompts (planner, layout editor, setup agent, animator) with depth compositing vocabulary, layer-aware handoff, and speaker spatial data. Wire up the orchestrator to request matting and deliver mattes to workspace.

**Architecture:** Planner learns depth vocabulary for overlay mode briefs. Layout editor writes speaker bbox metadata into every scene manifest item. Setup agent bakes speaker constants into scene skeletons. Animator reads layer-compositing.xml for BehindSpeaker/InFrontOfSpeaker guidance. Orchestrator calls request_segmentation after planning and verifies matte delivery before final review.

**Tech Stack:** Markdown prompts, XML prompt modules, TypeScript (orchestrator, MCP tools)

**Spec:** `docs/superpowers/specs/2026-04-01-background-segmentation-design.md`

---

## Phase 1: Shared Prompt Module — Layer Compositing

### Task 1: Create `layer-compositing.xml` shared prompt module

**Files:**
- Create: `packages/sandbox/src/prompts/shared/layer-compositing.xml`
- Modify: `packages/sandbox/src/prompts/prompt-loader.ts:16` (add to SHARED_FILES)

This new shared module is loaded for ALL agents (like `motion-design.xml`). It teaches every agent that scenes have two output layers and that the person matte sits between them.

- [ ] **Step 1: Write `layer-compositing.xml`**

Create `packages/sandbox/src/prompts/shared/layer-compositing.xml`:

```xml
<layer_compositing>
  <principle>
    Every scene has two output layers: BehindSpeaker and InFrontOfSpeaker.
    The person (extracted via matte) sits between them. You can place ANY
    element on EITHER layer — mix and match for the best visual result.

    A single scene can have MULTIPLE animations across both layers:
    - A stat counter emerging behind the speaker (BehindSpeaker)
    - A label positioned as a lower third in front (InFrontOfSpeaker)
    - A progress bar that starts behind, then a callout pops in front
    - Background color wash behind + floating data card in front

    The creative brief tells you what goes where. When it says "emerge behind"
    or "peek from behind shoulders", use BehindSpeaker. When it says "overlay",
    "lower third", "in front", use InFrontOfSpeaker. When it doesn't specify,
    use your judgment — whatever makes the video look best.

    These layers are for OVERLAY display mode only. Stacked and Fullscreen
    scenes do not use depth layers (the speaker is either cropped to the bottom
    half or hidden entirely — no full body to interact with).
  </principle>

  <spatial_rules>
    - SPEAKER.bboxPx defines the person's silhouette rectangle on canvas
    - VISIBLE_ZONES are areas around the speaker (not occluded by the body)
    - BehindSpeaker elements behind SPEAKER.bboxPx are partially hidden = depth effect
    - BehindSpeaker elements in VISIBLE_ZONES are fully visible (no occlusion)
    - InFrontOfSpeaker elements are always fully visible, rendered on top of person
    - Position key behind-speaker content to PEEK from edges (partially visible creates depth)
    - Do NOT put readable text fully behind the speaker's face (occluded = invisible)
    - Use SPEAKER.centerPx as origin for radial/burst effects behind the speaker
    - Elements at chest/shoulder height get the best partial-occlusion depth effect
    - Use VISIBLE_ZONES.left and VISIBLE_ZONES.right for content that must be fully readable
  </spatial_rules>

  <multi_element_scenes>
    Overlay scenes are no longer limited to a single floating card. With layers,
    a scene can combine:
    - Behind: background color wash or pattern
    - Behind: large stat/text peeking from behind shoulders
    - Front: lower third name bar
    - Front: small callout card positioned in a visible zone
    Stagger entrances so only one element animates at a time.
  </multi_element_scenes>

  <constants_reference>
    Scene skeletons include these constants (always available in overlay scenes):

    SPEAKER.bbox    — normalized {x, y, w, h} (0-1 range)
    SPEAKER.center  — normalized {x, y} (face center)
    SPEAKER.bboxPx  — pixel values {x, y, w, h}
    SPEAKER.centerPx — pixel values {x, y}
    VISIBLE_ZONES.left   — pixel rect {x, y, w, h} (area left of speaker)
    VISIBLE_ZONES.right  — pixel rect {x, y, w, h} (area right of speaker)
    VISIBLE_ZONES.top    — pixel rect {x, y, w, h} (area above speaker)
    VISIBLE_ZONES.bottom — pixel rect {x, y, w, h} (area below speaker)

    These are derived from the person matte and represent the average speaker
    position across the scene's time range. Use them for static layout decisions.
  </constants_reference>
</layer_compositing>
```

- [ ] **Step 2: Register in prompt-loader.ts**

Modify `packages/sandbox/src/prompts/prompt-loader.ts` line 16 — add `'layer-compositing.xml'` to the `SHARED_FILES` array:

```typescript
const SHARED_FILES = ['identity.xml', 'tool-usage.xml', 'manifest-tools.xml', 'quality-rules.xml', 'motion-design.xml', 'layer-compositing.xml'];
```

- [ ] **Step 3: Verify loading**

Run from project root:
```bash
cd packages/sandbox && npx tsx -e "import { loadSharedModules } from './src/prompts/prompt-loader.js'; loadSharedModules().then(s => { console.log(s.includes('layer_compositing') ? 'PASS' : 'FAIL: layer-compositing not loaded'); })"
```

---

## Phase 2: Planner Prompt — Depth Vocabulary

### Task 2: Add depth vocabulary to the planner's display mode documentation

**Files:**
- Modify: `packages/sandbox/src/prompts/planner/system.md`
- Modify: `packages/sandbox/src/prompts/planner/reminder.md`
- Modify: `packages/sandbox/src/prompts/planner/examples/good-plan.md`

The planner already documents three display modes (Overlay, Stacked, Fullscreen) in the `<vocabulary>` section. We add depth interaction vocabulary to the Overlay mode description only. The planner uses these terms in animation briefs to describe which elements go behind vs in front of the speaker.

- [ ] **Step 1: Add depth vocabulary to Overlay mode in `<vocabulary>` section**

In `packages/sandbox/src/prompts/planner/system.md`, find the Overlay mode description inside the `<vocabulary>` block (starts at the `### 1. Overlay` heading). After the existing paragraph ending with `...the graphic must communicate instantly.`, add the depth interaction vocabulary.

Find this text (around line 17-18):

```
**Canvas:** Small (800–1000px wide, 480–960px tall). Limited real estate.
**Animation approach:** Simple and punchy. 1–3 focused elements with a single clear focal point. Snappy entrances (the graphic appears DECISIVELY, not drifting in slowly). Shorter hold times. Quick exits. The viewer's attention is split with the speaker, so the graphic must communicate instantly.

Overlays are NOT filler, text labels, or lightweight popups. They are properly animated graphics — but they are SIMPLER compositions than Stacked or Fullscreen because of the smaller canvas and split attention.
```

Replace with:

```
**Canvas:** Small (800–1000px wide, 480–960px tall). Limited real estate.
**Animation approach:** Simple and punchy. 1–3 focused elements with a single clear focal point. Snappy entrances (the graphic appears DECISIVELY, not drifting in slowly). Shorter hold times. Quick exits. The viewer's attention is split with the speaker, so the graphic must communicate instantly.

Overlays are NOT filler, text labels, or lightweight popups. They are properly animated graphics — but they are SIMPLER compositions than Stacked or Fullscreen because of the smaller canvas and split attention.

**Depth interactions (overlay mode only):** Because the speaker is full-screen, overlay animations can interact with the speaker's body through depth layers. Elements can appear BEHIND the speaker (partially occluded by their silhouette) or IN FRONT of the speaker. This creates the "text-behind-subject" effect used across TikTok, YouTube, and professional motion design.

When writing animation briefs for overlay scenes, use these depth terms:

*Behind-speaker interactions:*
- `emerge-behind` — Element scales up or slides in behind the speaker
- `peek-sides` — Element is wide enough to be visible on both sides of the speaker
- `cascade-behind` — Multiple elements stack or flow behind the speaker
- `background-fill` — Color/gradient/pattern fills behind speaker (original bg still visible at edges)
- `depth-lower-third` — Bar/label passes behind speaker's body

*Front-to-back interactions (elements that cross layers):*
- `weave-through` — Element enters in front, passes behind speaker, exits in front (or vice versa)
- `split-depth` — Part of the element is behind speaker, part is in front (e.g., bar chart where bars go behind but labels stay in front)
- `depth-reveal` — Element starts fully behind speaker, then the speaker moves/scales to reveal it

*Around-speaker interactions:*
- `flank` — Elements appear on both sides of the speaker, framing them
- `radial-from-speaker` — Elements emanate outward from behind the speaker's center
- `parallax-offset` — Elements shift laterally based on speaker position, creating parallax depth

*Depth anti-patterns (NEVER do these):*
- Don't put every element behind the speaker — mix front and back for contrast
- Don't animate multiple behind-speaker elements simultaneously (one motion per moment)
- Don't place readable text fully behind the speaker's face (occluded = invisible)
- Depth vocabulary is for Overlay mode ONLY — never use in Stacked or Fullscreen briefs
```

- [ ] **Step 2: Update per-scene schema to include depth brief guidance**

In `packages/sandbox/src/prompts/planner/system.md`, inside the `<per_scene_schema>` block, find the `### Animation Brief Rules` section (around line 124). After rule 5 ("Don't front-load..."), add a new rule:

```
6. **Depth layer guidance (overlay scenes only).** When using depth terms (emerge-behind, peek-sides, weave-through, etc.), clearly state which elements go BEHIND the speaker and which go IN FRONT. This is the animator's primary layer instruction. Example: "Large '73%' counter EMERGES BEHIND the speaker from center. A label 'of users' slides in IN FRONT at the bottom third." Stacked and Fullscreen briefs must NOT use depth vocabulary.
```

- [ ] **Step 3: Add depth-related self-verification items**

In `packages/sandbox/src/prompts/planner/system.md`, inside the `<plan_structure>` block's self-verification checklist (around line 233), add these two items before the closing `</plan_structure>`:

```
- [ ] Depth vocabulary (emerge-behind, peek-sides, weave-through, etc.) only appears in **Overlay** scene briefs — never in Stacked or Fullscreen
- [ ] Overlay scenes with depth terms clearly state which elements are BEHIND vs IN FRONT of the speaker
```

- [ ] **Step 4: Update reminder.md with depth constraint**

In `packages/sandbox/src/prompts/planner/reminder.md`, add this line after the existing `- Entire timeline must be covered — no speaker-only gaps.` line (around line 13):

```
- Depth vocabulary (emerge-behind, peek-sides, weave-through, split-depth, etc.) is OVERLAY MODE ONLY. Never use in Stacked or Fullscreen briefs.
```

- [ ] **Step 5: Add a depth-aware overlay scene to the good-plan example**

In `packages/sandbox/src/prompts/planner/examples/good-plan.md`, modify the Scene 1 example (the Overlay scene) to demonstrate depth vocabulary in its animation brief. Find the current animation brief for Scene 1:

```
### Animation brief
Thermometer shape scales in as the speaker begins "seventy-three percent of people." Red fill rises from 0% to 73% while the speaker says "who start a fitness routine quit" — counter ticks up in sync. As the speaker says "it's not because they're lazy," the glass cracks at the 73% mark and red tint pulses outward. "73% quit" text scales in when the speaker hits "three critical mistakes." Everything scales down and fades before the cut.
```

Replace with:

```
### Animation brief
Large "73%" counter EMERGES BEHIND the speaker from center, scaling up as the speaker begins "seventy-three percent of people." The number is wide enough to PEEK from both sides of the speaker's shoulders. Red fill rises from 0% to 73% while the speaker says "who start a fitness routine quit" — counter ticks up in sync behind the speaker's body. As the speaker says "it's not because they're lazy," the glass cracks at the 73% mark and red tint pulses outward behind the speaker. "73% quit" text slides in IN FRONT of the speaker at the bottom third when the speaker hits "three critical mistakes." The depth contrast — massive stat behind, label in front — creates emphasis. Everything scales down and fades before the cut.
```

---

## Phase 3: Layout Editor Prompt — Speaker Spatial Data

### Task 3: Update layout editor to write speaker spatial data into scene items

**Files:**
- Modify: `packages/sandbox/src/prompts/layout-editor/system.md`
- Modify: `packages/sandbox/src/prompts/layout-editor/reminder.md`
- Modify: `packages/sandbox/src/prompts/layout-editor/examples/good-layout.md`

The layout editor currently creates a single overlay track for all scene items. We update it to: (a) create the 5-track sandwich structure (video, scene-bg, person, scene-fg, overlay), (b) include `speakerBbox`, `speakerCenter`, and `visibleZones` in every scene item's `data` field, and (c) call `get_speaker_position` per scene to populate these values.

- [ ] **Step 1: Update track structure documentation**

In `packages/sandbox/src/prompts/layout-editor/system.md`, find the `## Track Structure (after Layout Editor)` section (around line 179). Replace the entire table:

```markdown
## Track Structure (after Layout Editor)

| Track | Type | Contents |
|---|---|---|
| Video track | `video` | Speaker video — continuous, keyframed for transform/opacity |
| Audio track | `audio` | Speaker audio — continuous, plays regardless of video opacity |
| Scene track | `overlay` | All scene items — sequential, no overlap, each with entrance/exit keyframes |
| Caption track | `caption` | Added later by Final Editor |
```

With the new 5-track sandwich:

```markdown
## Track Structure (after Layout Editor)

The layout editor creates a 5-track sandwich. The person matte layer sits between behind-speaker and in-front-of-speaker scene tracks, creating depth compositing.

| Track | Type | Position | Contents |
|---|---|---|---|
| Overlay track | `overlay` | 4 | Captions, foreground HUD elements (added later by Final Editor) |
| Scene-FG track | `overlay` | 3 | Animation elements IN FRONT of speaker — `name: "scene-fg"` |
| Person track | `overlay` | 2 | Matted person layer (always present) — `name: "person"` |
| Scene-BG track | `overlay` | 1 | Animation elements BEHIND speaker — `name: "scene-bg"` |
| Video track | `video` | 0 | Source video (original background) |
| Audio track | `audio` | — | Speaker audio — continuous, plays regardless of video opacity |

The person track is always present — matting is guaranteed. Scene items default to the scene-fg track. Overlay scenes with depth briefs (emerge-behind, peek-sides, etc.) place their scene item on scene-bg instead. The animator later decides per-element which layer each part targets; the layout editor makes the initial track assignment based on the planner's brief.

> **Clarification — track assignment vs. render-time layer splitting:** The manifest item's track (`trk-scene-bg` or `trk-scene-fg`) is the **primary layer** — it determines where the scene component renders in the compositor. However, a single scene component can contain BOTH `<BehindSpeaker>` and `<InFrontOfSpeaker>` sections. The `SandwichComposite` component (see Plan 2: Workspace Integration) handles the actual layer splitting at render time — it reads the scene component's layer wrappers and routes each section to the correct compositor layer. The manifest track assignment is an initial hint based on the dominant layer in the planner's brief; the rendering pipeline resolves the full dual-layer output regardless of which track the item sits on.
```

- [ ] **Step 2: Update Step 2 (Create scene track) to create 3 scene-related tracks**

In `packages/sandbox/src/prompts/layout-editor/system.md`, find `### Step 2: Create scene track` (around line 42). Replace the content:

```markdown
### Step 2: Create scene track
Create one overlay track for scene items using `add_track` with type `overlay`. All scene items go on this ONE track (they are sequential, no overlap). Position it above the video track and below the caption track.
```

With:

```markdown
### Step 2: Create the layer sandwich tracks

Create three overlay tracks that form the depth sandwich:

```
add_track({ type: "overlay", name: "scene-bg", position: 1 })  → trk-scene-bg
add_track({ type: "overlay", name: "person", position: 2 })    → trk-person
add_track({ type: "overlay", name: "scene-fg", position: 3 })  → trk-scene-fg
```

All scene items go on either `trk-scene-bg` or `trk-scene-fg` (they are sequential within each track, no overlap). The person track holds the matted speaker layer (populated by the rendering pipeline). Default track assignment:

- **Overlay scenes with depth briefs** (animation brief contains "behind", "emerge-behind", "peek-sides", "cascade-behind", "background-fill", "depth-lower-third") → place on `trk-scene-bg`
- **All other scenes** (overlay without depth, stacked, fullscreen) → place on `trk-scene-fg`

The animator may later split a scene's output across both layers, but the manifest item sits on one track — the initial placement is based on the dominant layer in the brief.
```

- [ ] **Step 3: Add speaker spatial data to Step 4 (Place scene items)**

In `packages/sandbox/src/prompts/layout-editor/system.md`, find `### Step 4: Place scene items` (around line 105). After the existing `add_item` documentation and before `### Step 5`, add a new subsection:

```markdown
#### Speaker spatial data (REQUIRED on every scene item)

After creating each scene item, call `get_speaker_position` with the scene's `{ startMs, endMs }` to get the speaker's position during that time range. Add the returned data to the scene item's `data` field:

```
// For each scene item, call get_speaker_position and extract:
const pos = get_speaker_position({ startMs: 15000, endMs: 25000 });

update_item({
  itemId: "scene-1",
  data: {
    ...existingData,
    speakerBbox: { x: 0.28, y: 0.10, w: 0.44, h: 0.75 },   // normalized 0-1 from pos.speaker.bodyBounds
    speakerCenter: { x: 0.50, y: 0.45 },                       // normalized face center
    visibleZones: {                                              // areas NOT behind speaker
      left:   { x: 0, y: 0, w: 0.28, h: 1.0 },
      right:  { x: 0.72, y: 0, w: 0.28, h: 1.0 },
      top:    { x: 0, y: 0, w: 1.0, h: 0.10 },
      bottom: { x: 0, y: 0.85, w: 1.0, h: 0.15 }
    }
  }
})
```

Normalize values to 0-1 range. Note: `get_speaker_position` returns `speaker.bounds` as `{ top, bottom, left, right }` in **pixel coordinates**, NOT `{ x, y, w, h }` normalized. Convert with:
```
x = bounds.left / canvasWidth
y = bounds.top / canvasHeight
w = (bounds.right - bounds.left) / canvasWidth
h = (bounds.bottom - bounds.top) / canvasHeight
```
The Setup Agent reads these to bake pixel-space constants into scene skeletons.

If `get_speaker_position` returns `speaker: null` (no face detected), use default center values:
```
speakerBbox: { x: 0.25, y: 0.05, w: 0.50, h: 0.85 },
speakerCenter: { x: 0.50, y: 0.40 },
visibleZones: {
  left:   { x: 0, y: 0, w: 0.25, h: 1.0 },
  right:  { x: 0.75, y: 0, w: 0.25, h: 1.0 },
  top:    { x: 0, y: 0, w: 1.0, h: 0.05 },
  bottom: { x: 0, y: 0.90, w: 1.0, h: 0.10 }
}
```
```

- [ ] **Step 4: Update reminder.md with speaker data requirement and fix conflicting track line**

In `packages/sandbox/src/prompts/layout-editor/reminder.md`, first update the existing conflicting line in the `## Scene Items` section (line 23). Find:

```
- All scenes go on ONE overlay track, sequential, no overlap.
```

Replace with:

```
- Depth scenes (brief mentions "behind", "emerge-behind", etc.) go on `trk-scene-bg`. All other scenes go on `trk-scene-fg`. Sequential within each track, no overlap.
```

Then add a new section after `## Scene Items` (around line 25):

```markdown
## Speaker Spatial Data
- Every scene item MUST have `data.speakerBbox`, `data.speakerCenter`, `data.visibleZones`.
- Call `get_speaker_position` per scene time range to get speaker coordinates.
- Normalize to 0-1 range (divide by canvas width/height).
- Depth scenes (brief mentions "behind", "emerge-behind", etc.) go on `trk-scene-bg`.
- All other scenes go on `trk-scene-fg`.
```

- [ ] **Step 5: Update good-layout example with speaker data and sandwich tracks**

In `packages/sandbox/src/prompts/layout-editor/examples/good-layout.md`, update Step 2 to create 3 tracks instead of 1:

Find:
```
### Step 2: Create scene track
```
```
add_track({ type: "overlay", name: "Scenes" })
→ trk-scenes
```

Replace with:

```
### Step 2: Create layer sandwich tracks
```
```
add_track({ type: "overlay", name: "scene-bg", position: 1 }) → trk-scene-bg
add_track({ type: "overlay", name: "person", position: 2 })   → trk-person
add_track({ type: "overlay", name: "scene-fg", position: 3 }) → trk-scene-fg
```

Update Step 4 to show scene items placed on the correct tracks and including speaker data. In the existing `add_item` calls, replace `trackId: "trk-scenes"` with the appropriate track based on display mode, and add `speakerBbox`, `speakerCenter`, `visibleZones` to each scene item's data field. For example, the overlay scene (Scene 3) should use `trk-scene-fg`:

```
add_item({
  type: "scene", trackId: "trk-scene-fg",
  startMs: 38000, endMs: 51000,
  data: {
    sceneFile: "Scene3.tsx", displayMode: "overlay", sceneName: "Stat Callout",
    speakerBbox: { x: 0.30, y: 0.08, w: 0.40, h: 0.78 },
    speakerCenter: { x: 0.50, y: 0.42 },
    visibleZones: {
      left: { x: 0, y: 0, w: 0.30, h: 1.0 },
      right: { x: 0.70, y: 0, w: 0.30, h: 1.0 },
      top: { x: 0, y: 0, w: 1.0, h: 0.08 },
      bottom: { x: 0, y: 0.86, w: 1.0, h: 0.14 }
    }
  },
  transform: { x: 140, y: 1200, width: 800, height: 480 }
})
```

Update the final manifest state summary:

```
### Final manifest state
- **Tracks:** trk-video, trk-audio, trk-scene-bg, trk-person, trk-scene-fg
- **Video items:** 8 on trk-video (from trimming)
- **Audio items:** 8 on trk-audio (matching)
- **Scene items:** 4 total — stacked/fullscreen on trk-scene-fg, depth overlays on trk-scene-bg
- **Speaker data:** Every scene item has speakerBbox, speakerCenter, visibleZones in data
- **No splits at scene boundaries** — all display mode changes via transforms + keyframes
```

---

## Phase 4: Setup Agent Prompt — Speaker Constants in Skeletons

### Task 4: Update setup agent to include speaker constants and layer wrappers in scene skeletons

**Files:**
- Modify: `packages/sandbox/src/prompts/setup-agent/system.md`
- Modify: `packages/sandbox/src/prompts/setup-agent/reminder.md`

The setup agent reads SCENE_PLAN.md and the manifest to create scene skeletons. We update it to: (a) read speaker spatial data from the manifest's scene items (placed by the layout editor), (b) include `SPEAKER` and `VISIBLE_ZONES` constants in every overlay scene skeleton, and (c) include `BehindSpeaker`/`InFrontOfSpeaker` wrapper comments in overlay skeletons.

- [ ] **Step 1: Add speaker constants section to setup agent rules**

In `packages/sandbox/src/prompts/setup-agent/system.md`, find the `## What You Create` section's `### d. Scene file skeletons` subsection (around line 149). Before the template scenes example, add a new subsection about speaker constants:

```markdown
#### Speaker constants in overlay skeletons

The manifest's scene items include speaker spatial data (added by the Layout Editor). For every **overlay** scene, read the scene item's `data.speakerBbox`, `data.speakerCenter`, and `data.visibleZones` from the manifest and bake them into the skeleton as constants.

Read the manifest with `read_manifest`, find the scene item matching the skeleton's time range, and extract the normalized speaker values. Convert to pixel coordinates using the scene's canvas dimensions (1080x1920 for overlay scenes where the speaker is full-screen).

```tsx
// Speaker position (matte-derived, always available in overlay mode)
export const SPEAKER = {
  bbox: { x: 0.28, y: 0.10, w: 0.44, h: 0.75 },          // normalized 0-1
  center: { x: 0.50, y: 0.45 },                             // normalized face center
  bboxPx: { x: 302, y: 192, w: 475, h: 1440 },             // pixel values on 1080x1920
  centerPx: { x: 540, y: 864 },                              // pixel values
};

export const VISIBLE_ZONES = {
  left:   { x: 0, y: 0, w: 302, h: 1920 },
  right:  { x: 778, y: 0, w: 302, h: 1920 },
  top:    { x: 0, y: 0, w: 1080, h: 192 },
  bottom: { x: 0, y: 1632, w: 1080, h: 288 },
};
```

**Pixel conversion:** `bboxPx.x = Math.round(bbox.x * 1080)`, `bboxPx.y = Math.round(bbox.y * 1920)`, etc. Use the canvas dimensions (1080x1920), NOT the scene dimensions (which are the overlay's smaller canvas).

**Stacked and Fullscreen scenes:** Do NOT include SPEAKER or VISIBLE_ZONES constants. These modes don't use depth layers (speaker is cropped to bottom half or hidden).
```

- [ ] **Step 2: Add layer wrapper pattern to overlay skeleton examples**

In `packages/sandbox/src/prompts/setup-agent/system.md`, find the non-template overlay skeleton example (around line 230). Update the component structure to include the BehindSpeaker/InFrontOfSpeaker wrapper comments.

Find the current non-template overlay skeleton JSX pattern:

```tsx
  return (
    <div style={{ width: SCENE_WIDTH, height: SCENE_HEIGHT, overflow: 'hidden' }}>
      {/* Implement CTA animation */}
    </div>
  );
```

Replace with a depth-aware pattern for overlay skeletons:

```tsx
  // Scene has two output layers (overlay mode):
  // - BehindSpeaker: elements render behind the person (on scene-bg track)
  // - InFrontOfSpeaker: elements render in front of the person (on scene-fg track)
  // The person matte sits between the two layers.
  // Position behind-speaker elements to PEEK from SPEAKER.bboxPx edges.
  // Use VISIBLE_ZONES for content that must be fully readable.

  return (
    <div style={{ width: SCENE_WIDTH, height: SCENE_HEIGHT, overflow: 'hidden' }}>
      {/* BehindSpeaker layer — elements here are partially occluded by the person */}
      {/* Implement behind-speaker animation */}

      {/* InFrontOfSpeaker layer — elements here render on top of the person */}
      {/* Implement in-front animation */}
    </div>
  );
```

- [ ] **Step 3: Update template skeleton comment block for overlay scenes**

In `packages/sandbox/src/prompts/setup-agent/system.md`, find the template skeleton overlay example (around line 166). Add speaker constant references to the comment block.

After the existing `// SCENE_WIDTH = 800, SCENE_HEIGHT = 480` line, add:

```tsx
// SPEAKER = { bbox: { x: 0.30, y: 0.08, w: 0.40, h: 0.78 }, center: { x: 0.50, y: 0.42 },
//             bboxPx: { x: 324, y: 154, w: 432, h: 1498 }, centerPx: { x: 540, y: 806 } }
// VISIBLE_ZONES = { left: {x:0,y:0,w:324,h:1920}, right: {x:756,y:0,w:324,h:1920},
//                   top: {x:0,y:0,w:1080,h:154}, bottom: {x:0,y:1652,w:1080,h:268} }
```

- [ ] **Step 4: Update setup agent rules to read manifest for speaker data**

In `packages/sandbox/src/prompts/setup-agent/system.md`, find the `## Rules` section (around line 275). After rule 2 (`Read SCENE_PLAN.md SECOND`), add:

```
3. **Read the manifest THIRD** — call `read_manifest` to get scene items with speaker spatial data. For each overlay scene, extract `data.speakerBbox`, `data.speakerCenter`, and `data.visibleZones` from the matching scene item. These values were written by the Layout Editor.
```

Renumber subsequent rules (old 3 becomes 4, etc.).

- [ ] **Step 5: Update setup agent workflow in `<task>` section**

In `packages/sandbox/src/prompts/setup-agent/system.md`, find the `## Your Workflow` numbered list (around line 291). After step 2 (`Read /workspace/docs/SCENE_PLAN.md`), add:

```
3. Read the manifest (`read_manifest`) — extract speaker spatial data from scene items for overlay scene skeletons.
```

Renumber subsequent steps.

- [ ] **Step 6: Update reminder.md with speaker data requirement**

In `packages/sandbox/src/prompts/setup-agent/reminder.md`, add before the final `After writing all files:` line:

```
- Overlay scene skeletons MUST include `SPEAKER` and `VISIBLE_ZONES` constants (read from manifest scene items).
- Stacked/Fullscreen skeletons do NOT include speaker constants.
- Overlay skeletons include BehindSpeaker/InFrontOfSpeaker layer comments in the JSX.
```

---

## Phase 5: Animator Prompt — Layer-Aware Animation

### Task 5: Update animator prompt with layer-aware coding guidance

**Files:**
- Modify: `packages/sandbox/src/prompts/animator/system.md`
- Modify: `packages/sandbox/src/prompts/animator/reminder.md`

The animator receives scene skeletons with `SPEAKER`, `VISIBLE_ZONES`, and BehindSpeaker/InFrontOfSpeaker layer comments. We add guidance on how to use these for depth-aware animation.

- [ ] **Step 1: Add depth layer section to display mode documentation**

In `packages/sandbox/src/prompts/animator/system.md`, find the `### Overlay — supporting graphic over the speaker` section (around line 364). After the existing `**Technical rules:**` block for overlay (ending around line 379), add a new subsection:

```markdown
**Depth layers (overlay mode):**

Your overlay skeleton includes `SPEAKER` and `VISIBLE_ZONES` constants plus BehindSpeaker/InFrontOfSpeaker layer comments. These tell you where the person's body is on the canvas and how to position elements for depth effects.

**How to use layers:**
- Elements in the `{/* BehindSpeaker layer */}` section render behind the person's body
- Elements in the `{/* InFrontOfSpeaker layer */}` section render in front of the person
- A single scene can have elements on BOTH layers — mix and match
- The animation brief tells you which elements go where ("EMERGES BEHIND" = BehindSpeaker, "IN FRONT" = InFrontOfSpeaker)

**Spatial positioning with SPEAKER constants:**
- Place behind-speaker elements so they PEEK from the edges of `SPEAKER.bboxPx` — partially visible creates the depth illusion
- Position behind-speaker content at chest/shoulder height (`SPEAKER.bboxPx.y + SPEAKER.bboxPx.h * 0.3` to `0.6`) for the best partial-occlusion effect
- Use `VISIBLE_ZONES.left` and `VISIBLE_ZONES.right` for behind-speaker content that must be readable
- Use `SPEAKER.centerPx` as the origin for radial/burst effects behind the speaker
- Never place readable text fully behind the speaker's face area

**Coding pattern:**
```tsx
return (
  <div style={{ width: SCENE_WIDTH, height: SCENE_HEIGHT, overflow: 'hidden' }}>
    {/* BehindSpeaker layer */}
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Large stat peeking from behind shoulders */}
      <div style={{
        position: 'absolute',
        left: SPEAKER.centerPx.x - s(200),
        top: SPEAKER.bboxPx.y + SPEAKER.bboxPx.h * 0.3,
        fontSize: s(120),
        transform: `scale(${heroScale})`,
      }}>
        73%
      </div>
    </div>

    {/* InFrontOfSpeaker layer */}
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Lower third label */}
      <div style={{
        position: 'absolute',
        bottom: s(80),
        left: s(40),
        fontSize: s(28),
      }}>
        of users agree
      </div>
    </div>
  </div>
);
```

When the animation brief does NOT mention depth terms, place all elements in InFrontOfSpeaker (the traditional overlay behavior). The behind-speaker layer is used only when the brief explicitly calls for it.
```

- [ ] **Step 2: Update reminder.md with layer rules**

In `packages/sandbox/src/prompts/animator/reminder.md`, add after the existing `## Display Mode — Adapt Your Approach` section (around line 37):

```markdown
## Depth Layers (Overlay Only)
- Overlay skeletons have `SPEAKER`, `VISIBLE_ZONES` constants and BehindSpeaker/InFrontOfSpeaker layer comments.
- Place elements per the animation brief: "behind" / "emerge-behind" → BehindSpeaker layer. "in front" / "lower third" → InFrontOfSpeaker layer.
- Behind-speaker elements should PEEK from edges of SPEAKER.bboxPx — don't center behind the face.
- If the brief doesn't mention depth, put everything in InFrontOfSpeaker (standard overlay behavior).
- Stacked/Fullscreen scenes do NOT have SPEAKER constants or depth layers.
```

---

## Phase 6: Orchestrator — Segmentation Request Wiring

### Task 6: Add segmentation request to orchestrator after planner phase

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts`
- Modify: `packages/sandbox/src/prompts/prompt-loader.ts` (add context field)

The orchestrator dispatches the planner in Phase 3. After the planner returns and the scene plan is approved, the orchestrator should request segmentation for overlay scenes that use depth interactions. This happens before Phase 4 (Setup Agent) so that matting runs in the background while the setup agent and layout editor work.

- [ ] **Step 1: Add `hasSegmentation` field to PromptContext**

In `packages/sandbox/src/prompts/prompt-loader.ts`, find the `PromptContext` interface (around line 92). Add a new optional field:

```typescript
  hasSegmentation?: boolean;
```

In the `injectContext` function (around line 108), add the replacement **after the last existing `.replaceAll` call** (which is `.replaceAll('{{CURRENT_PHASE}}', ctx.currentPhase ?? 'unknown')` on line 122) and **before the closing semicolon**:

```typescript
    .replaceAll('{{CURRENT_PHASE}}', ctx.currentPhase ?? 'unknown')
    .replaceAll('{{HAS_SEGMENTATION}}', String(ctx.hasSegmentation ?? false));
```

(This replaces the existing semicolon at the end of the `.replaceAll('{{CURRENT_PHASE}}', ...)` line.)

- [ ] **Step 2: Add segmentation tool names to orchestrator**

In `packages/sandbox/src/orchestrator.ts`, find the `ASSET_TOOL_NAMES` array (around line 104). Add the segmentation tools:

```typescript
const ASSET_TOOL_NAMES = [
  'mcp__assets__download_file',
  'mcp__assets__search_unsplash',
  'mcp__assets__search_pexels',
  'mcp__assets__download_stock_photo',
  'mcp__assets__get_speaker_position',
  'mcp__assets__auto_center_speaker',
  'mcp__assets__get_shot_boundaries',
  'mcp__assets__request_segmentation',
  'mcp__assets__check_segmentation_status',
];
```

Note: The actual `request_segmentation` and `check_segmentation_status` MCP tools are implemented in Plan 1 (Worker Pipeline) and Plan 2 (Workspace Integration). This plan only wires the tool names into the orchestrator's allowed tools list so agents can call them.

- [ ] **Step 3: Add segmentation request logic to orchestrator system prompt**

In `packages/sandbox/src/prompts/orchestrator/system.md`, find `### Phase 3: Planning → dispatch **Planner**` (around line 129). After the existing post-planner steps (read plan, validate, show widget, stop for approval), add a new sub-section before Phase 4:

```markdown
#### After plan approval: Request segmentation (if needed)

After the user approves the scene plan and BEFORE dispatching the Setup Agent:

1. Read `docs/SCENE_PLAN.md` and identify overlay scenes whose animation brief uses depth vocabulary (emerge-behind, peek-sides, cascade-behind, weave-through, split-depth, background-fill, depth-lower-third, flank, radial-from-speaker, parallax-offset, depth-reveal).
2. If any depth scenes exist, call `request_segmentation` with the time ranges of those scenes:
   ```
   request_segmentation({
     ranges: [
       { startMs: 15000, endMs: 25000, sceneId: "scene-2" },
       { startMs: 45000, endMs: 55000, sceneId: "scene-5" },
     ]
   })
   ```
3. This is non-blocking — the worker starts GPU matting in the background. Continue immediately to Phase 4.
4. If NO overlay scenes use depth vocabulary, skip this step entirely.
```

- [ ] **Step 4: Add matte readiness check before final editor phase**

In `packages/sandbox/src/prompts/orchestrator/system.md`, find `### Phase 7: Final Assembly → dispatch **Final Editor**` (around line 197). Add a matte readiness check before dispatching:

```markdown
**Before dispatching Final Editor:** If segmentation was requested in Phase 3, call `check_segmentation_status` to verify mattes are ready. If any are still processing, wait up to 30 seconds (poll every 5 seconds). If they fail, note the failure — the Final Editor will render those scenes without depth compositing (graceful degradation).
```

- [ ] **Step 5: Add segmentation status to TOOL_DISPLAY_NAMES**

In `packages/sandbox/src/orchestrator.ts`, find the `TOOL_DISPLAY_NAMES` record (around line 166). Add:

```typescript
  request_segmentation: 'Requesting speaker segmentation',
  check_segmentation_status: 'Checking segmentation status',
```

- [ ] **Step 6: Pass `API_INTERNAL_URL` to the sandbox container**

The MCP tools `request_segmentation` and `check_segmentation_status` (added in Plan 1) read `process.env.API_INTERNAL_URL` to call back to the API server. Neither sandbox provider currently passes this env var. Add it to both providers.

**Docker provider** — In `packages/api/src/sandbox/docker.ts`, find the `envEntries` object (line 74). The existing `API_CALLBACK_URL` on line 77 uses `host.docker.internal`. Add `API_INTERNAL_URL` using the same host pattern, after the `API_CALLBACK_URL` line:

```typescript
        API_CALLBACK_URL: `http://host.docker.internal:${config.port}/api`,
        API_INTERNAL_URL: `http://host.docker.internal:${config.port}/api`,
```

**Railway provider** — In `packages/api/src/sandbox/railway.ts`, find the env vars section (around line 75). Add after `API_CALLBACK_URL`:

```typescript
        API_INTERNAL_URL: config.sandbox.callbackUrl,
```

Note: On Railway, `API_CALLBACK_URL` already points to the internal private domain URL. `API_INTERNAL_URL` uses the same value since the sandbox communicates with the API over Railway's private network.

---

## Phase 7: MCP Tool Update — Matte-Derived Speaker Position

### Task 7: Update `get_speaker_position` to read matte-derived bbox

**Files:**
- Modify: `packages/mcp-servers/src/asset-server.ts` (get_speaker_position tool)

The current `get_speaker_position` tool reads head tracking data (`speaker-grid.json`) from MediaPipe face/pose detection. We update it to ALSO read matte-derived bounding box data when available, falling back to head tracking when matte data doesn't exist.

**Matte-bbox data flow:** The worker's `segment_person.py` script (Plan 1) generates a `matte-bbox.json` sidecar file alongside each matte clip during segmentation. The worker uploads both the matte video and the bbox JSON to MinIO. When the sandbox calls `check_segmentation_status`, the MCP tool downloads the bbox file alongside the matte video and saves it to `public/matte/scene-{id}-bbox.json`. The `get_speaker_position` tool then reads from that path.

The bbox format produced by `segment_person.py` uses normalized coordinates (0-1 range):
```json
{ "fps": 30, "frames": [{ "frame": 0, "x": 0.28, "y": 0.10, "w": 0.44, "h": 0.75 }] }
```

- [ ] **Step 1: Add matte bbox types**

In `packages/mcp-servers/src/asset-server.ts`, add a new interface after the existing `HeadTrackingData` interface (line 68-80, after the closing `}` on line 80):

```typescript
/** Matte-derived bounding box data (per-frame, normalized 0-1 coords from alpha channel analysis). */
interface MatteBboxFrame {
  frame: number;
  x: number;  // normalized left edge (0-1)
  y: number;  // normalized top edge (0-1)
  w: number;  // normalized width (0-1)
  h: number;  // normalized height (0-1)
}

interface MatteBboxData {
  fps: number;
  frames: MatteBboxFrame[];
}
```

- [ ] **Step 2: Update get_speaker_position to prefer matte data**

In `packages/mcp-servers/src/asset-server.ts`, find the `get_speaker_position` tool handler (line 744, the `async ({ startMs, endMs })` callback). At the start of the handler (line 745, after `try {`), before reading `speaker-grid.json`, add a matte-bbox check. The tool looks for per-scene bbox files that `check_segmentation_status` downloads alongside each matte video:

```typescript
    // Prefer matte-derived bbox over head tracking when available.
    // check_segmentation_status downloads bbox files to public/matte/scene-{id}-bbox.json.
    // We scan the matte dir for any bbox files and pick the one matching the time range.
    const matteDir = path.join(WORKSPACE, "public", "matte");
    let matteBbox: MatteBboxData | null = null;
    try {
      const { readdir } = await import("node:fs/promises");
      const files = await readdir(matteDir);
      const bboxFiles = files.filter(f => f.endsWith('-bbox.json'));
      // Try each bbox file — find one whose frames overlap with [startMs, endMs]
      for (const bboxFile of bboxFiles) {
        const data: MatteBboxData = JSON.parse(await readFile(path.join(matteDir, bboxFile), "utf-8"));
        if (data.frames && data.frames.length > 0) {
          const fps = data.fps || 30;
          // Convert frame numbers to ms and check overlap
          const firstMs = (data.frames[0].frame / fps) * 1000;
          const lastMs = (data.frames[data.frames.length - 1].frame / fps) * 1000;
          if (firstMs <= endMs && lastMs >= startMs) {
            matteBbox = data;
            break;
          }
        }
      }
    } catch {
      // Matte bbox not available — fall through to head tracking
    }
```

Then, after the existing head-tracking aggregation loop (the `for (const f of withFace)` loop ends at line 903, bounds are clamped at lines 906-909), add a branch that uses matte data when available. If `matteBbox` is non-null and has frames in the requested time range, use those bounding boxes to override the head-tracking-derived body bounds. The matte bbox gives a tighter full-body silhouette (including hair, arms, torso) compared to face-only landmarks.

The key difference from head tracking: matte bbox uses normalized 0-1 coordinates that need to be scaled to source pixel coordinates, then transformed to canvas space via `sourceToCanvas`. Insert this block after line 909 (`boundsRight = Math.min(canvas.width, Math.round(boundsRight));`):

```typescript
    // Override bounds with matte-derived bbox when available (more accurate full-body)
    if (matteBbox && matteBbox.frames.length > 0) {
      const fps = matteBbox.fps || 30;
      // Filter matte frames to time range (frame number → ms)
      const matteFrames = matteBbox.frames.filter(mf => {
        const ms = (mf.frame / fps) * 1000;
        return ms >= startMs && ms <= endMs;
      });

      if (matteFrames.length > 0) {
        // Matte bbox uses normalized 0-1 coords — scale to source resolution
        let mLeft = 0, mTop = 0, mRight = 0, mBottom = 0;
        for (const mf of matteFrames) {
          mLeft += mf.x * srcW;
          mTop += mf.y * srcH;
          mRight += (mf.x + mf.w) * srcW;
          mBottom += (mf.y + mf.h) * srcH;
        }
        mLeft /= matteFrames.length;
        mTop /= matteFrames.length;
        mRight /= matteFrames.length;
        mBottom /= matteFrames.length;

        // Transform to canvas space
        const topLeft = sourceToCanvas(mLeft, mTop, transform, itemX, itemY);
        const bottomRight = sourceToCanvas(mRight, mBottom, transform, itemX, itemY);

        // Override body bounds with matte-derived values
        boundsLeft = Math.max(0, Math.round(Math.min(topLeft.x, bottomRight.x)));
        boundsTop = Math.max(0, Math.round(Math.min(topLeft.y, bottomRight.y)));
        boundsRight = Math.min(canvas.width, Math.round(Math.max(topLeft.x, bottomRight.x)));
        boundsBottom = Math.min(canvas.height, Math.round(Math.max(topLeft.y, bottomRight.y)));

        console.error(`[asset-server] Using matte-derived speaker bounds (${matteFrames.length} frames)`);
      }
    }
```

This replaces the body bounds computed from head tracking landmarks (face bbox + inferred shoulder width) with the actual full-body silhouette from the matte. The rest of the function (available space calculation at line 958, safe placements at line 967) uses the updated bounds transparently.

- [ ] **Step 3: Add `source` field to the response**

In the `SpeakerPositionResult` interface (lines 701-727), add a `source` field before the closing `}`:

```typescript
  source: 'matte' | 'head-tracking';
```

In the response construction (line 1001-1013, where the `const result: SpeakerPositionResult = {` object is built), add the `source` field after `confidence`:

```typescript
      const result: SpeakerPositionResult = {
        canvas,
        videoTransform: { ... },
        speaker: { bounds: { ... }, face, shoulderLine, hands, movement },
        availableSpace,
        safePlacements,
        confidence,
        source: matteBbox ? 'matte' : 'head-tracking',
      };
```

Also update the no-detections early return (line 817, `const result: SpeakerPositionResult = {`) to include `source: 'head-tracking'`.

---

## Phase 8: NLE Editor Track Types

### Task 8: Update editor types for the 5-track sandwich

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/types.ts`

The editor currently uses `TrackType = 'video' | 'audio' | 'caption' | 'text' | 'overlay' | 'visual'`. The 5-track sandwich doesn't need new track types — `scene-bg`, `person`, and `scene-fg` are all `overlay` type tracks differentiated by their `name` and `position` fields. However, we need to add speaker spatial data types to the scene item data interface.

- [ ] **Step 1: Add speaker spatial types**

In `apps/web/src/features/editor-v2/store/types.ts`, after the existing `SegmentationData` interface (around line 421), add:

```typescript
/** Normalized speaker bounding box (0-1 range, relative to canvas). */
export interface SpeakerBbox {
  x: number;  // left edge (0-1)
  y: number;  // top edge (0-1)
  w: number;  // width (0-1)
  h: number;  // height (0-1)
}

/** Normalized speaker center point (0-1 range, relative to canvas). */
export interface SpeakerCenter {
  x: number;  // horizontal center (0-1)
  y: number;  // vertical center (0-1)
}

/** Visible zones around the speaker (areas not occluded by the body). */
export interface VisibleZones {
  left:   { x: number; y: number; w: number; h: number };
  right:  { x: number; y: number; w: number; h: number };
  top:    { x: number; y: number; w: number; h: number };
  bottom: { x: number; y: number; w: number; h: number };
}
```

- [ ] **Step 2: Add speaker data to scene/visual item data**

In `apps/web/src/features/editor-v2/store/types.ts`, find the `VisualItemData` interface (around line 423). Add speaker spatial fields:

```typescript
export interface VisualItemData {
  visualId: string;
  displayMode?: 'fullscreen' | 'split-screen' | 'overlay';
  sceneFile?: string;
  sceneName?: string;
  // Speaker spatial data (matte-derived, populated by layout editor)
  speakerBbox?: SpeakerBbox;
  speakerCenter?: SpeakerCenter;
  visibleZones?: VisibleZones;
}
```

Note: Check if `VisualItemData` already has `displayMode`, `sceneFile`, `sceneName` — if not, add them. The layout editor writes `data.sceneFile` and `data.displayMode` on scene items, so these fields must exist on the type.

- [ ] **Step 3: Add default track names constant**

In `apps/web/src/features/editor-v2/store/types.ts`, after the `Track` interface (around line 484), add:

```typescript
/** Well-known track names for the 5-track sandwich. */
export const SANDWICH_TRACK_NAMES = {
  video: 'video',
  sceneBg: 'scene-bg',
  person: 'person',
  sceneFg: 'scene-fg',
  overlay: 'overlay',
} as const;
```

---

## Phase 9: Identity Prompt — Segmentation Context

### Task 9: Add segmentation availability to the shared identity module

**Files:**
- Modify: `packages/sandbox/src/prompts/shared/identity.xml`

The identity module provides workspace context to all agents. We add segmentation availability so agents know depth compositing is possible.

- [ ] **Step 1: Add segmentation line to identity.xml**

In `packages/sandbox/src/prompts/shared/identity.xml`, after the `- Content type: {{PROJECT_TYPE}}` line (around line 8), add:

```xml
- Segmentation available: {{HAS_SEGMENTATION}} (person matting for depth compositing)
```

This is populated by the `PromptContext.hasSegmentation` field added in Task 6, Step 1.

---

## Phase 10: Integration Verification

### Task 10: End-to-end prompt assembly verification

**Files:**
- Create: `scripts/temp/test-prompt-assembly.ts`

Verify that all prompt changes load correctly and the new shared module is included in every agent's assembled prompt.

- [ ] **Step 1: Write verification script**

Create `scripts/temp/test-prompt-assembly.ts`:

```typescript
import { assembleAgentPrompt, type PromptContext } from '../../packages/sandbox/src/prompts/prompt-loader.js';

const ctx: PromptContext = {
  canvasWidth: 1080,
  canvasHeight: 1920,
  fps: 30,
  durationMs: 60000,
  hasTranscript: true,
  theme: 'magazine',
  projectType: 'video',
  hasHeadTracking: true,
  hasSegmentation: true,
  totalScenes: 6,
  currentPhase: 'planning',
};

const agents = ['planner', 'layout-editor', 'setup-agent', 'animator', 'final-editor'];

async function main() {
  let allPassed = true;

  for (const agent of agents) {
    const prompt = await assembleAgentPrompt(agent, ctx);

    // Check layer-compositing.xml is included
    if (!prompt.includes('layer_compositing')) {
      console.error(`FAIL: ${agent} — missing layer-compositing.xml shared module`);
      allPassed = false;
    }

    // Check segmentation context
    if (!prompt.includes('Segmentation available: true')) {
      console.error(`FAIL: ${agent} — missing segmentation context in identity`);
      allPassed = false;
    }

    console.log(`${agent}: ${prompt.length} chars`);
  }

  // Planner-specific checks
  const planner = await assembleAgentPrompt('planner', ctx);
  if (!planner.includes('emerge-behind')) {
    console.error('FAIL: planner — missing depth vocabulary');
    allPassed = false;
  }
  if (!planner.includes('Depth vocabulary')) {
    console.error('FAIL: planner — missing depth self-verification item');
    allPassed = false;
  }

  // Layout editor-specific checks
  const layout = await assembleAgentPrompt('layout-editor', ctx);
  if (!layout.includes('scene-bg')) {
    console.error('FAIL: layout-editor — missing scene-bg track');
    allPassed = false;
  }
  if (!layout.includes('speakerBbox')) {
    console.error('FAIL: layout-editor — missing speakerBbox in scene item data');
    allPassed = false;
  }

  // Setup agent-specific checks
  const setup = await assembleAgentPrompt('setup-agent', ctx);
  if (!setup.includes('VISIBLE_ZONES')) {
    console.error('FAIL: setup-agent — missing VISIBLE_ZONES constant');
    allPassed = false;
  }
  if (!setup.includes('BehindSpeaker')) {
    console.error('FAIL: setup-agent — missing BehindSpeaker layer pattern');
    allPassed = false;
  }

  // Animator-specific checks
  const animator = await assembleAgentPrompt('animator', ctx);
  if (!animator.includes('SPEAKER.bboxPx')) {
    console.error('FAIL: animator — missing SPEAKER.bboxPx spatial positioning');
    allPassed = false;
  }
  if (!animator.includes('BehindSpeaker')) {
    console.error('FAIL: animator — missing BehindSpeaker layer pattern');
    allPassed = false;
  }

  console.log(allPassed ? '\nAll checks passed' : '\nSome checks FAILED');
  process.exit(allPassed ? 0 : 1);
}

main().catch(console.error);
```

- [ ] **Step 2: Run verification**

```bash
cd packages/sandbox && npx tsx ../../scripts/temp/test-prompt-assembly.ts
```

Expected: All checks pass. Each agent's assembled prompt includes layer-compositing.xml, segmentation context, and the agent-specific additions.

- [ ] **Step 3: Clean up test file**

After verification passes, the test file stays in `scripts/temp/` (per project convention) for future regression testing.

---

## Summary of Files Changed

| File | Change |
|------|--------|
| `packages/sandbox/src/prompts/shared/layer-compositing.xml` | **NEW** — shared module for all agents |
| `packages/sandbox/src/prompts/prompt-loader.ts` | Add to SHARED_FILES, add `hasSegmentation` to context |
| `packages/sandbox/src/prompts/planner/system.md` | Depth vocabulary in overlay mode, brief rule, self-verification |
| `packages/sandbox/src/prompts/planner/reminder.md` | Depth vocabulary constraint |
| `packages/sandbox/src/prompts/planner/examples/good-plan.md` | Depth-aware overlay scene example |
| `packages/sandbox/src/prompts/layout-editor/system.md` | 5-track sandwich, speaker spatial data in scene items |
| `packages/sandbox/src/prompts/layout-editor/reminder.md` | Speaker data requirement |
| `packages/sandbox/src/prompts/layout-editor/examples/good-layout.md` | Sandwich tracks, speaker data example |
| `packages/sandbox/src/prompts/setup-agent/system.md` | SPEAKER/VISIBLE_ZONES constants, layer wrapper pattern |
| `packages/sandbox/src/prompts/setup-agent/reminder.md` | Speaker constants requirement |
| `packages/sandbox/src/prompts/animator/system.md` | Depth layer coding guidance for overlay mode |
| `packages/sandbox/src/prompts/animator/reminder.md` | Layer rules |
| `packages/sandbox/src/prompts/shared/identity.xml` | Segmentation availability context |
| `packages/sandbox/src/orchestrator.ts` | Segmentation tool names, display names |
| `packages/sandbox/src/prompts/orchestrator/system.md` | Segmentation request after planner, matte check before final |
| `packages/api/src/sandbox/docker.ts` | Add `API_INTERNAL_URL` env var to sandbox container |
| `packages/api/src/sandbox/railway.ts` | Add `API_INTERNAL_URL` env var to sandbox service |
| `packages/mcp-servers/src/asset-server.ts` | Matte-derived bbox in get_speaker_position |
| `apps/web/src/features/editor-v2/store/types.ts` | SpeakerBbox, VisibleZones types, SANDWICH_TRACK_NAMES |
| `scripts/temp/test-prompt-assembly.ts` | **NEW** — verification script |
