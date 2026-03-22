# Shot Boundary Detection Design

**Date:** 2026-03-22
**Status:** Approved

## Problem

Uploaded videos can contain multiple camera angles (interviews, multi-cam recordings). The pipeline currently has no awareness of camera cuts — the Planner creates scenes based purely on transcript content and timing. This leads to scenes that split mid-shot or ignore natural camera transitions, producing jarring results.

## Solution

Detect shot boundaries using signals already computed in the head tracking pipeline, align them with transcript segment boundaries, and expose them to the Planner as a first-class input for scene planning.

**No new dependencies. No extra video decode passes. Negligible additional CPU cost** (one BGR→HSV conversion + a few NumPy ops per already-sampled frame).

## Architecture

```
detect_head.py (existing frame loop)
  ├── face/body detection (existing)
  └── shot boundary detection (NEW — inline signals)
        ├── face bbox displacement
        ├── face size ratio change
        ├── HSV frame diff (3 numpy ops)
        └── confidence drop
            │
            ▼
    speaker-grid.json  ← now includes "shots" array
            │
            ▼
    workspace-init.ts  ← aligns shots with transcript
            │
            ▼
    shot-boundaries.json  ← enriched with transcript context
            │
            ▼
    get_shot_boundaries MCP tool  ← Planner reads this
            │
            ▼
    Planner prompt  ← scene boundaries prefer shot boundaries
```

## 1. Shot Detection in `detect_head.py`

### Signals (computed per consecutive *sampled* frame pair)

`detect_head.py` processes every Nth frame (default N=3). "Consecutive" here means consecutive *sampled* frames (~100ms apart at 30fps). The HSV conversion uses the same `frame` BGR array already read from VideoCapture — no extra I/O. A `prev_hsv` array (~6MB for 1080p) is retained between iterations.

**Guard:** Face-based signals (bbox_score, size_score) are computed only when **both** the current and previous sampled frames have valid face detections. When either frame lacks a face, only `hsv_score` and `confidence_score` contribute.

| Signal | Computation | Threshold |
|--------|------------|-----------|
| **Face bbox displacement** | Euclidean distance of face center, normalized by frame diagonal | >25% |
| **Face size ratio** | `abs(1 - current_area / prev_area)` | >40% change |
| **HSV frame diff** | Mean absolute diff of HSV channels (weights: H=1.0, S=1.0, V=0.5) | >35 (tuned for 3-frame gap) |
| **Confidence drop** | Face detected → not detected (or vice versa) | Binary |

### Scoring

Each signal contributes a normalized score (0.0–1.0):
- `bbox_score = min(1.0, displacement / 0.5)` — linear ramp, saturates at 50% diagonal
- `size_score = min(1.0, size_ratio_change / 0.8)` — linear ramp
- `hsv_score = min(1.0, hsv_diff / 60.0)` — linear ramp
- `confidence_score = 1.0` if confidence flipped, else `0.0`

Combined score = `max(hsv_score, 0.4 * bbox_score + 0.3 * size_score + 0.3 * confidence_score)`

HSV is given independent weight via `max()` because it catches cuts where no face is present (b-roll, graphics). The face-based signals are combined additively.

**Threshold:** Combined score > 0.6 → flag as shot boundary.

### Merging

Adjacent boundaries within **500ms** are merged (using `timestamp_ms`, not frame count — handles variable fps). Keep the one with the highest score. This prevents multiple triggers from a single transition.

### Output

New `"shots"` field in the existing detect_head.py JSON output:

```json
{
  "video": { ... },
  "settings": { ... },
  "metadata": { ... },
  "frames": [ ... ],
  "shots": [
    {
      "frame": 450,
      "timestamp_ms": 15015,
      "score": 0.85,
      "signals": ["bbox_jump", "hsv_diff"]
    }
  ]
}
```

The `signals` array lists which signals fired (for debugging/logging).

## 2. Transcript Alignment in `workspace-init.ts`

When both `headTracking.shots` and `transcript` data are present, workspace-init produces `/workspace/docs/shot-boundaries.json`.

### Algorithm

1. For each detected shot boundary, find the nearest transcript segment boundary (segment.endMs or segment.startMs) within a **500ms** snap window.
2. **Tie-breaking:** If equidistant from two boundaries, prefer `endMs` of the preceding segment (natural sentence completion point).
3. If found: snap `timestamp_ms` → `snappedTo_ms`, set `aligned: true`.
4. If not found: keep raw timestamp, set `aligned: false`.
5. Attach `segmentBefore` (text of the segment ending before the cut) and `segmentAfter` (text of the segment starting after the cut).
6. `isMultiCam: true` if shots > 2 AND shots per minute > 1.0 (avoids false positives from minor jitter in long videos).
7. `averageShotDurationMs = videoDurationMs / (totalShots + 1)` — N boundaries create N+1 segments.

### Output: `shot-boundaries.json`

```json
{
  "shots": [
    {
      "timestamp_ms": 15015,
      "frame": 450,
      "score": 0.85,
      "signals": ["bbox_jump", "hsv_diff"],
      "aligned": true,
      "snappedTo_ms": 14980,
      "segmentBefore": "So the first thing we need to do is",
      "segmentAfter": "now let me show you from this angle"
    }
  ],
  "summary": {
    "totalShots": 5,
    "averageShotDurationMs": 12000,
    "alignedCount": 4,
    "isMultiCam": true
  }
}
```

### No shots fallback

If `headTracking.shots` is empty or missing (single continuous take, or head tracking not yet complete), write:

```json
{
  "shots": [],
  "summary": { "totalShots": 0, "averageShotDurationMs": 0, "alignedCount": 0, "isMultiCam": false }
}
```

## 3. MCP Tool: `get_shot_boundaries`

New tool in `packages/mcp-servers/src/asset-server.ts`, alongside `get_speaker_position`.

**Input:** None (workspace path is implicit).
**Output:** Full `shot-boundaries.json` content + a human-readable summary string.

```
Shot Boundaries (5 detected, multi-cam):
  #1  0:00.000 — start
  #2  0:15.015 → snapped 0:14.980 (score 0.85) [bbox_jump, hsv_diff]
     "So the first thing..." → "now let me show you..."
  #3  0:28.320 → snapped 0:28.100 (score 0.72) [hsv_diff]
     ...
```

This gives the Planner both structured data and a readable overview.

## 4. Planner Prompt Update

### 4a. New section in `planner/system.md`: "Shot Boundary Awareness"

```markdown
## Shot Boundaries (Camera Cuts)

Before planning scenes, call `get_shot_boundaries` to check if the source video
has camera angle changes.

### If `isMultiCam: true`:
- **Prefer** aligning scene boundaries with shot boundaries — camera cuts are
  natural transition points for changing display mode or scene type.
- **Never** split a single camera shot across two scenes with different display
  modes (e.g., don't switch from Overlay to Stacked mid-shot).
- Use `segmentBefore`/`segmentAfter` text to understand topic transitions at
  each camera switch.
- Short shots (<3 seconds) between longer shots are likely cutaway/b-roll —
  consider keeping them within the surrounding scene rather than creating a
  separate scene for them.

### If `isMultiCam: false` or no shots:
- Plan as normal using transcript content and timing.

These are guidelines, not hard constraints. Creative direction takes precedence.
```

### 4b. Add explicit step to Planner's `<task>` list

Insert a new step after reading canvas dimensions:

```
Call `get_shot_boundaries` — check for camera angle changes. If `isMultiCam: true`,
use shot boundaries as preferred scene transition points.
```

Without a procedural step, the Planner may not reliably call the tool even with the prose guidance above.

### 4c. Fix `<excluded_from_plan>` contradiction

The existing Planner prompt contains `"Multi-angle cuts — not part of the scene plan"` in the exclusions section. This directly contradicts the new shot boundary guidance. Change to:

```
Multi-angle switching logic — the Planner does not control which camera angle
plays; it uses detected shot boundaries as scene transition hints only.
```

### 4d. Update Phase 3 orchestrator instructions

In the orchestrator system prompt, add `get_shot_boundaries` to the list of tools the Planner should call during planning, alongside `analyze_transcript` and `get_speaker_position`.

## 5. Workspace CLAUDE.md Update

Add to `packages/sandbox/template/.claude/CLAUDE.md`:

```markdown
  shot-boundaries.json           # Camera cut points with transcript context (use get_shot_boundaries tool)
```

## Files Changed

| File | Change |
|------|--------|
| `packages/worker/scripts/detect_head.py` | Add HSV diff computation + shot boundary detection + scoring/merging |
| `packages/sandbox/src/workspace-init.ts` | Align shots with transcript, write `shot-boundaries.json`, update `InitPayload` type to include `shots` |
| `packages/mcp-servers/src/asset-server.ts` | New `get_shot_boundaries` tool, update `HeadTrackingData` type to include `shots` |
| `packages/sandbox/src/prompts/planner/system.md` | Add "Shot Boundary Awareness" section, add task step, fix exclusion contradiction |
| `packages/sandbox/src/prompts/orchestrator/system.md` | Add `get_shot_boundaries` to Phase 3 tool list |
| `packages/sandbox/template/.claude/CLAUDE.md` | Document `shot-boundaries.json` |

**Note:** `shot-boundaries.json` lives in `docs/` and survives workspace resets — it is derived deterministically from head tracking data and does not need regeneration. The DB stores `headTrackingData` as JSONB so no migration is needed for the new `shots` field.

## Non-Goals

- No separate worker job — detection is inline in existing head tracking
- No PySceneDetect dependency — we borrow the HSV diff algorithm (~3 numpy ops)
- No GPU acceleration — all signals are cheap CPU math
- No gradual transition detection (fades/dissolves) — only hard cuts. Can be added later.
- No automatic scene splitting — the Planner uses shots as guidance, not as rigid boundaries
