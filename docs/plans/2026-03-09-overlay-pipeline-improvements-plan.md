# Overlay Pipeline Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the overlay visual generation pipeline so the Director plans element positions correctly using speaker data and overlay zone rules, eliminating downstream positioning errors.

**Architecture:** Push overlay zone awareness upstream to the Director (Approach A). Reorder pipeline so `computeSpeakerGrid()` runs before the Director. Add metadata validation post-generation. Fix secondary issues in Animator prompts (conditional Background, parameterized dimensions, Math.sin ban).

**Tech Stack:** Python (prompts/director.py, prompts/animator.py, claude_visual_generator.py), TypeScript (generate-visuals.ts), Markdown (prompt templates)

---

### Task 1: Add Overlay Zone Rules to Director System Prompt

**Files:**
- Modify: `packages/worker/src/prompts/director/system.md`
- Modify: `packages/worker/src/prompts/director/display-mode-table.md`

**Step 1: Add overlay zone section to director system.md**

Find the section about display modes in `system.md` and add overlay zone rules. Add this as a new subsection after the existing display mode references:

```markdown
### OVERLAY ZONE CONSTRAINTS (CRITICAL for overlay scenes)

When planning `"overlay"` scenes, the speaker's face is visible full-screen behind the visuals.
You MUST constrain ALL element positions to safe zones:

```
┌─────────────────────────────┐
│  TOP STRIP (0-15% Y)       │  ← Titles, labels only
│                             │
│  SPEAKER ZONE (15-58% Y)   │  ← OFF-LIMITS — no elements here
│                             │
│  LOWER-THIRD (58-85% Y)    │  ← Primary content zone
│                             │
│  SUBTITLE AREA (85-100%)   │  ← Reserved for captions
└─────────────────────────────┘
```

**For every overlay scene in your plan:**
- `layout.primary.y` MUST be in lower-third (58-85%) or top strip (0-15%)
- `layout.secondary.y` MUST also be in a safe zone — NEVER in 15-58%
- If `safePlacement` data is provided, prefer the zones listed there
- Overlay visuals are SUPPORTING annotations — keep descriptions minimal
- SELF-CHECK: Before writing scenes.json, verify no overlay element has y in [15%, 58%]
```

**Step 2: Update display-mode-table.md**

In `packages/worker/src/prompts/director/display-mode-table.md`, replace the overlay row's "When to use" cell. Change:

```
Animator uses speaker grid to avoid covering face
```

to:

```
Speaker fullscreen, visual layered on top. YOU must plan element positions in safe zones only (top 0-15% or lower-third 58-85%). Speaker zone 15-58% is OFF-LIMITS. Animator refines pixel positions but YOUR layout.y values set the baseline.
```

**Step 3: Verify changes**

Read both files back and confirm:
- Zone rules are present in system.md
- display-mode-table.md no longer delegates positioning to Animator

**Step 4: Commit**

```bash
git add packages/worker/src/prompts/director/system.md packages/worker/src/prompts/director/display-mode-table.md
git commit -m "feat(prompts): add overlay zone constraints to Director prompt"
```

---

### Task 2: Pass Speaker Data to Director Prompt

**Files:**
- Modify: `packages/worker/src/agents/prompts/director.py:175-260` — `build_director_user_message()`
- Modify: `packages/worker/src/processors/generate-visuals.ts:693-698` — pre-Director speaker grid
- Modify: `packages/worker/src/agents/claude_visual_generator.py:4100-4115` — `_run_director()` call

**Step 1: Add speaker_grid parameter to `build_director_user_message()`**

In `packages/worker/src/agents/prompts/director.py`, add a new parameter `safe_placement` to the function signature (after `pip_height`):

```python
def build_director_user_message(
    project_id: str,
    formatted_transcript: str,
    width: int,
    height: int,
    duration_frames: int,
    fps: int,
    style_preset: str = "modern",
    layout_mode: str = "pip",
    style_guide: str | None = None,
    output_dir: str | None = None,
    source_width: int | None = None,
    source_height: int | None = None,
    pip_width: int | None = None,
    pip_height: int | None = None,
    safe_placement: list[str] | None = None,
) -> str:
```

Then, inside the function body, after the `user_guide_section` block (~line 242), add a speaker awareness section:

```python
    # Build speaker awareness section for overlay planning
    speaker_section = ""
    if safe_placement:
        zones = ", ".join(safe_placement)
        speaker_section = f"""
## SPEAKER POSITION DATA
Head tracking analysis shows these zones are clear of the speaker: **{zones}**

When planning overlay scenes, place elements in these safe zones.
The lower-third (58-85% Y) and top strip (0-15% Y) are the primary safe zones.
If safe_placement includes "bottom" or "bottom-left"/"bottom-right", the lower-third is confirmed safe.
If safe_placement includes "top", the top strip is confirmed safe.
"""
```

Insert `{speaker_section}` into the return string, after `{user_guide_section}`.

**Step 2: Compute speaker grid before Director in generate-visuals.ts**

In `packages/worker/src/processors/generate-visuals.ts`, after the head tracking JSON write (line 697), compute a full-video speaker grid and pass it to the Python subprocess. Add:

```typescript
    // Compute full-video speaker grid for Director overlay awareness
    let directorSafePlacement: string[] = [];
    if (project.headTrackingData) {
      const htData = project.headTrackingData as { frames?: HeadTrackingFrame[]; video?: { width: number; height: number } };
      const totalMs = (project.durationFrames || 900) / (project.fps || 30) * 1000;
      const fullGrid = computeSpeakerGrid(htData, 0, totalMs);
      directorSafePlacement = fullGrid.safePlacement;
      logger.info({ safePlacement: directorSafePlacement, occupancy: fullGrid.occupancy }, 'Pre-computed speaker grid for Director');
    }
```

Then pass `directorSafePlacement` as a CLI argument to the Python subprocess. Find where `runClaudeCodeGenerator()` is called and add a new arg `--safe-placement` with the JSON array.

**Step 3: Accept safe_placement in claude_visual_generator.py**

In `packages/worker/src/agents/claude_visual_generator.py`, in the argument parser section, add:

```python
parser.add_argument('--safe-placement', type=str, default='[]',
                    help='JSON array of safe placement zones from head tracking')
```

Then in `_run_director()` (line 4100), pass it through:

```python
import json as json_mod

safe_placement = json_mod.loads(self.args.safe_placement) if hasattr(self.args, 'safe_placement') else []

director_message = build_director_user_message(
    project_id=self.project_id,
    formatted_transcript=formatted_transcript,
    width=width,
    height=height,
    duration_frames=duration_frames,
    fps=fps,
    style_preset=style_preset,
    layout_mode=layout_mode,
    style_guide=style_guide,
    output_dir=str(self.src_dir),
    source_width=source_width,
    source_height=source_height,
    pip_width=pip_width,
    pip_height=pip_height,
    safe_placement=safe_placement,
)
```

**Step 4: Verify end-to-end**

Check that:
1. `build_director_user_message()` accepts and uses `safe_placement`
2. The CLI arg is parsed correctly
3. The TypeScript side passes the JSON array

**Step 5: Commit**

```bash
git add packages/worker/src/agents/prompts/director.py packages/worker/src/processors/generate-visuals.ts packages/worker/src/agents/claude_visual_generator.py
git commit -m "feat(pipeline): pass speaker safe-placement data to Director for overlay planning"
```

---

### Task 3: Add Metadata Validation Post-Generation

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py` — add `_validate_metadata()` method

**Step 1: Find where metadata.json is read after generation**

Search for `metadata.json` reads in `claude_visual_generator.py`. The validation should run after the Animator writes it but before render.

**Step 2: Add `_validate_metadata()` method**

Add this method to the `ClaudeVisualGenerator` class:

```python
def _validate_metadata(self, canvas_width: int, canvas_height: int) -> bool:
    """Validate metadata.json dimensions match expected canvas."""
    metadata_path = self.src_dir / "metadata.json"
    if not metadata_path.exists():
        print(f"[ClaudeGenerator] WARNING: metadata.json not found at {metadata_path}")
        return False

    import json as json_mod
    metadata = json_mod.loads(metadata_path.read_text(encoding="utf-8"))
    meta_w = metadata.get("compositionWidth", 0)
    meta_h = metadata.get("compositionHeight", 0)

    # Check for dimension flip (portrait should have width < height)
    if canvas_width < canvas_height and meta_w > meta_h:
        print(f"[ClaudeGenerator] FIXING metadata dimension flip: {meta_w}x{meta_h} -> {canvas_width}x{canvas_height}")
        metadata["compositionWidth"] = canvas_width
        metadata["compositionHeight"] = canvas_height
        metadata_path.write_text(json_mod.dumps(metadata, indent=2), encoding="utf-8")
        return True

    # Check for mismatch
    if meta_w != canvas_width or meta_h != canvas_height:
        print(f"[ClaudeGenerator] FIXING metadata dimensions: {meta_w}x{meta_h} -> {canvas_width}x{canvas_height}")
        metadata["compositionWidth"] = canvas_width
        metadata["compositionHeight"] = canvas_height
        metadata_path.write_text(json_mod.dumps(metadata, indent=2), encoding="utf-8")
        return True

    return False
```

**Step 3: Call validation after Animator phase**

Find where the Animator phase completes (after `_run_animator_sequential` or equivalent). Add:

```python
# Validate metadata dimensions
self._validate_metadata(canvas_width, canvas_height)
```

Pass `canvas_width` and `canvas_height` from the generate-visuals.ts enrichment (effectiveDimensions).

**Step 4: Commit**

```bash
git add packages/worker/src/agents/claude_visual_generator.py
git commit -m "feat(pipeline): add post-generation metadata.json dimension validation"
```

---

### Task 4: Parameterize Overlay Dimensions

**Files:**
- Modify: `packages/worker/src/agents/prompts/animator.py:643-650` — `get_display_mode_rules()`
- Modify: `packages/worker/src/prompts/animator/overlay-rules.md:1,114`

**Step 1: Add template variables to overlay-rules.md**

In `packages/worker/src/prompts/animator/overlay-rules.md`:

Line 1 — change:
```
## OVERLAY MODE — 1080×1920 (portrait, TRANSPARENT background, speaker visible behind)
```
to:
```
## OVERLAY MODE — {ew}×{eh} (portrait, TRANSPARENT background, speaker visible behind)
```

Line 114 — change:
```
**Overlay uses full canvas dimensions** — EW=1080, EH=1920 (same as fullscreen).
```
to:
```
**Overlay uses full canvas dimensions** — EW={ew}, EH={eh} (same as fullscreen).
```

**Step 2: Load overlay rules as template in animator.py**

In `packages/worker/src/agents/prompts/animator.py`, find where `OVERLAY_RULES` is loaded (it's loaded from the .md file at module level). Change it to a template:

```python
OVERLAY_RULES_TEMPLATE = _load_prompt("overlay-rules.md")
```

Then update `get_display_mode_rules()`:

```python
def get_display_mode_rules(display_mode: str, ew: int = 1080, eh: int = 960) -> str:
    """Get display-mode-specific rules to inject into scene prompt."""
    if display_mode == "overlay":
        return OVERLAY_RULES_TEMPLATE.format(ew=ew, eh=eh)
    elif display_mode == "fullscreen":
        return FULLSCREEN_RULES
    else:
        return _build_default_rules(ew, eh)
```

**Step 3: Escape existing braces in overlay-rules.md**

Since the .md file contains TSX code blocks with `{` and `}` (e.g., `style={{...}}`), these will conflict with Python's `.format()`. Either:
- Option A: Use `str.replace("{ew}", str(ew)).replace("{eh}", str(eh))` instead of `.format()`
- Option B: Escape all non-template braces in the .md file (double them: `{{` → `{{{{`)

**Option A is safer** — avoids touching dozens of lines in the .md:

```python
def get_display_mode_rules(display_mode: str, ew: int = 1080, eh: int = 960) -> str:
    if display_mode == "overlay":
        return OVERLAY_RULES_TEMPLATE.replace("{ew}", str(ew)).replace("{eh}", str(eh))
    elif display_mode == "fullscreen":
        return FULLSCREEN_RULES
    else:
        return _build_default_rules(ew, eh)
```

**Step 4: Commit**

```bash
git add packages/worker/src/prompts/animator/overlay-rules.md packages/worker/src/agents/prompts/animator.py
git commit -m "feat(prompts): parameterize overlay dimensions instead of hardcoding 1080x1920"
```

---

### Task 5: Conditional Background Import for Overlay

**Files:**
- Modify: `packages/worker/src/agents/prompts/animator.py:653-670` — `build_setup_user_message()`
- Modify: `packages/worker/src/prompts/animator/scene-template.md:73`

**Step 1: Make setup user message conditional on display mode**

Add a `has_overlay_only` parameter or check to `build_setup_user_message()`. Actually, the setup phase doesn't know if ALL scenes are overlay. The simplest fix: always create Background.tsx (for non-overlay scenes) but make the scene template conditional.

**Step 2: Update scene-template.md to skip Background import for overlay**

In `packages/worker/src/prompts/animator/scene-template.md`, line 73 says:
```
- Import `Background` from '../components/Background'
```

Change to:
```
- For non-overlay scenes: Import `Background` from '../components/Background'
- For overlay scenes: DO NOT import Background — overlay uses transparent canvas
```

This is already partially covered by overlay-rules.md ("DO NOT import or render a Background component") but the scene-template contradicts it. Fixing the contradiction is the key change.

**Step 3: Commit**

```bash
git add packages/worker/src/prompts/animator/scene-template.md
git commit -m "fix(prompts): make Background import conditional on display mode in scene template"
```

---

### Task 6: Add SpeakerGrid Guidance to Scene Template

**Files:**
- Modify: `packages/worker/src/prompts/animator/scene-template.md`

**Step 1: Add speakerGrid section**

After the `## DISPLAY MODE RULES` section (line 23), add:

```markdown
## SPEAKER GRID (overlay scenes only)
If your scene data includes a `speakerGrid` object, use it to verify placement:
- `speakerGrid.occupancy` — percentage of canvas occupied by speaker
- `speakerGrid.safePlacement` — array of safe zone names (e.g., "bottom", "top", "bottom-left")
- Place ALL elements in listed safe zones
- If occupancy is very low (<10%), the speaker may not be consistently on screen — still use standard overlay zones (top strip / lower-third)
```

**Step 2: Add speakerGrid check to the verification checklist**

In the `## SCENE IMPLEMENTATION CHECKLIST` section, add:

```markdown
- [ ] **Overlay zone compliance** — if overlay mode, all elements are in top strip (0-15%) or lower-third (58-85%), NONE in speaker zone (15-58%)
- [ ] **No Math.sin/cos** — all cyclic animations use `interpolate()`, never `Math.sin` or `Math.cos` (causes jittery video frames)
```

**Step 3: Commit**

```bash
git add packages/worker/src/prompts/animator/scene-template.md
git commit -m "feat(prompts): add speakerGrid guidance and Math.sin ban to scene template checklist"
```

---

### Task 7: Low-Occupancy SpeakerGrid Fallback

**Files:**
- Modify: `packages/worker/src/processors/generate-visuals.ts:87-179` — `computeSpeakerGrid()`

**Step 1: Add fallback logic**

After the occupancy calculation (line 142), add fallback logic:

```typescript
  // Fallback: if occupancy is very low, assume center-column speaker
  if (occupiedCells < totalCells * 0.10 && filtered.length > 10) {
    // Low occupancy likely means face detection was inconsistent
    // Fall back to conservative center-column assumption
    const centerColStart = Math.floor(cols * 0.25);
    const centerColEnd = Math.floor(cols * 0.75);
    const centerRowStart = Math.floor(rows * 0.10);
    const centerRowEnd = Math.floor(rows * 0.60);

    for (let r = centerRowStart; r < centerRowEnd; r++) {
      for (let c = centerColStart; c < centerColEnd; c++) {
        grid[r][c] = 1;
      }
    }

    // Recompute occupancy and safe placement with fallback grid
    const fallbackOccupied = grid.flat().filter((v) => v === 1).length;
    const fallbackOccupancy = `${Math.round((fallbackOccupied / totalCells) * 100)}%`;

    return {
      grid,
      occupancy: fallbackOccupancy,
      safePlacement: ['top', 'bottom', 'bottom-left', 'bottom-right'],
    };
  }
```

This ensures that even when face detection is inconsistent, the Animator still gets a meaningful "avoid center" signal.

**Step 2: Commit**

```bash
git add packages/worker/src/processors/generate-visuals.ts
git commit -m "feat(pipeline): add center-column fallback for low-occupancy speaker grids"
```

---

### Task 8: Director Layout Authority Clarification

**Files:**
- Modify: `packages/worker/src/prompts/director/system.md`

**Step 1: Clarify layout field semantics for overlay**

Find the layout field documentation in the Director system prompt. Add clarification that for overlay scenes, the Director specifies zone names rather than exact Y coordinates:

```markdown
### OVERLAY LAYOUT FIELD
For overlay scenes, `layout.primary.y` and `layout.secondary.y` should specify the zone:
- `"top"` or a value in 0-15% → top strip
- `"lower-third"` or a value in 58-85% → lower-third zone
- The Animator resolves these to exact pixel positions using the speaker grid

Do NOT place overlay elements at arbitrary Y values. The Animator cannot safely override your layout — it uses your plan as the baseline.
```

**Step 2: Commit**

```bash
git add packages/worker/src/prompts/director/system.md
git commit -m "feat(prompts): clarify Director layout authority for overlay scenes"
```

---

## Summary of All Tasks

| # | Priority | Description | Files |
|---|----------|-------------|-------|
| 1 | P0 | Director overlay zone rules | director/system.md, display-mode-table.md |
| 2 | P0 | Speaker data → Director prompt | director.py, generate-visuals.ts, claude_visual_generator.py |
| 3 | P0 | Metadata validation | claude_visual_generator.py |
| 4 | P1 | Parameterized overlay dimensions | animator.py, overlay-rules.md |
| 5 | P1 | Conditional Background import | scene-template.md |
| 6 | P1 | SpeakerGrid + Math.sin ban in checklist | scene-template.md |
| 7 | P2 | Low-occupancy grid fallback | generate-visuals.ts |
| 8 | P2 | Director layout authority | director/system.md |

Tasks 1 and 8 touch the same file (director/system.md) — implement them together or in sequence.
Tasks 5 and 6 touch the same file (scene-template.md) — implement them together.
Tasks 1-3 are P0 and should be done first.
