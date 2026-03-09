# Spatially-Aware Overlay Mode

## Context

The overlay display mode composites AI-generated visuals on top of the speaker video at 70% opacity. Currently it has no spatial awareness — visuals cover the entire frame regardless of where the speaker is, often obscuring their face and body. Head tracking data already exists in the pipeline (`detect_head.py` + MediaPipe) but is not used by the overlay compositor or the AI agents.

**Goal:** Make overlay scenes spatially aware so the Animator agent designs visuals that avoid covering the speaker. Visuals should behave like fullscreen mode (same content quality) but with transparent backgrounds and elements placed around the speaker.

---

## Design

### 1. Speaker Grid Tool (`get_speaker_grid`)

New tool added to the existing asset MCP server (`asset-server.js`).

**Input:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `startMs` | number | required | Start of time range |
| `endMs` | number | required | End of time range |
| `gridCols` | number | 6 | Grid columns |
| `gridRows` | number | 6 | Grid rows |

**Output:**

```json
{
  "grid": [
    [0, 0, 0, 0, 1, 1],
    [0, 0, 0, 1, 1, 1],
    [0, 0, 0, 1, 1, 1],
    [0, 0, 0, 1, 1, 1],
    [0, 0, 0, 0, 1, 1],
    [0, 0, 0, 0, 0, 0]
  ],
  "occupancy": "33%",
  "speakerBbox": { "x": "28%", "y": "15%", "w": "44%", "h": "72%" },
  "safePlacement": ["top-left", "top-right", "bottom-left", "bottom-right", "left"]
}
```

- `1` = speaker present, `0` = safe for visual elements
- `speakerBbox` = aggregate bounding box as percentages
- `safePlacement` = convenience summary of safe regions

**How it works:**
1. Reads `head_tracking.json` from the project folder (`src/{project_id}/head_tracking.json`)
2. Filters tracking frames by `startMs`/`endMs`
3. Projects face bboxes onto the grid — any cell overlapping the bbox in >30% of frames is marked `1`
4. Computes aggregate bbox and safe placement summary

**File:** `packages/worker/src/agents/mcp-servers/asset-server.js`

---

### 2. Data Pipeline — Head Tracking Into Project Folder

Head tracking data is written to the project folder before the agent runs, alongside `SCENE_PLAN.md` and `scenes.json`.

**Path:** `src/{project_id}/head_tracking.json`

**Format:**
```json
{
  "frames": [
    {
      "frame": 0,
      "timestamp_ms": 0,
      "face": {
        "bbox": { "x": 0.28, "y": 0.15, "width": 0.44, "height": 0.72 }
      },
      "confidence": 0.95
    }
  ],
  "metadata": { "fps": 30, "totalFrames": 900, "width": 1080, "height": 1920 }
}
```

**Write step** in `claude_visual_generator.py`, before Director phase:
```python
if self.head_tracking_data:
    ht_path = self.src_dir / "head_tracking.json"
    ht_path.write_text(json.dumps(self.head_tracking_data))
```

The `head_tracking_data` is passed from the job data, which reads it from `projects.headTrackingData` in the DB.

**Pipeline changes:**
- `generate-visuals.ts` / `plan-visuals.ts` — read `headTrackingData` from DB, include in job data passed to the Python subprocess
- `claude_visual_generator.py` — accept `head_tracking_data` param, write to `src/{project_id}/head_tracking.json`

---

### 3. Prompt Changes

#### Director (`prompts/director.py`)

Small addition to the display mode table — inform the Director that overlay scenes will be spatially aware:

```
For `"overlay"` scenes: The Animator has access to a `get_speaker_grid` tool
that returns a 6x6 heatmap of where the speaker is. Overlay visuals will be
designed with transparent backgrounds and placed around the speaker — you
don't need to worry about exact positioning, just describe WHAT to show.
```

No heatmap data injected. The Director decides *which* scenes are overlay; the Animator handles *where* to place elements.

#### Animator (`prompts/animator.py` + inline copy in `claude_visual_generator.py`)

New section: **OVERLAY MODE — SPATIAL AWARENESS**

```
When implementing an overlay scene, you MUST:

1. Call `mcp__assets__get_speaker_grid` with the scene's startMs and endMs
2. The tool returns a 6x6 grid where 1 = speaker, 0 = safe zone
3. Design your composition to place elements ONLY in safe (0) cells
4. Use TRANSPARENT backgrounds — no opaque fills, no solid color backgrounds
5. Think of overlay as floating annotations on top of the speaker

Rules:
- Background must be `transparent` or `rgba(0,0,0,0)` — never a solid color
- Place text, icons, charts in the safe zones identified by the grid
- Leave a 1-cell buffer around the speaker for breathing room
- Use subtle opacity (0.8-0.9) on overlay elements so the speaker shows through
- Prefer positioning elements at edges/corners away from the speaker

If `get_speaker_grid` returns an error, design the overlay centered
with generous margins on all sides.
```

---

### 4. Tool Registration

In `claude_visual_generator.py`:
- Add `"mcp__assets__get_speaker_grid"` to the `allowed_tools` list
- The asset MCP server already receives `--workspace` — no new config needed

---

### 5. Edge Cases

| Scenario | Behavior |
|----------|----------|
| **No head tracking data** | `head_tracking.json` not written. Tool returns error. Agent falls back to centered overlay with margins. |
| **Speaker not in frame** | Tool returns all-zero grid, `occupancy: "0%"`. Agent treats entire frame as safe. |
| **Speaker fills >50% of frame** | Tool returns high occupancy. Prompt instructs: use minimal floating annotations — small labels, subtle corner icons. |
| **Multiple people** | All detected faces contribute to the heatmap. All occupied cells marked as `1`. |

---

## Files Changed

| File | Action |
|------|--------|
| `packages/worker/src/agents/mcp-servers/asset-server.js` | Add `get_speaker_grid` tool |
| `packages/worker/src/agents/claude_visual_generator.py` | Accept + write `head_tracking_data`, register new tool |
| `packages/worker/src/processors/generate-visuals.ts` | Read `headTrackingData` from DB, pass to Python subprocess |
| `packages/worker/src/processors/plan-visuals.ts` | Read `headTrackingData` from DB, pass to Python subprocess |
| `packages/worker/src/agents/prompts/director.py` | Brief overlay note in display mode section |
| `packages/worker/src/agents/prompts/animator.py` | New "OVERLAY MODE — SPATIAL AWARENESS" section |

**No changes to:**
- Frontend compositor (`Composition.tsx`) — 70% opacity overlay stays as-is
- Head tracking pipeline (`detect_head.py`, `head-tracking.ts`) — already works
- Database schema — no new columns or migrations
- FFmpeg render pipeline — no changes

---

## Verification

1. Run head tracking on a test video, confirm `headTrackingData` is in the DB
2. Trigger visual generation — confirm `head_tracking.json` is written to `src/{project_id}/`
3. During Animator phase, confirm the agent calls `get_speaker_grid` for overlay scenes
4. Verify returned grid matches the speaker's actual position in the video
5. Verify the generated Remotion composition uses transparent backgrounds and places elements in safe cells
6. Preview the overlay in the editor — speaker should be visible, elements should be around them
