# Overlay Pipeline Improvements Design

**Date:** 2026-03-09
**Status:** Approved
**Triggered by:** Investigation of project `9c5fc0ea-c048-4ef2-a30a-10ca383b8093`

## Problem Statement

The overlay visual generation pipeline produces overlays that cover the speaker because:
1. The Director plans element positions without knowing overlay zone rules or speaker locations
2. The Animator receives conflicting guidance (Director layout vs overlay zone rules)
3. Several secondary issues compound the problem (hardcoded dimensions, unconditional Background import, weak speakerGrid guidance)

## Root Cause Analysis

### Pipeline Flow (Current)
```
Head tracking → Director (no speaker data) → scenes.json → Enrichment (adds speakerGrid) → Animator (has grid but Director already planned bad positions)
```

### Pipeline Flow (Target)
```
Head tracking → computeSpeakerGrid → Director (has zones + safe placement) → scenes.json → Enrichment → Animator (validates against grid)
```

## Changes

### P0: Director Overlay Zone Awareness

**Files:**
- `packages/worker/src/prompts/director/system.md`
- `packages/worker/src/prompts/director/display-mode-table.md`

Add overlay-specific zone rules to Director prompt:
- Top strip: 0–15% Y (safe)
- Speaker zone: 15–58% Y (off-limits)
- Lower-third: 58–85% Y (safe)
- Bottom margin: 85–100% Y (avoid)

Director must validate all `layout.primary.y` and `layout.secondary.y` values against these zones. Add self-check table requirement to SCENE_PLAN.md output.

Update display-mode-table.md to replace "Animator uses speaker grid" hand-wave with concrete zone constraints.

### P0: Speaker Data in Director Prompt

**Files:**
- `packages/worker/src/agents/claude_visual_generator.py` → `_run_director()`
- `packages/worker/src/agents/prompts/director.py` → `build_director_user_message()`

Reorder pipeline: run `computeSpeakerGrid()` before Director (currently runs after, during enrichment). Pass `safePlacement` array to Director user message.

Director receives: "Speaker occupies [zones]. Safe placement: top-left, bottom-right, bottom-left."

### P0: Metadata Validation

**File:** `packages/worker/src/agents/claude_visual_generator.py`

After Animator writes `metadata.json`, validate:
- Width ≤ height for portrait (9:16) projects
- Width/height match effectiveDimensions from scenes.json
- Auto-fix dimension flips with warning log

### P1: Parameterized Overlay Dimensions

**Files:**
- `packages/worker/src/agents/prompts/animator.py` → `get_display_mode_rules()`
- `packages/worker/src/prompts/animator/overlay-rules.md`

Replace hardcoded `EW=1080, EH=1920` with template variables `{ew}`, `{eh}`. Make `get_display_mode_rules()` actually use its `ew`/`eh` parameters for overlay mode.

### P1: Conditional Background Import

**Files:**
- `packages/worker/src/prompts/animator/scene-template.md`
- `packages/worker/src/agents/prompts/animator.py` → `build_setup_user_message()`

Skip "create Background.tsx" and "import Background" instructions when display mode is overlay. Overlay scenes use transparent canvas — Background component is dead code.

### P1: SpeakerGrid in Scene Template

**File:** `packages/worker/src/prompts/animator/scene-template.md`

Add speakerGrid section with:
- Scene-specific occupancy data
- "Avoid speaker-occupied grid cells" instruction
- Pre-submit checklist item: "No elements in speaker zone"

### P1: IMPLEMENTATION_LOG Enforcement

**File:** `packages/worker/src/prompts/animator/scene-template.md`

Add checklist item requiring scene entry in IMPLEMENTATION_LOG.md. Currently parallel subagents skip this.

### P2: Math.sin Ban in Scene Checklist

**File:** `packages/worker/src/prompts/animator/scene-template.md`

Add to pre-submit checklist: "No Math.sin/cos for animation positions — use interpolate() instead."

### P2: Low-Occupancy SpeakerGrid Fallback

**File:** `packages/worker/src/processors/generate-visuals.ts` → `computeSpeakerGrid()`

When grid occupancy < 15%, fall back to default "center column occupied" assumption. Prevents near-empty grid that Animator ignores.

### P2: Director Layout Authority Conflict

**File:** `packages/worker/src/prompts/director/system.md`

Clarify that for overlay mode, Director specifies zone (top-strip / lower-third) rather than exact Y coordinates. Animator resolves zone to pixel position. Eliminates conflicting authority.

## Non-Goals

- Changing the parallel scene subagent architecture
- Modifying the enrichment step ordering (we move speakerGrid computation earlier instead)
- Adding new MCP tools or changing icon fetching

## Risks

- Longer Director prompt may increase token usage (~200 tokens for zone rules)
- Pipeline reorder (speakerGrid before Director) requires head tracking to complete first — should already be the case since we need the video file
