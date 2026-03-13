# Dimension Pipeline Fix — End-to-End

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the layoutMode mismatch that causes stacked-mode visuals to be designed for 1920px height instead of 960px, and add safety nets so dimensions are always correct.

**Architecture:** The root cause is a vocabulary mismatch: the agent tool schema offers `'split-horizontal'` but the backend checks for `'stacked'`. The fix normalizes the schema to use `'stacked'` (matching the LayoutPicker widget, the frontend types, and the Director prompt), and adds a safety-net in the Python visual generator to enforce correct `effectiveDimensions` even if upstream values are wrong.

**Tech Stack:** TypeScript (Fastify/Zod), Python (visual generator)

---

## Bug Trace

```
LayoutPicker widget → sends 'stacked'
  → LLM receives 'stacked' but Zod schema only allows 'pip'|'split-horizontal'|'split-vertical'
  → LLM forced to pick 'split-horizontal' as closest match
  → agent-tools.ts:715 checks `layoutMode === 'stacked'` → FALSE
  → pipEffective stays {1080, 1920} instead of {1080, 960}
  → Director gets wrong per-displayMode dimensions
  → scenes.json enrichment writes wrong effectiveDimensions
  → Animator designs for 1920px height → content extends below visible area
```

## Files Changed

| File | Change |
|------|--------|
| `packages/api/src/agent/agent-tools.ts` | Fix Zod enum + conditional checks (3 locations) |
| `packages/worker/src/agents/claude_visual_generator.py` | Add effectiveDimensions safety net in `_validate_scene_plan()` |

---

### Task 1: Fix the layoutMode Zod enum in agent-tools.ts

**Files:**
- Modify: `packages/api/src/agent/agent-tools.ts:652,715-716,732,822,882-883,899`

The Zod schema at line 652 defines `layoutMode: z.enum(['pip', 'split-horizontal', 'split-vertical'])`. The LayoutPicker widget sends `'stacked'`. The backend checks `layoutMode === 'stacked'`. These must all agree.

**Step 1: Fix the `plan_visuals` tool schema and conditional (lines 652, 715-716, 732)**

Change line 652 from:
```ts
layoutMode: z.enum(['pip', 'split-horizontal', 'split-vertical']),
```
to:
```ts
layoutMode: z.enum(['pip', 'stacked']),
```

Line 715-716 already checks `=== 'stacked'` — no change needed.

Line 732 casts `layoutMode as 'pip' | 'stacked'` — no change needed (it's already correct).

**Step 2: Fix the `start_generation` tool schema and conditional**

Find the `start_generation` tool definition (around line 822). It has its own `layoutMode` schema. Change it from:
```ts
layoutMode: z.enum(['pip', 'split-horizontal', 'split-vertical']),
```
to:
```ts
layoutMode: z.enum(['pip', 'stacked']),
```

Lines 882-883 already check `=== 'stacked'` — no change needed.
Line 899 casts `as 'pip' | 'stacked'` — no change needed.

**Step 3: Verify the fix**

Run:
```bash
cd packages/api && npx tsc --noEmit --pretty false 2>&1 | head -20
```
Expected: No type errors related to layoutMode.

**Step 4: Commit**

```bash
git add packages/api/src/agent/agent-tools.ts
git commit -m "fix(agent): align layoutMode enum with widget values ('stacked' not 'split-horizontal')

The LayoutPicker widget sends 'stacked' but the Zod schema only accepted
'pip'|'split-horizontal'|'split-vertical'. The backend conditional checked
for 'stacked', so pipEffective was never computed correctly for stacked
layouts — all scenes got fullscreen dimensions (1080x1920) instead of
half-canvas (1080x960)."
```

---

### Task 2: Add effectiveDimensions safety net in Python visual generator

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py` — `_validate_scene_plan()` method (starts around line 2872)

Even with the agent fix, the Director might produce a scenes.json without `effectiveDimensions`, or the field might be wrong. The `_validate_scene_plan()` method already validates/repairs frame ranges and durations — add dimension enforcement here too.

**Step 1: Find `_validate_scene_plan()` return point**

The method ends after all validations with a return dict. Just before the final return (after the sync gap checks), add effectiveDimensions injection.

**Step 2: Add effectiveDimensions enforcement**

After the existing validation/repair logic (around the end of the method, before the final return), add:

```python
# ── Enforce effectiveDimensions per scene ──
# Even if upstream got dimensions wrong, we compute them from
# layout_mode and canvas dimensions passed to the generator.
layout_mode = getattr(self, '_layout_mode', 'pip')
canvas_w = getattr(self, '_canvas_width', 1080)
canvas_h = getattr(self, '_canvas_height', 1920)
pip_w = getattr(self, '_pip_width', None) or canvas_w
pip_h = getattr(self, '_pip_height', None) or canvas_h

for scene in scenes:
    dm = scene.get("displayMode", "default")
    if dm in ("fullscreen", "overlay"):
        correct = {"width": canvas_w, "height": canvas_h}
    else:
        correct = {"width": pip_w, "height": pip_h}
    existing = scene.get("effectiveDimensions")
    if existing != correct:
        if existing:
            warnings.append(
                f"Scene {scene.get('id', '?')}: fixed effectiveDimensions "
                f"{existing} → {correct}"
            )
        scene["effectiveDimensions"] = correct
        repaired = True
```

**Step 3: Verify the attributes are set**

Search the class for where `_canvas_width`, `_canvas_height`, `_pip_width`, `_pip_height`, `_layout_mode` are stored. They should be set from the CLI args passed to the generator. If they aren't stored as instance attributes yet, store them in `__init__` or wherever the CLI args are parsed.

Search for:
```bash
cd packages/worker && grep -n "canvas_width\|pip_width\|layout_mode" src/agents/claude_visual_generator.py | head -20
```

If the attributes don't exist, add them where CLI args are parsed (likely in `__init__` or `run()`):
```python
self._layout_mode = args.layout_mode  # or however it's named
self._canvas_width = args.width
self._canvas_height = args.height
self._pip_width = getattr(args, 'pip_width', None)
self._pip_height = getattr(args, 'pip_height', None)
```

**Step 4: Verify no syntax errors**

```bash
cd packages/worker && python -c "import ast; ast.parse(open('src/agents/claude_visual_generator.py').read()); print('OK')"
```
Expected: `OK`

**Step 5: Commit**

```bash
git add packages/worker/src/agents/claude_visual_generator.py
git commit -m "fix(worker): enforce correct effectiveDimensions in scene plan validation

Safety net: _validate_scene_plan() now injects/corrects effectiveDimensions
for each scene based on displayMode and layout dimensions, so even if the
Director or enrichment step gets dimensions wrong, the Animator always
receives correct values."
```

---

### Task 3: Verify the Director prompt handles 'stacked' correctly

**Files:**
- Read-only verification: `packages/worker/src/agents/prompts/director.py:926`

**Step 1: Confirm the Director prompt already handles both values**

Line 926 of director.py:
```python
elif layout_mode == "stacked" or layout_mode == "split-horizontal":
```

This already handles both `'stacked'` and `'split-horizontal'`, so no change needed. After Task 1, the value will always be `'stacked'`, and this branch will match correctly.

**Step 2: Verify by reading the file**

```bash
grep -n 'layout_mode.*stacked\|layout_mode.*split' packages/worker/src/agents/prompts/director.py
```

Expected: line 926 shows the `or` condition. No fix needed — just confirm.

---

## Summary

| # | What | Why |
|---|------|-----|
| 1 | Fix Zod enum to `['pip', 'stacked']` | Root cause: schema mismatch means `pipEffective` is never computed for stacked layouts |
| 2 | Add `effectiveDimensions` enforcement in `_validate_scene_plan()` | Safety net: correct dimensions even if upstream is wrong |
| 3 | Verify Director prompt (read-only) | Confirm `'stacked'` is already handled — no code change needed |

After these fixes:
- The agent schema matches the widget values (`'stacked'`)
- `pipEffective` is correctly computed as `{1080, 960}` for stacked layouts
- The Director receives correct per-displayMode dimensions in its guidance text
- `effectiveDimensions` enrichment in `generate-visuals.ts` writes correct values
- The Python validator enforces correct values as a final safety net
- The Animator designs for the correct pixel area per scene
