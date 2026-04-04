# Plan 5: Overlay Positioning System — Content-Driven Speaker Offset, Scene Splitting, Punch-ins

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Layout Editor dynamically calculate speaker (matte) offset based on the animation's spatial needs — the content decides where it needs space, and the speaker moves to accommodate. Add punch-in keyframes and scene splitting for dual-layer overlay scenes.

**Architecture:** Speaker positioning is content-driven, not preset-driven. The Planner describes zones (above-head, lower-third, etc.) and the Layout Editor reads those zones + the speaker's actual bbox to calculate how much to shift the matte. If animation needs space above the speaker, the matte shifts down. If content enters from the top, both content and speaker shift down. If content is a lower-third or flanking, the speaker stays at natural position.

**Prerequisites:** Plan 4 complete (layout editor has track architecture and cutting).

**Dependency chain:** `Plan 1` → `Plan 2` → `Plan 3` → `Plan 4` → **`Plan 5`** → `Plan 6`

---

### Task 1: Planner — overlay zone guidance, punch-ins, and scene splitting

**Files:**
- Modify: `packages/sandbox/src/prompts/planner/system.md`

- [ ] **Step 1: Add zone, punch-in, and splitting guidance to the Overlay section**

Find the Overlay section (around line 10-46, inside `<vocabulary>`) after the depth anti-patterns list. Add this block before `### 2. Stacked`:

```markdown
**Animation zones (MANDATORY for every overlay element):**

Every element in an overlay animation brief MUST specify its zone — where on the canvas it lives relative to the speaker. The Layout Editor uses zones to calculate how much to shift the speaker's matte to make room for content.

| Zone | Where | Speaker effect |
|---|---|---|
| `above-head` | Above the speaker's head | Speaker shifts DOWN to create headroom |
| `top-enter` | Enters from top of screen, pushes down | Speaker shifts DOWN with the content |
| `lower-third` | Bottom portion of canvas | Speaker stays at natural position |
| `below-chest` | Between chest and bottom | Speaker stays at natural position |
| `flank-left` | Left side of speaker | Speaker stays at natural position |
| `flank-right` | Right side of speaker | Speaker stays at natural position |
| `full-behind` | Full canvas behind speaker | Speaker stays at natural position |

**Key principle:** The animation decides where it needs space. The speaker adjusts to accommodate — NOT the other way around. But adjustments must be **subtle and purposeful** — small shifts to create breathing room, not dramatic repositioning. If the speaker looks unnaturally displaced, the shift is too much. Every offset must have a clear reason (making room for specific content that needs that space).

**Scene splitting:** If an overlay scene needs elements on BOTH behind-speaker AND in-front-of-speaker layers, mark it: "Split: Scene5Behind (behind) + Scene5Front (in front)". The Layout Editor creates two items on separate tracks. The Setup Agent creates two skeleton files.

**Punch-ins** are a primary editing tool. Every overlay scene gets 1-3 punch-ins where V1 background + V3 matte zoom together while animations stay still — like a camera pushing into the speaker for emphasis. Mark each with a transcript anchor + scale:
- 1.15x = subtle emphasis
- 1.25x = standard emphasis
- 1.35x = dramatic moment

Every key stat, emotional beat, or topic shift should get a punch-in.
```

- [ ] **Step 2: Update the Animation Brief Rules for overlay scenes**

Find the `### Animation Brief Rules` section (around line 150-156). After rule 6 (Depth layer guidance), add rule 7:

```markdown
7. **Zone guidance (overlay scenes only).** Every element MUST specify its zone (`above-head`, `top-enter`, `lower-third`, `below-chest`, `flank-left`, `flank-right`, `full-behind`). The zone tells the Layout Editor where the element lives relative to the speaker, which determines whether the speaker needs to shift. Example: "A large stat (behind-speaker, above-head) emerges above the speaker's crown — creating headroom. A bullet list (in-front-of-speaker, lower-third) slides up from bottom." Stacked and Fullscreen briefs must NOT use zone vocabulary.
```

- [ ] **Step 3: Update the per-scene overlay brief format**

Find the `### Animation brief` line in the per-scene schema (around line 146-147). Replace the animation brief description for overlay scenes by updating the line to:

```markdown
### Animation brief
[A narrative describing what happens through the scene, synced to the speaker's words. Write it like you're describing the scene to a motion designer who will watch the footage alongside your brief. Reference specific transcript words as timing anchors.

**Overlay scenes additionally require:**
- **Per element:** layer (`behind-speaker` or `in-front-of-speaker`) + zone (`above-head`, `top-enter`, `lower-third`, `below-chest`, `flank-left`, `flank-right`, `full-behind`)
- **Per scene:** 1-3 punch-ins with transcript anchor + scale (e.g., "Punch-in 1.25x at '$390 million'")
- **If both layers used:** split declaration (e.g., "Split: Scene5Behind + Scene5Front")

Example overlay brief:
"Punch-ins: 1.25x at '$390 million', 1.15x at 'every year'.
A large stat '$390M' (behind-speaker, above-head) emerges above the speaker's crown. A bullet list (in-front-of-speaker, lower-third) slides up from bottom. Split: Scene5Behind + Scene5Front."]
```

- [ ] **Step 4: Add self-verification checklist items**

Find the self-verification checklist section (around line 242-264). Add these items before the closing `</plan_structure>`:

```markdown
- [ ] **Zones:** Every overlay element specifies a zone (above-head, lower-third, etc.)
- [ ] **Face avoidance:** No element targets the speaker's face zone directly
- [ ] **Scene splitting:** Overlay scenes with elements on both behind AND in-front layers are marked for splitting with both file names
- [ ] **Punch-ins:** Every overlay scene has 1-3 punch-ins with scale + transcript anchor
```

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/prompts/planner/system.md
git commit -m "feat(planner): content-driven overlay zones, punch-ins, scene splitting"
```

---

### Task 2: Layout Editor — content-driven matte offset and punch-in keyframes

**Files:**
- Modify: `packages/sandbox/src/prompts/layout-editor/system.md`
- Modify: `packages/sandbox/src/prompts/layout-editor/reminder.md`

- [ ] **Step 1: Add the content-driven overlay positioning section to system.md**

After the existing "Step 4: Place depth items" section (after the line "Do NOT add V1/V3 items for FAILED overlay scenes"), and BEFORE the existing "Step 5: Place scene items", insert this new section:

```markdown
### Step 4b: Calculate content-driven matte offset for READY overlay scenes

The animation brief's zones determine whether the speaker's matte (V3) and background (V1) need to shift. Read the brief, understand what space the content needs, and adjust accordingly.

**Principle:** The animation decides where it needs space. The speaker moves to accommodate.

**CRITICAL — Subtlety over drama:** Matte shifts must be subtle, purposeful adjustments — NOT dramatic repositioning. A 200-350px shift on a 1920px canvas is ~10-18%, which is enough to create breathing room without making the composition feel artificial. If the speaker looks unnaturally displaced, the shift is too much. Every pixel of offset must have a clear reason (making room for specific content). When in doubt, shift less — a slightly tight composition is better than a speaker that looks pushed off-screen.

**A. Read the animation brief's zones and determine the dominant spatial need:**

| Zone in brief | Spatial need | Matte adjustment |
|---|---|---|
| `above-head` | Content needs space ABOVE speaker | Shift matte DOWN — `matteY = +200 to +350` depending on content height |
| `top-enter` | Content enters from screen top, pushes everything down | Shift matte DOWN — `matteY = +150 to +300` |
| `lower-third` | Content in bottom portion | No shift — `matteY = 0` |
| `below-chest` | Content between chest and bottom | No shift — `matteY = 0` |
| `flank-left` / `flank-right` | Content beside speaker | No shift — `matteY = 0` |
| `full-behind` | Full canvas behind speaker | No shift — `matteY = 0` |

If a scene has MULTIPLE zones (e.g., above-head + lower-third via split), use the zone that requires the largest shift.

**B. Calculate matte and background transforms:**

Always oversize 15% to prevent edge leaking at boundaries:
```
const oversize = 1.15;
const matteW = Math.round(CANVAS_W * oversize);
const matteH = Math.round(CANVAS_H * oversize);
const matteX = Math.round(-(matteW - CANVAS_W) / 2);  // center horizontally
// matteY determined by zone analysis above (0 for no-shift, positive for push-down)
```

Update the V3 matte item's transform:
```
update_item({
  itemId: matteItemId,
  transform: { x: matteX, y: matteY, width: matteW, height: matteH }
})
```

Update the V1 background image's transform to match — BOTH shift together:
```
update_item({
  itemId: bgItemId,
  transform: { x: matteX, y: matteY, width: matteW, height: matteH }
})
```

**C. Recalculate SPEAKER constants after matte offset:**

After shifting the matte, the speaker's position in canvas space has changed. The SPEAKER constants written to scene files must reflect the post-offset position. Use `get_speaker_position` to get the natural speaker bbox (normalized 0-1), then apply the offset:

```
// Natural speaker position (normalized, from get_speaker_position)
const norm = pos.speaker.normalized;

// Convert to canvas pixels, then apply matte offset
const speakerCanvasY = norm.bbox.y * matteH + matteY;
const speakerCanvasX = norm.bbox.x * matteW + matteX;

// Convert to scene-local pixels for the scene skeleton
const sceneBboxX = Math.round((speakerCanvasX - sceneTransform.x) * (SCENE_WIDTH / sceneTransform.width));
// ... similar for y, w, h
```

This ensures the Animator's SPEAKER constants accurately reflect where the speaker appears within the scene's local coordinate space after the matte has been shifted.
```

- [ ] **Step 2: Add scene splitting rules to system.md**

After the scene item placement section (Step 5), add:

```markdown
### Step 5b: Handle split overlay scenes

When the animation brief says "Split: Scene5Behind + Scene5Front":

1. Create TWO scene items for the same time range:
   - `Scene5Behind.tsx` → **V2** track (behind speaker)
   - `Scene5Front.tsx` → **V4** track (in front of speaker)
2. Each item gets its own transform based on its zone:
   - Behind-scene (V2): transform covers the zone where behind-speaker content appears (e.g., upper area for `above-head`)
   - Front-scene (V4): transform covers the zone where in-front content appears (e.g., lower area for `lower-third`)
3. Both items share the same `startMs`/`endMs` and transition keyframes
4. Both scene files get SPEAKER constants (same values — same matte offset applies to both)
```

- [ ] **Step 3: Add punch-in keyframe rules to system.md**

In the "Step 6: Add transition keyframes" section, add a new subsection after the transition rules:

```markdown
#### Punch-in keyframes (V1 + V3 matched zoom)

When the animation brief specifies punch-ins (e.g., "Punch-in 1.25x at '$390 million'"):

1. Look up the transcript word timestamp from `/workspace/docs/transcript.json`
2. Calculate the punch-in anchor time relative to the V1/V3 item's `startMs`
3. Add MATCHING scale keyframes to BOTH the V1 background image AND V3 matte item — they zoom together as one layer
4. V2/V4 animation items are NOT affected — they stay still while the "camera" pushes in, like a HUD

```
// Punch-in: 300ms ease-in, 2s hold, 300ms ease-out
const scale = 1.25;  // from the brief
const anchorMs = wordTimestampMs - itemStartMs;  // relative to item

// Calculate zoomed transform (zoom from center of current transform)
const currentCenterX = matteX + matteW / 2;
const currentCenterY = matteY + matteH / 2;
const punchW = Math.round(matteW * scale);
const punchH = Math.round(matteH * scale);
const punchX = Math.round(currentCenterX - punchW / 2);
const punchY = Math.round(currentCenterY - punchH / 2);

// Add to BOTH V1 and V3 items (identical keyframes):
{ timeMs: anchorMs - 150, props: { x: matteX, y: matteY, width: matteW, height: matteH } }
{ timeMs: anchorMs + 150, props: { x: punchX, y: punchY, width: punchW, height: punchH } }
{ timeMs: anchorMs + 2150, props: { x: punchX, y: punchY, width: punchW, height: punchH } }
{ timeMs: anchorMs + 2450, props: { x: matteX, y: matteY, width: matteW, height: matteH } }
```

**Rules:**
- V1 and V3 get IDENTICAL punch-in keyframes — they are one visual layer (background + person)
- Never punch-in during the first or last 500ms of a scene (conflicts with fade transitions)
- If multiple punch-ins in one scene, ensure at least 3 seconds between them
```

- [ ] **Step 4: Update the workflow summary in the `<task>` section of system.md**

Replace the existing workflow steps 6-10 with updated versions that include the new steps:

```markdown
6. Call `auto_center_speaker` — centers the speaker in remaining video segments using matte data.
7. Place background images (V1) and matte items (V3) for each READY overlay scene.
8. **Calculate content-driven matte offset** — read each overlay scene's animation brief zones, determine how much to shift V1+V3 to make room for content. Update V1 and V3 transforms.
9. Place scene items on V2/V4 for all scenes (`add_item` type `scene`). Handle split scenes (two items on V2 + V4).
10. Call `get_speaker_position` for each overlay scene. Recalculate SPEAKER constants accounting for matte offset. Update scene items with speaker spatial data. Write SPEAKER constants to scene skeleton files.
11. Add transition keyframes across all layers (V0 fades, V1/V3 fades, V2/V4 scene cross-fades).
12. Add **punch-in keyframes** to V1+V3 for each overlay scene's punch-in markers from the brief.
13. Read manifest to verify — check item count, track structure, depth items, keyframes.
14. Render 2-3 stills at scene boundaries and punch-in timestamps to visually verify layout.
15. Report completion: number of scenes placed, video segments cut, depth items added, matte offsets applied, punch-ins added.
```

- [ ] **Step 5: Update reminder.md with new rules**

Add these sections to the reminder.md file:

```markdown
## Content-Driven Matte Offset
- Read overlay animation brief zones (above-head, top-enter, lower-third, etc.) to determine matte shift.
- `above-head` / `top-enter` zones → shift V1+V3 DOWN (matteY = +200 to +350).
- `lower-third`, `flank-*`, `full-behind` zones → no shift (matteY = 0).
- V1 and V3 always shift TOGETHER — same transform.
- Oversize matte 15% (1.15x) to prevent edge leaking.
- Recalculate SPEAKER constants AFTER applying matte offset.

## Scene Splitting
- "Split: XBehind + XFront" → two scene items: XBehind.tsx on V2, XFront.tsx on V4.
- Both share the same startMs/endMs and SPEAKER constants.

## Punch-ins
- V1 + V3 get IDENTICAL zoom keyframes — they are one visual layer.
- 300ms ease-in, 2s hold, 300ms ease-out.
- Never punch-in during first/last 500ms of a scene.
- At least 3s between punch-ins in the same scene.
```

- [ ] **Step 6: Commit**

```bash
git add packages/sandbox/src/prompts/layout-editor/system.md packages/sandbox/src/prompts/layout-editor/reminder.md
git commit -m "feat(layout-editor): content-driven matte offset, scene splitting, punch-in keyframes"
```

---

### Task 3: Setup Agent — split scene skeleton support

**Files:**
- Modify: `packages/sandbox/src/prompts/setup-agent/system.md`

- [ ] **Step 1: Add split scene handling to the rules section**

Find the "Scene file skeletons" section (around line 149). After the "Speaker constants in overlay skeletons" subsection (around line 176), add:

```markdown
#### Split overlay scenes

When SCENE_PLAN.md marks a scene for splitting (e.g., "Split: Scene5Behind + Scene5Front"), create TWO skeleton files:

- `src/scenes/Scene5Behind.tsx` — skeleton with only the behind-speaker elements from the brief
  - SCENE_WIDTH/HEIGHT: same as the overlay preset dimensions (the V2 item covers the same area)
  - Include SPEAKER and VISIBLE_ZONES constants (same placeholders as regular overlay scenes)
  - Comment block: only the behind-speaker elements from the animation brief
  - Import layer: `{/* BehindSpeaker layer only */}`

- `src/scenes/Scene5Front.tsx` — skeleton with only the in-front-of-speaker elements
  - SCENE_WIDTH/HEIGHT: same as the overlay preset dimensions (the V4 item covers the same area)
  - Include SPEAKER and VISIBLE_ZONES constants (same values as the behind scene)
  - Comment block: only the in-front-of-speaker elements from the animation brief
  - Import layer: `{/* InFrontOfSpeaker layer only */}`

Both files get the same DATA object (shared content from plan). The animator for each file only implements the elements assigned to its layer.

**Example:**
```tsx
// Scene: "Revenue Breakdown"
// Display Mode: overlay (SPLIT — behind-speaker layer)
// Template: none
const SCENE_WIDTH = 1000;
const SCENE_HEIGHT = 960;

// Speaker position in SCENE-LOCAL coordinates (Layout Editor will update)
export const SPEAKER = { /* ... placeholder ... */ };
export const VISIBLE_ZONES = { /* ... placeholder ... */ };

const DATA = {
  headline: '$390 Million',
  items: ['Hardware', 'Software', 'Services'],
};

const Scene5Behind: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ width: SCENE_WIDTH, height: SCENE_HEIGHT, overflow: 'hidden' }}>
      {/* BehindSpeaker layer only — large stat emerges above speaker's crown */}
    </div>
  );
};

export default Scene5Behind;
```
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/setup-agent/system.md
git commit -m "feat(setup-agent): support split overlay scene skeletons for depth compositing"
```
