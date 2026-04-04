# Plan 6: Face Avoidance — Animator & Layer Compositing Prompts

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add face avoidance spatial rules to the animator prompt and layer-compositing shared module so animation code never covers the speaker's face.

**Prerequisites:** Plan 5 complete (planner specifies zones, layout editor positions items).

**Dependency chain:** `Plan 1` → `Plan 2` → `Plan 3` → `Plan 4` → `Plan 5` → **`Plan 6`**

---

### Task 1: Animator prompt — face avoidance rules

**Files:**
- Modify: `packages/sandbox/src/prompts/animator/system.md`

- [ ] **Step 1: Add face avoidance section to `<rules>`**

After the "Layout First, Then Animate" section, add:

```markdown
---

## CRITICAL — Face Avoidance for Overlay Scenes

**Your #4 failure mode is covering the speaker's face with animation elements.** The face is the viewer's primary visual anchor. Covering it breaks eye contact and looks amateur.

### The rules:

**1. NEVER place content over the speaker's face.** The face is approximately `SPEAKER.bboxPx.y` to `SPEAKER.bboxPx.y + SPEAKER.bboxPx.h * 0.3` (top 30% of the speaker bbox).

**2. Primary content goes ABOVE or BELOW the speaker:**
- **Upper zone** (above `SPEAKER.bboxPx.y`): Headers, labels, stats. Use `VISIBLE_ZONES.top`.
- **Lower zone** (below `SPEAKER.bboxPx.y + SPEAKER.bboxPx.h * 0.6`): Cards, bars, detail text. Use `VISIBLE_ZONES.bottom`.

**3. Behind-speaker elements at SHOULDER height, not face height:**
- Position at `SPEAKER.centerPx.y + SPEAKER.bboxPx.h * 0.2` or lower
- This creates the depth peek effect at the body without occluding the face

**4. Flank elements on the SIDES, not center:**
- Use `VISIBLE_ZONES.left` and `VISIBLE_ZONES.right`

### Zone reference:
```
┌─────────────────────────┐
│     UPPER ZONE          │  ← Headers, stats (in-front OK)
│     (above head)        │
├─────────────────────────┤
│  ┌─┐  FACE ZONE  ┌─┐   │  ← FORBIDDEN — no elements here
│  │F│  ██████████  │F│   │
│  │L│  ██ FACE ██  │L│   │     FL/FR = flank zones
│  │A│  ██████████  │A│   │
│  │N│              │N│   │
│  │K│  SHOULDERS   │K│   │  ← Behind-speaker elements peek here
│  │ │              │ │   │
│  └─┘              └─┘   │
├─────────────────────────┤
│     LOWER ZONE          │  ← Cards, bars, text (both layers OK)
│     (below chest)       │
└─────────────────────────┘
```
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/animator/system.md
git commit -m "feat(animator): face avoidance spatial rules for overlay scenes"
```

---

### Task 2: Layer compositing shared module — face avoidance

**Files:**
- Modify: `packages/sandbox/src/prompts/shared/layer-compositing.xml`

- [ ] **Step 1: Add face_avoidance section**

After `<multi_element_scenes>`, add:

```xml
<face_avoidance>
  The speaker's face is the viewer's primary visual anchor. NEVER occlude it.

  Face region: SPEAKER.bboxPx.y to SPEAKER.bboxPx.y + SPEAKER.bboxPx.h * 0.3
  This is approximately the top 30% of the speaker's bounding box.

  Safe placement zones:
  - ABOVE head: y less than SPEAKER.bboxPx.y (use VISIBLE_ZONES.top)
  - BELOW chest: y greater than SPEAKER.bboxPx.y + SPEAKER.bboxPx.h * 0.6 (use VISIBLE_ZONES.bottom)
  - LEFT flank: x less than SPEAKER.bboxPx.x (use VISIBLE_ZONES.left)
  - RIGHT flank: x greater than SPEAKER.bboxPx.x + SPEAKER.bboxPx.w (use VISIBLE_ZONES.right)

  Behind-speaker elements:
  - Position at SHOULDER or CHEST height for the depth peek effect
  - NOT at face height — even partially occluded face looks wrong
  - Use SPEAKER.centerPx.y + offset to target below the chin

  In-front-of-speaker elements:
  - Upper zone (above head) and lower zone (below chest) ONLY
  - NEVER overlay the face, even with semi-transparent elements
</face_avoidance>
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/shared/layer-compositing.xml
git commit -m "feat(layer-compositing): face avoidance spatial rules"
```

---

### Task 3: Verify no prompt references outdated patterns

- [ ] **Step 1: Search for old overlay placement patterns**

```bash
grep -r "overlay-large\|overlay-medium\|overlay-compact\|center-card\|upper-overlay\|wide-band" packages/sandbox/src/prompts/ --include="*.md"
```

These were the old fixed overlay presets. They should be replaced by or coexist with the new speaker-position-derived transforms. If any prompt still references them as the ONLY overlay positioning method, update it to reference the new system.

- [ ] **Step 2: Commit if changes needed**

```bash
git add packages/sandbox/src/prompts/
git commit -m "chore: clean up old overlay preset references in prompts"
```
