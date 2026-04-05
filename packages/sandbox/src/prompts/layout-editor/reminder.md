<critical_reminder>
## Video — Cut at Scene Boundaries
- Source video is physically CUT: delete V0 segments for READY overlay and fullscreen scenes.
- KEEP V0 segments for stacked and FAILED overlay scenes (transform accordingly).
- Audio is NEVER deleted. Split audio at same timestamps as video to keep alignment, but never remove audio segments.
- After Trim Editor, V0 may already have multiple segments (fillers removed). Handle all of them.
- `split_item` returns `{ originalId, newId }` — original is LEFT, newId is RIGHT.

## Depth Items (V1 + V3)
- For each READY overlay scene: image on V1 (background), matte on V3 (fgr + matte).
- Use depthAssets paths from orchestrator dispatch — do NOT hardcode file paths.
- Matte item `data.startFrom` = scene startMs (offset into full-length matte video).
- Do NOT add V1/V3 items for FAILED overlay scenes.

## Track Architecture — V0 through V4
- V0: source video (cut for overlays/fullscreen, kept for stacked)
- V1: background images (READY overlay only)
- V2: behind-speaker animations (overlay depth briefs)
- V3: matte items (READY overlay only)
- V4: in-front animations / fullscreen / stacked scenes
- A0: audio — continuous, never cut

## Scene Items
- Type `'scene'` (NOT `'shape'`).
- Must have `data.sceneFile` (with `.tsx`), `data.displayMode`, `data.sceneName`.
- `displayMode` API value for Stacked = `"split-screen"`.
- Depth scenes (brief mentions "behind", "emerge-behind", "peek-sides", "cascade-behind", "background-fill", "depth-lower-third", "weave-through", "split-depth", "depth-reveal", "flank", "radial-from-speaker", "parallax-offset") go on V2. All other scenes go on V4. Sequential within each track, no overlap.
- Scene keyframes must ONLY animate `opacity` (fade in/out). NEVER include x, y, width, height, or rotation — those override the base transform and break positioning.

## Transitions — Hard Cuts
- All transitions are **hard cuts** — NO opacity fades, no crossfades.
- Items appear at startMs and disappear at endMs. Do NOT add opacity keyframes for transitions.
- V1, V3, V0, and scene items get **no fade keyframes**.

## Speaker Spatial Data
- Every OVERLAY scene item MUST have `data.speakerBbox` and `data.speakerCenter` (normalized 0-1 from `speaker.normalized`).
- Call `get_speaker_position` per overlay scene. Use `speaker.normalized` values directly.
- Write SPEAKER/VISIBLE_ZONES constants to overlay scene files in **scene-local** pixels (multiply normalized values by SCENE_WIDTH/SCENE_HEIGHT, NOT canvas dimensions).
- Do NOT write speaker data for stacked/fullscreen scenes.

## Keyframes
- Format: `{ timeMs: T, props: { ... } }` — NEVER flat format.
- timeMs is RELATIVE to the item's startMs.

## Video fill
- Handled by the renderer via `objectFit: 'cover'`. Do NOT apply any crop or zoom transforms to video items.

## Zero creative decisions
- Execute the plan mechanically. Every value comes from SCENE_PLAN.md and depthAssets.

## Content-Driven Matte Offset
- Read overlay animation brief zones (above-head, top-enter, lower-third, etc.) to determine matte shift.
- `above-head` / `top-enter` zones → shift V1+V3 DOWN (matteY = +200 to +350).
- `lower-third`, `below-chest`, `flank-*`, `full-behind` zones → no shift (matteY = 0).
- V1 and V3 always shift TOGETHER — same transform.
- Oversize matte 15% (1.15x) to prevent edge leaking.
- Shifts must be subtle and purposeful — not dramatic. When in doubt, shift less.
- Recalculate SPEAKER constants AFTER applying matte offset.

## Scene Splitting
- "Split: XBehind + XFront" → two scene items: XBehind.tsx on V2, XFront.tsx on V4.
- Both share the same startMs/endMs and SPEAKER constants.

## V1/V3 — Punch-in Only
- V1 and V3 items: NO opacity keyframes (hard cuts). Only punch-in spatial keyframes allowed.
- Base transform: centered 1.15x oversize, IDENTICAL on both V1 and V3.
- Punch-in first keyframe must HOLD the resting position (= base transform values) to prevent drift.
- V1 + V3 get IDENTICAL punch-in keyframes — they are one visual layer.
</critical_reminder>
