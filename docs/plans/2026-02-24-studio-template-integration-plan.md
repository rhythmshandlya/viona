# Studio Template Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the 60 studio templates in `packages/templates/` available to the Director and Animator agents during studio-preset visual generation, following the shadcn model (copy source, customize freely).

**Architecture:** When `style_preset == "studio"`, copy all studio-tagged template source dirs from `packages/templates/src/templates/` into `workspace/src/.templates/` before agents run. Pass `style_preset` through to the Animator so it knows to use templates. Enrich template tags for better discoverability. Director suggests templates per scene; Animator reads source, copies, and customizes.

**Tech Stack:** Python (visual generator orchestrator), Python f-string prompts (director.py, animator.py), JSON (meta.json tags)

---

### Task 1: Copy studio templates to workspace at generation start

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py` (around line 5310)

**Step 1: Add `_copy_studio_templates()` method**

Add this method to the `ClaudeVisualGenerator` class, before `_validate_interpolate_clamping()` (around line 2834):

```python
def _copy_studio_templates(self) -> int:
    """Copy studio-theme templates from packages/templates into the workspace.

    Copies src/templates/{slug}/ dirs into workspace/src/.templates/{slug}/
    for any template whose meta.json tags include 'studio-theme'.

    Returns number of templates copied.
    """
    templates_pkg = Path(__file__).parent.parent.parent / "templates" / "src" / "templates"
    if not templates_pkg.exists():
        print(f"[ClaudeGenerator] Templates package not found at {templates_pkg}")
        return 0

    target_dir = self.workspace / "src" / ".templates"
    if target_dir.exists():
        shutil.rmtree(target_dir)
    target_dir.mkdir(parents=True)

    copied = 0
    for template_dir in sorted(templates_pkg.iterdir()):
        if not template_dir.is_dir():
            continue
        meta_path = template_dir / "meta.json"
        if not meta_path.exists():
            continue
        try:
            with open(meta_path, encoding="utf-8") as f:
                meta = json.load(f)
            if "studio-theme" not in meta.get("tags", []):
                continue
        except (json.JSONDecodeError, KeyError):
            continue

        # Copy entire template dir
        dest = target_dir / template_dir.name
        shutil.copytree(template_dir, dest)
        copied += 1

    print(f"[ClaudeGenerator] Copied {copied} studio templates to {target_dir}")
    return copied
```

**Step 2: Call it in `generate_two_phase()` before Director runs**

Insert after `assets_dir.mkdir(parents=True, exist_ok=True)` (line 5310) and before the transcript formatting:

```python
# Copy studio templates to workspace if using studio preset
if style_preset == "studio":
    self._copy_studio_templates()
```

**Step 3: Also call it in the standalone CLI `main()` function**

Find the equivalent location in `main()` (around line 5696) and add the same conditional copy.

**Step 4: Verify**

Run: `python -c "import sys; sys.path.insert(0, 'packages/worker/src/agents'); from claude_visual_generator import ClaudeVisualGenerator; print('OK')"`

**Step 5: Commit**

```bash
git add packages/worker/src/agents/claude_visual_generator.py
git commit -m "feat: copy studio templates to workspace at generation start"
```

---

### Task 2: Pass `style_preset` to Animator methods

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py` (lines 4134, 4726, and all 6 call sites)

**Step 1: Add `style_preset` param to `_run_animator()`**

Change line 4134 signature from:
```python
async def _run_animator(
    self,
    width: int,
    height: int,
    duration_frames: int,
    fps: int,
) -> dict[str, Any]:
```
To:
```python
async def _run_animator(
    self,
    width: int,
    height: int,
    duration_frames: int,
    fps: int,
    style_preset: str = "modern",
) -> dict[str, Any]:
```

**Step 2: Add `style_preset` param to `_run_animator_sequential()`**

Same change at line 4726.

**Step 3: Pass `style_preset` through in `_run_animator_sequential()` fallback**

At line 4839 (the fallback call inside sequential):
```python
return await self._run_animator(
    width=width, height=height,
    duration_frames=duration_frames, fps=fps,
    style_preset=style_preset,
)
```

**Step 4: Update all call sites in `generate_two_phase()`**

At lines 5371-5387, add `style_preset=style_preset` to all 3 calls:
```python
animator_result = await self._run_animator_sequential(
    width=width, height=height,
    duration_frames=duration_frames, fps=fps,
    style_preset=style_preset,
)
# ... fallback:
animator_result = await self._run_animator(
    width=width, height=height,
    duration_frames=duration_frames, fps=fps,
    style_preset=style_preset,
)
# ... else:
animator_result = await self._run_animator(
    width=width, height=height,
    duration_frames=duration_frames, fps=fps,
    style_preset=style_preset,
)
```

**Step 5: Update all call sites in standalone `main()`**

At lines 5770-5786, same change — add `style_preset=args.style_preset` to all 3 calls.

**Step 6: Pass `style_preset` to `build_animator_user_message()`**

In `_run_animator()` at line 4170, change:
```python
animator_message = build_animator_user_message(self.project_id)
```
To:
```python
animator_message = build_animator_user_message(self.project_id, style_preset=style_preset)
```

Do the same in `_run_animator_sequential()` where it calls `build_animator_scene_message()` or builds the user message.

**Step 7: Inject STUDIO_TEMPLATES.md into Animator context**

In `_run_animator()`, after building `animator_message` and before creating the client, add:

```python
# Inject template catalog for studio preset
if style_preset == "studio":
    catalog_path = self.workspace / "src" / "STUDIO_TEMPLATES.md"
    if catalog_path.exists():
        catalog_content = catalog_path.read_text(encoding="utf-8")
        animator_message += f"\n\n## AVAILABLE STUDIO TEMPLATES\n\n{catalog_content}"
        print(f"[ClaudeGenerator] Injected studio template catalog into Animator prompt")
```

Do the same in `_run_animator_sequential()`.

**Step 8: Verify syntax**

Run: `python -c "import ast; ast.parse(open('packages/worker/src/agents/claude_visual_generator.py', encoding='utf-8').read()); print('OK')"`

**Step 9: Commit**

```bash
git add packages/worker/src/agents/claude_visual_generator.py
git commit -m "feat: pass style_preset to Animator, inject template catalog"
```

---

### Task 3: Update `build_animator_user_message()` to accept `style_preset`

**Files:**
- Modify: `packages/worker/src/agents/prompts/animator.py` (line 1818)

**Step 1: Update function signature**

Change line 1818 from:
```python
def build_animator_user_message(project_id: str) -> str:
```
To:
```python
def build_animator_user_message(project_id: str, style_preset: str = "modern") -> str:
```

**Step 2: Add studio template instructions to the user message**

At the end of the returned f-string (before the closing `"""`), add a conditional block. Since this is an f-string, we need to build it with concatenation:

```python
def build_animator_user_message(project_id: str, style_preset: str = "modern") -> str:
    """Build the user message for the Animator agent."""
    composition_id = project_id.replace("_", "-")

    base_message = f"""
    ... (existing content unchanged) ...
    """

    if style_preset == "studio":
        base_message += f"""

## STUDIO TEMPLATES (shadcn-style — copy source, customize freely)

You have 60 pre-built templates in `src/.templates/`. These are **starting points for direct reuse**
AND **style references** for the studio theme.

### How to use templates:
1. Check `scenes.json` for `suggestedTemplates` per scene — the Director matched templates to scenes
2. Read the template source: `src/.templates/{{slug}}/index.tsx`, `schema.ts`, `components/`
3. Copy the code into your `Scene{{N}}.tsx` and customize:
   - Replace data with scene-specific content from the plan
   - Adjust frame ranges to match the scene's `[startFrame, endFrame]`
   - Map sync points to animation triggers
   - Customize colors to match the project's palette in `constants.ts`
4. If no template fits the scene, create custom visuals — but read 2-3 templates first
   to absorb the studio theme (card styles, DotGrid, typography, spring configs)

### When to use a template:
- The template matches 60%+ of what the scene needs → copy and customize
- Multiple templates each cover part of the scene → combine elements from both

### When to go custom:
- No template is close to what the scene needs
- The scene requires a unique layout that no template provides
- But STILL follow the studio design system (DotGrid background, card containers, font pairs)

**Templates are source code you own. Copy, modify, combine freely.**
"""

    return base_message
```

**Step 3: Verify syntax**

Run: `python -c "import ast; ast.parse(open('packages/worker/src/agents/prompts/animator.py', encoding='utf-8').read()); print('OK')"`

**Step 4: Commit**

```bash
git add packages/worker/src/agents/prompts/animator.py
git commit -m "feat: add studio template instructions to Animator user message"
```

---

### Task 4: Update `<studio_templates>` prompt sections in Animator

**Files:**
- Modify: `packages/worker/src/agents/prompts/animator.py` (lines 1759-1814 and 3670-3725)

**Step 1: Update first copy (monolithic — line 1759)**

Replace the `<studio_templates>` section to emphasize direct reuse as primary and style reference as secondary:

```
<studio_templates>
## STUDIO THEME — TEMPLATE LIBRARY (shadcn-style)

Templates are **source code you own**. The primary use is **direct reuse**: copy a template into
your scene file, customize the data/timing/layout, and ship. The secondary use is **style reference**:
reading templates teaches you the studio aesthetic even when building custom scenes.

### Template Location:
Templates are in `src/.templates/{slug}/`. Each has:
- `index.tsx` — Main component (copy this into your Scene file)
- `schema.ts` — Props/data model (shows what's configurable)
- `constants.ts` — Color and timing tokens
- `components/` — Sub-components (CardShell, TrendBadge, etc.)
- `meta.json` — Description and tags

### Workflow:
1. Check `scenes.json` → `suggestedTemplates` for Director's recommendations
2. Read the suggested template's `index.tsx` to understand the component
3. Copy the code into `scenes/Scene{N}.tsx`, adapting:
   - Data values → scene-specific content from the plan
   - Frame ranges → scene's [startFrame, endFrame]
   - Sync points → animation triggers
   - Colors → project palette from constants.ts
4. Copy needed sub-components from `components/` into your `components/` dir
5. If no template fits → create custom, but follow the studio design system below

### Studio Design System (MANDATORY when style is "Studio"):

**DotGrid Background (MUST include in EVERY scene):**
... (keep existing DotGrid, Card, Font, Spring sections unchanged) ...

**If NO template matches:** Create custom visuals but ALWAYS maintain:
- DotGrid SVG background (80px grid, r=3 dots, visible opacity)
- Card-based layout
- Studio color palette (#0B0F1A, #6366F1, #F8FAFC)
- Font pair from the list above
</studio_templates>
```

**Step 2: Update second copy (modular — line 3670)**

Apply the same changes to the second `<studio_templates>` section.

**Step 3: Verify syntax**

Run: `python -c "import ast; ast.parse(open('packages/worker/src/agents/prompts/animator.py', encoding='utf-8').read()); print('OK')"`

**Step 4: Commit**

```bash
git add packages/worker/src/agents/prompts/animator.py
git commit -m "feat: update studio_templates sections to emphasize direct reuse"
```

---

### Task 5: Add `suggestedTemplates` field to Director prompt

**Files:**
- Modify: `packages/worker/src/agents/prompts/director.py` (lines 999-1062, 615-662)

**Step 1: Add field to scenes.json schema example**

In the scenes.json schema (around line 1049), add `suggestedTemplates` to the scene object, after `"images"`:

```json
      "images": [...],
      "suggestedTemplates": ["stat-counter", "bar-chart-race"]
```

**Step 2: Add instruction about template suggestions**

In the studio style preset description (line 615-662), strengthen the template suggestion instruction:

```python
"studio": """...existing content...

**TEMPLATE SUGGESTIONS (Studio only):**
For each scene, check the STUDIO_TEMPLATES.md catalog. If a template matches the scene's purpose,
add a `"suggestedTemplates"` array to the scene in scenes.json with 1-2 template slugs.
The Animator will read the template source and use it as a starting point.
If no template fits, omit the field — the Animator will create custom visuals in the studio style.

Examples:
- Scene showing revenue growth with a big number → `["stat-counter"]`
- Scene comparing two products → `["versus-screen", "pros-cons"]`
- Scene with a timeline of events → `["timeline-cascade"]`
- Scene with a step-by-step process → `["process-flow"]`
""",
```

**Step 3: Add to the REMEMBER section**

In the REMEMBER section (around line 1092), add:
```
- For studio preset: suggest matching template slugs in `suggestedTemplates` per scene
```

**Step 4: Verify syntax**

Run: `python -c "import ast; ast.parse(open('packages/worker/src/agents/prompts/director.py', encoding='utf-8').read()); print('OK')"`

**Step 5: Commit**

```bash
git add packages/worker/src/agents/prompts/director.py
git commit -m "feat: add suggestedTemplates field to Director scenes.json schema"
```

---

### Task 6: Enrich template meta.json tags

**Files:**
- Modify: All 60 `packages/templates/src/templates/*/meta.json` files

**Step 1: Write a script to batch-update tags**

Create a temporary Python script that reads each meta.json, adds enriched tags based on the template slug and description, and writes back. The goal is 15-25 tags per template covering synonyms, use cases, and visual patterns.

Tag enrichment strategy per template type:
- **Stats templates** (stat-counter, stat-bar-chart, etc.): add `revenue, MRR, ARR, KPI, headline-number, big-reveal, wow-moment, single-metric, data-visualization`
- **Comparison templates** (versus-screen, pros-cons, before-after): add `side-by-side, two-column, matchup, comparison-layout, decision, evaluation`
- **Timeline/process templates**: add `steps, workflow, sequence, chronological, roadmap, how-to, tutorial`
- **Text/quote templates**: add `typography, kinetic-text, tagline, message, statement, emphasis`
- **Chart templates**: add `data-viz, graph, trend, analytics, numbers, percentage`
- **Transition templates**: add `scene-change, wipe, effect, between-scenes`
- **Social/engagement**: add `youtube, instagram, tiktok, subscribe, engagement, notification`

**Step 2: Run the script**

**Step 3: Regenerate STUDIO_TEMPLATES.md with enriched tags**

Update `packages/worker/workspace/src/STUDIO_TEMPLATES.md` to include the enriched tags for each template entry.

**Step 4: Verify all meta.json files are valid JSON**

Run: `python -c "import json, pathlib; [json.loads(f.read_text()) for f in pathlib.Path('packages/templates/src/templates').glob('*/meta.json')]; print('All 60 meta.json files valid')"`

**Step 5: Commit**

```bash
git add packages/templates/src/templates/*/meta.json
git add packages/worker/workspace/src/STUDIO_TEMPLATES.md
git commit -m "feat: enrich template tags for better discoverability (15-25 per template)"
```

---

### Task 7: End-to-end verification

**Step 1: Verify template copy works**

```python
# Quick test: simulate what generate_two_phase does
import json, shutil
from pathlib import Path

templates_pkg = Path("packages/templates/src/templates")
target = Path("/tmp/test_templates")
if target.exists():
    shutil.rmtree(target)
target.mkdir(parents=True)

copied = 0
for d in sorted(templates_pkg.iterdir()):
    if not d.is_dir():
        continue
    meta_path = d / "meta.json"
    if not meta_path.exists():
        continue
    meta = json.loads(meta_path.read_text())
    if "studio-theme" in meta.get("tags", []):
        shutil.copytree(d, target / d.name)
        copied += 1

print(f"Copied {copied} templates")  # Should be 60
```

**Step 2: Verify style_preset flows through**

Check that `_run_animator()` and `_run_animator_sequential()` both accept and pass through `style_preset`.

**Step 3: Verify prompt syntax**

```bash
python -c "import ast; ast.parse(open('packages/worker/src/agents/claude_visual_generator.py', encoding='utf-8').read()); print('generator OK')"
python -c "import ast; ast.parse(open('packages/worker/src/agents/prompts/animator.py', encoding='utf-8').read()); print('animator OK')"
python -c "import ast; ast.parse(open('packages/worker/src/agents/prompts/director.py', encoding='utf-8').read()); print('director OK')"
```

**Step 4: Commit**

```bash
git commit --allow-empty -m "chore: verified studio template integration end-to-end"
```
