# Pipeline V2: Phases 0-3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the pipeline from init through planning. Simplify the Trim Editor, rewrite the editing style guide to match our actual vocabulary, and make the Planner produce strict, unambiguous plans.

**Architecture:** 3 files rewritten, 2 files updated, 1 file removed from scope. No new agents. No structural changes to the orchestrator — only prompt changes.

**Tech Stack:** Markdown prompts, TypeScript (orchestrator.ts for minor adjustments)

**Working notes:** `docs/superpowers/specs/2026-03-20-pipeline-v2-notes.md`

---

### Task 1: Rewrite `editing-style.md`

**Files:**
- Rewrite: `packages/sandbox/template/docs/guidelines/editing-style.md`

The current file has wrong assumptions (sparse overlays, kinetic typography as standalone technique, captions in animations, lightweight overlays). Rewrite from scratch using the vocabulary we defined.

- [ ] **Step 1: Read the current file**

Read `packages/sandbox/template/docs/guidelines/editing-style.md` to understand the full current content.

- [ ] **Step 2: Write the new editing style guide**

Replace the entire file. The new file must contain exactly these sections:

**Section 1: Core Approach**
- All visuals are dense, purpose-built Remotion animations
- No stock footage, no templates
- Captions are a SEPARATE system — never part of scene animations
- Animations are dense, not sparse

**Section 2: Spatial States & Display Modes**

4 spatial states define WHERE speaker and animation live on canvas:

1. **Speaker** (spatial state only, NOT in plans) — speaker video at full canvas. Nothing else visible. The Planner never plans speaker-only time. Every moment has either a scene (Stacked/Fullscreen) or an overlay. The Speaker state only exists as a transition target in the spatial model.

2. **Overlay** (display mode) — speaker video IS the full-screen content. Animation elements placed on it. Default placement: **lower third, center** (around speaker's chest area in a talking head). User can reposition. Avoid speaker face zone.

   **Overlay quality:** Overlays are NOT filler or basic text pop-ups. Same production quality as scene animations — viona-glass theme (glass effects, springs, motion), contextual to what the speaker is saying, meaningful durations (not <5 second flashes). Good overlays: animated icon sequences, mini data-viz that builds as speaker explains, glass cards with key terms + depth/parallax, abstract pattern animations for metaphors, logo morphing. Planner's animation brief for overlays must be just as detailed as for scenes.

3. **Stacked** (display mode) — animation gets its own space by MOVING THE SPEAKER. Speaker shrinks to bottom portion, animation occupies top portion. Two separate zones. Default mode for most scenes. Split ratio defaults to 50/50, calculated from source video dimensions to fit speaker without black bars or excessive cropping.

4. **Fullscreen** (display mode) — speaker video hidden (opacity 0, not removed), animation takes the full canvas. Speaker audio continues underneath. Used when the visual needs full viewer attention.

**Key distinction:** Overlay adds elements ON the speaker. Stacked gives the animation its own space BY moving the speaker. Fullscreen removes the speaker entirely.

**Section 3: Transitions (all 15)**

**Duration: 300ms for all transitions.** Core principle: each state defines spatial positions for speaker and animation. A transition = animate both elements to their new positions simultaneously, same speed, 300ms. No sequential animations, no mandatory Speaker state between scenes. Scenes chain directly.

Write out all 15 explicitly (copy from our notes):

Same-mode transitions (content swap, no speaker movement):
- Stacked → Stacked (scene A exits top, scene B enters top, speaker stays in bottom)
- Fullscreen → Fullscreen (scene A exits, scene B enters, speaker stays hidden)
- Overlay → Overlay (overlay A exits, overlay B enters, speaker stays full)

Cross-state transitions:
- Speaker → Stacked
- Speaker → Fullscreen
- Speaker → Overlay
- Stacked → Speaker
- Stacked → Fullscreen
- Stacked → Overlay
- Fullscreen → Speaker
- Fullscreen → Stacked
- Fullscreen → Overlay
- Overlay → Speaker
- Overlay → Stacked
- Overlay → Fullscreen

Plus: Major section boundary flash (2-3 frames, 80% white opacity).

**Section 4: Speaker Zoom/Punch-in**
- Zoom 130-150%, centered on face
- 1-2 per minute during overlay segments (speaker is full screen, overlay is a separate layer on top)
- Never during Stacked or Fullscreen scenes (speaker is moved/hidden)
- Never two within 10 seconds
- Hard cut (split video, apply crop), not animated zoom
- Planner decides timestamps, Layout Editor executes

**Section 5: Animation Scene Types**

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
| Visual metaphor (door+key, morphing logos) | Custom animation |
| Abstract/emotional/unstructured content | Custom animation (interpret metaphors into literal/abstract visuals) |

**Section 6: Layout Patterns (composition within a scene)**
- Center-dominant
- Asymmetric (60/40 or 70/30)
- Diagonal flow
- Stacked cascade (parallax depth)
- Full-bleed (single element fills canvas)
- Scattered (organic, not grid)

Rule: no two adjacent scenes use the same pattern. Bottom 12% stays clear for captions.

**Section 7: Pacing Rules**
- Planner covers the ENTIRE timeline — every moment is either a scene (Stacked/Fullscreen) or an overlay. No speaker-only gaps.
- Stacked/Fullscreen scenes cover 40-60% of total duration (rest is overlays)
- Scene duration: 5-15 seconds each (overlays fill remaining time)
- Elements stagger entrances by 6-10 frames minimum
- Motion from frame 0 — never a static opening frame
- Transitions go directly from one state to the next (300ms)

**Section 8: Scene Design Rules**
- Follow viona-glass theme (colors, fonts, springs, glass effects)
- All `interpolate()` calls need BOTH extrapolateLeft and extrapolateRight clamp
- No `useCurrentFrame()` subtraction inside Sequence
- `overflow: hidden` on containers with moving elements
- Content must match EXACTLY what the speaker says
- Numbers, labels, items must match transcript verbatim

**Section 9: Do NOT Use**
- B-roll stock footage or photos
- Emoji/sticker overlays
- Meme/pop culture clips
- Glitch/RGB split transitions
- Screen shake
- Captions or subtitles in animations (separate system)
- Kinetic typography as standalone (text animation is part of scenes)
- Ken Burns pan/zoom

- [ ] **Step 3: Verify the file reads cleanly**

Read the new file back and confirm all 9 sections are present, no leftover content from the old file.

---

### Task 2: Simplify the Trim Editor prompt

**Files:**
- Rewrite: `packages/sandbox/src/prompts/trim-editor/system.md`
- Update: `packages/sandbox/src/prompts/trim-editor/reminder.md`
- Delete content from: `packages/sandbox/src/prompts/trim-editor/examples/good-trim.md` (update to match new scope)

- [ ] **Step 1: Read the current trim editor files**

Read `system.md`, `reminder.md`, and `examples/good-trim.md`.

- [ ] **Step 2: Rewrite `system.md`**

The Trim Editor does exactly 5 things. Nothing else.

```
<role>
You are a precision audio editor. You clean up the raw timeline so it's ready for planning. Audio quality only — no visual decisions.
</role>

<rules>
## What You Do

1. Remove filler words and dead air (Tier 1, 2, 3)
2. Leave 100-200ms gaps at cut points (natural rhythm)
3. Zoom-to-fill video on 9:16 canvas (no black bars)
4. Write trim report
5. Verify audio/video marriage

## What You Do NOT Do

- No captions (separate system, handled later)
- No zoom punch-ins at edit points (Planner decides where)
- No J-cuts or L-cuts (Layout Editor decides based on scene placement)
- No jump cut coverage crops (Layout Editor handles after knowing scene positions)
- No visual decisions of any kind

## Trim Tiers

- Tier 1 (always remove): "um", "uh", "er", "ah", "hmm" + dead air >2s + false starts + retakes
- Tier 2 (context-dependent): "you know", "i mean", "like" (as filler), "basically", "sort of" — only when removing preserves grammar
- Tier 3 (shorten, don't delete): Silences 750-2000ms → compress to 400-500ms

## Core Rules

- Process ALL trims in REVERSE chronological order (latest first)
- Audio and video are MARRIED. Every split/trim/remove on video, do the SAME on audio. split_item is per-item — call it separately for each.
- After splitting, verify BOTH video AND audio items have correct startFrom values
- transcript.json updates automatically after every manifest change
- Replace removed segments with 100-200ms gaps, not hard cuts
- Never cut pauses under 300ms
- Never cut "like" as comparison, "so" as conjunction, "actually" as correction

## Zoom-to-Fill

After trimming, ensure the source video fills the 9:16 canvas with zero black bars.

1. Read manifest — note canvas (width/height) and source video dimensions
2. Calculate zoom-to-fill scale: Math.max(canvasWidth / sourceWidth, canvasHeight / sourceHeight)
3. For each video item, apply crop: { x: 50, y: 50, scale: zoomFillScale }
4. If speaker-grid.json exists, shift crop y-center toward speaker face (e.g., y: 45)
5. Render a still at frame 10 via render_still — verify zero black bars
6. If source already matches canvas aspect ratio, skip zoom-to-fill
</rules>

<task>
1. Read the analyze_transcript output provided by the orchestrator
2. Read the manifest to understand current timeline state
3. Plan trims (Tier 1 first, then Tier 2, then Tier 3). Write plan to /workspace/docs/trim-report.md
4. Apply trims in REVERSE chronological order via manifest tools
5. Apply zoom-to-fill on all video items
6. Render a still to verify no black bars
7. Verify: read manifest, confirm no gaps/overlaps, no negative timestamps, every audio item has startFrom set
</task>
```

- [ ] **Step 3: Update `reminder.md`**

```
<critical_reminder>
REVERSE chronological order for ALL trims. Audio and video are married — split_item is per-item, split BOTH separately at the same timestamp. Leave 100-200ms gaps at cut points. Never cut pauses under 300ms. After trims, apply zoom-to-fill (no black bars). Verify every audio item has startFrom set.

You do NOT do: captions, punch-ins, J-cuts, L-cuts, jump cut coverage crops, or any visual decisions.
</critical_reminder>
```

- [ ] **Step 4: Update `examples/good-trim.md`**

Update the example to only show trimming + zoom-to-fill. Remove any references to punch-ins, J-cuts, or captions.

---

### Task 3: Update the Orchestrator prompt (Phase 1 behavior)

**Files:**
- Update: `packages/sandbox/src/prompts/orchestrator/system.md` (Phase 1 and Phase 2 sections only)

- [ ] **Step 1: Read the current orchestrator prompt**

Read `packages/sandbox/src/prompts/orchestrator/system.md`.

- [ ] **Step 2: Update Phase 1 section**

Replace the Phase 1 section with:

```
### Phase 1: Brief & Clarification (no subagent)

**First — before saying anything:**
1. Read /workspace/docs/transcript.json in thinking. Identify topic, key messages, audience, tone.
2. Read /workspace/docs/user-brief.md in thinking if it exists.
3. Call mcp__analysis__analyze_transcript for deterministic filler/silence/content-type detection.

**Then — engage the user (only if needed):**
One editing style, one theme — do NOT ask about those. Only ask proactive questions about:
- Assets: Does the user have specific media (product images, logos, screenshots) to include?
- Visual metaphors: If the transcript references metaphors, interpret literally or abstractly?
- Layout preferences: Heavy on animations or keep speaker prominent?
- Emphasis: Specific sections to emphasize or downplay?

If the user brief already answers these, skip questions and proceed to Phase 2 immediately.
```

- [ ] **Step 3: Update Phase 2 section**

Replace the Phase 2 section with:

```
### Phase 2: Prepare → dispatch **Trim Editor**

Report progress: { phase: "preparing", message: "Preparing timeline..." }

Pass to Trim Editor:
- The analyze_transcript output (pre-detected fillers, silences, retakes)
- Canvas dimensions for zoom-to-fill calculation

The Trim Editor will: trim fillers, zoom-to-fill video, verify audio/video marriage. Nothing else — no captions, no punch-ins, no visual decisions.

After: Clean, trimmed, zoom-filled timeline ready for planning.
```

- [ ] **Step 4: Verify no references to J-cuts, L-cuts, or captions in Phase 2**

Grep the orchestrator prompt for "J-cut", "L-cut", "caption" references in the Phase 2 section. Remove any that exist.

---

### Task 4: Update the Planner prompt to be strict

**Files:**
- Rewrite: `packages/sandbox/src/prompts/planner/system.md`
- Update: `packages/sandbox/src/prompts/planner/reminder.md`
- Update: `packages/sandbox/src/prompts/planner/examples/good-plan.md`

- [ ] **Step 1: Read the current planner files**

Read all three planner prompt files.

- [ ] **Step 2: Rewrite `system.md`**

The Planner must produce plans using ONLY the defined vocabulary. No freestyling.

Key changes from current:
- Replace "fullscreen / split-screen / overlay" terminology with "Fullscreen / Stacked / Overlay" consistently
- Replace display mode decision tree with the 3 modes defined in our vocabulary
- Add the full 15-transition table — Planner must specify which transition to use for every scene boundary (including same-mode content swaps)
- Overlays are DENSE animations, not lightweight text labels
- No captions in the plan (separate system)
- No kinetic typography as standalone technique
- Scene types must come from the defined 10-type table
- Layout patterns must come from the defined 6-pattern set
- Every per-scene entry must specify: display mode, scene type, layout pattern, transition IN, transition OUT, exact dimensions, exact placement, animation brief
- Planner also receives analyze_transcript output (content-type detection helps scene type decisions)
- No Energy field — intensity depends on how the Animator implements the code, not the plan
- Self-verification must check transition pairs are valid (from our 15-transition table)
- After Planner writes SCENE_PLAN.md, the Orchestrator presents it to the user for approval before proceeding to Phase 4+

The per-scene schema becomes:

```
## Scene N: [Name]
**Time:** startMs – endMs
**Transcript:** "exact words"
**Display mode:** Fullscreen | Stacked [top%/bottom%] (default 50/50, derive from source dimensions) | Overlay
**Scene type:** step-cards | comparison | flowchart | data-viz | definition | timeline | hierarchy | cause-effect | progress | custom
**Layout pattern:** center-dominant | asymmetric | diagonal-flow | stacked-cascade | full-bleed | scattered

### Speaker layout (for Layout Editor)
- Speaker: "full size" (overlay) | "bottom [X]%" (stacked) | "opacity: 0" (fullscreen)

### Scene placement (for Layout Editor)
- Placement: natural language description ("above speaker", "lower third", "upper right", "top half", etc.)
- The Layout Editor translates these into exact pixel transforms

### Transition IN (from previous state)
- Previous state: Speaker | Stacked | Fullscreen | Overlay
- Transition: [exact transition name from the 15-transition table]

### Transition OUT (to next state)
- Next state: Speaker | Stacked | Fullscreen | Overlay
- Transition: [exact transition name from the 15-transition table]

### Animation brief (for Animator)
- Description: "detailed visual description"
- Key data: [items from transcript]
- Must show: exact items/numbers/terms from transcript
```

- [ ] **Step 3: Update `reminder.md`**

Add reminders about:
- Scene types must come from the 10-type table
- Display modes are Fullscreen, Stacked, Overlay (not "split-screen")
- Every scene must specify transition IN and OUT from the 15-transition table
- Overlays are dense animations, not text labels
- No captions in the plan
- Layout patterns must vary — no two adjacent same pattern

- [ ] **Step 4: Update `examples/good-plan.md`**

Rewrite the example to use the new schema. Show realistic chaining (entire timeline covered):
- Opening overlay with transition Speaker → Overlay (video start)
- Overlay → Stacked scene (direct chain, no speaker-only)
- Stacked → Stacked scene (same-mode content swap)
- Stacked → Fullscreen scene (direct chain)
- Fullscreen → Overlay (direct chain, rest animation)
- Punch-in locations during overlay segments
- Self-verification table with transition validation
- Demonstrate: no speaker-only gaps in the plan

- [ ] **Step 5: Verify consistency**

Read all three planner files back. Confirm:
- "split-screen" is replaced with "Stacked" everywhere
- All 15 transitions are referenced
- No mentions of captions, J-cuts, L-cuts, kinetic typography
- Per-scene schema has all required fields

---

### Task 5: Update Layout Editor prompt for new transitions and terminology

**Files:**
- Update: `packages/sandbox/src/prompts/layout-editor/system.md`
- Update: `packages/sandbox/src/prompts/layout-editor/reminder.md`
- Update: `packages/sandbox/src/prompts/layout-editor/examples/good-layout.md`

- [ ] **Step 1: Read the current layout editor files**

Read all three layout editor prompt files.

- [ ] **Step 2: Update `system.md`**

Key changes:
- Replace "split-screen" with "Stacked" terminology
- Remove zoom-to-fill from Step 0 (moved to Trim Editor)
- Update transition implementation section to cover all 15 transitions
- All 15 transitions are 300ms, synchronized — implement via keyframes on both speaker and scene items with matching timing. Core principle: animate both elements from current spatial positions to target positions simultaneously
- Remove any references to J-cuts, L-cuts, captions
- Layout Editor still executes the plan mechanically — no creative decisions

- [ ] **Step 3: Update `reminder.md`**

Update terminology and remove zoom-to-fill reference.

- [ ] **Step 4: Update `examples/good-layout.md`**

Update example to use "Stacked" terminology and show the new synchronized transition implementation.

---

### Task 6: Verify everything compiles and is consistent

- [ ] **Step 1: Grep for stale terminology**

Search all prompt files for:
- "split-screen" (should be "Stacked" in display mode context)
- "J-cut" or "L-cut" (should not exist in Trim Editor)
- "caption" in Trim Editor prompts (should not exist)
- "kinetic typography" as standalone (should not exist)
- "lightweight" in overlay context (should not exist)

- [ ] **Step 2: Verify the orchestrator TypeScript compiles**

Run `npx tsc --noEmit` on the sandbox package to ensure no TypeScript errors from any code changes.

- [ ] **Step 3: Read-through of all updated files**

Read each updated file one more time to confirm internal consistency.
