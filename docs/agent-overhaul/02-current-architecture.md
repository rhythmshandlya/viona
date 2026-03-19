# Current Agent Architecture

## Overview

The agent runs inside a sandbox (Railway container) with an Express server (`agent-server.ts`). The API layer (`agent-router.ts`) proxies user prompts to the sandbox. The frontend streams SSE events from the API.

```
Frontend (AIAssistantPanel) → API (agent-router) → Sandbox (agent-server) → Orchestrator → Subagents
```

## The Orchestrator

- **Model:** Opus 4.6, adaptive thinking
- **System prompt:** `packages/sandbox/src/prompts/orchestrator/system.md`
- **Role:** Creative director — reads transcript, plans approach, dispatches subagents sequentially
- **Session persistence:** SDK session ID stored in DB, supports resume for multi-turn
- **Max turns:** 100

### What the orchestrator knows at startup:
- Canvas dimensions, FPS, duration
- Transcript at `/workspace/docs/transcript.json` (word-level timing)
- Current manifest state (tracks, items)
- Speaker head-tracking grid (if available)
- Theme files at `/workspace/docs/themes/`

### What the orchestrator does NOT know:
- What the video actually looks like (no frame screenshots in context)
- Quality of previous generation (no before/after comparison)
- User's style preferences beyond the brief
- What other similar videos look like (no reference examples)

## The 5 Subagents (Sequential Pipeline)

### Phase 2: Trim Editor (`trim_editor`)
- Cleans transcript: removes fillers, silences, retakes, false starts
- Creates jump cuts with 100-200ms gaps (not hard cuts)
- Adds 3-8% zoom punch-ins at cut points
- Generates captions on dedicated track
- Auto-syncs transcript after each edit

### Phase 3: Planner (`planner`)
- Reads post-trim transcript + manifest
- Plans scene-by-scene spatial layout (display modes, coordinates, energy arc)
- Outputs `SCENE_PLAN.md` with sync points, visual treatments, speaker visibility rules
- Has WebSearch/WebFetch for research
- Scene durations: 210-450 frames

### Phase 4 & 7: Visual Editor (`visual_editor`)
- **Phase 4 (Rough Cut):** Splits video at scene boundaries, sets transforms, creates colored rectangle mockup placeholders, applies B-roll
- **Phase 7 (Final Assembly):** Replaces mockups with real scene items, adds transitions (default 300ms crossfade), applies caption styling, final QC

### Phase 5: Animator (`animator`)
- Writes Remotion `.tsx` scene files per scene
- Has ALL tools including Read, Write, Edit, Bash, scene tools, render_still, asset search
- Self-healing: max 2 compilation error retries per scene
- Output: `/workspace/src/scenes/*.tsx`

### Phase 6 & 7.5: QC Reviewer (`qc_reviewer`)
- **Per-scene:** Code review (unclamped interpolate, frame bugs, missing overflow:hidden) + visual review (canvas fill, distinct elements, font readability)
- **Full-timeline:** validate_timeline tool, render stills at boundaries, flash frame detection
- **Model:** Sonnet (cheaper)
- Max 2 retries per scene

## Tool Registry

| Category | Tools | Count |
|----------|-------|-------|
| Manifest | read, add/update/remove track/item, split, caption style, update manifest | 11 |
| Scenes | write_scene_file, delete_scene_file | 2 |
| Render | render_still, trigger_rebuild | 2 |
| Widgets | show_widget, report_progress, report_plan | 3 |
| Assets | download, search Unsplash/Pexels, speaker grid | 5 |
| Viewport | get dimensions, validate code, submit verdict | 3 |
| Analysis | analyze_transcript, validate_timeline | 2 |
| Icons/Freepik | Wildcard access for animator | varies |
| General | Read, Write, Edit, Glob, Grep, Bash, WebSearch, WebFetch | 8 |

## Communication Flow

```
User sends message
  → API creates SSE stream
  → Sandbox orchestrator runs (independent of SSE connection)
  → State changes pushed to API via callbacks + SSE
  → Frontend renders: text, widgets (scene_plan, theme_picker), progress, activity
  → On disconnect: orchestrator keeps running, state pushed to API
  → /cancel is the ONLY way to stop
```

## Key Architecture Decisions
- Orchestrator runs to completion even if frontend disconnects
- Subagents are sequential (not parallel) — each phase depends on the previous
- Manifest is the shared state between all agents (mutex-locked writes)
- Transcript auto-syncs after destructive edits (remove/split items)
- Scene .tsx files are the source of truth for visual content; manifest only controls placement
