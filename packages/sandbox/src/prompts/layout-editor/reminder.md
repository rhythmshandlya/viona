<critical_reminder>
## Video — Cut at Scene Boundaries
- Source video is physically CUT: delete V0 segments for READY **depth** overlay and fullscreen scenes only.
- KEEP V0 segments for stacked, FAILED overlay, and **non-depth overlay** scenes (transform accordingly).
- Audio is NEVER deleted. Split audio at same timestamps as video to keep alignment, but never remove audio segments.
- After Trim Editor, V0 may already have multiple segments (fillers removed). Handle all of them.
- `split_item` returns `{ originalId, newId }` — original is LEFT, newId is RIGHT.

## Depth Items (V1 + V3)
- Only for READY **depth** overlay scenes (scenes present in depthAssets with status "ready"): image on V1 (background), matte on V3 (fgr + matte).
- Use depthAssets paths from orchestrator dispatch — do NOT hardcode file paths.
- Matte item `data.startFrom` = scene startMs (offset into full-length matte video).
- Do NOT add V1/V3 items for FAILED overlay scenes or non-depth overlay scenes (those not in depthAssets).

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

## Speaker Spatial Data & V2 Depth Scene Placement
- V2 depth scenes MUST be positioned at the speaker's location using `get_speaker_position`. Do NOT use overlay presets for V2.
- Calculate a scene box that covers the speaker area + padding (100px above/below) for animation content.
- Every **depth** overlay scene item (READY in depthAssets) MUST have `data.speakerBbox` and `data.speakerCenter` (normalized 0-1 from `speaker.normalized`).
- Write SPEAKER/VISIBLE_ZONES constants to depth overlay scene files in **scene-local** pixels (convert canvas coords to scene-local using the V2 scene's transform).
- Do NOT write speaker data for stacked, fullscreen, or non-depth overlay scenes.

## Keyframes
- Format: `{ timeMs: T, props: { ... } }` — NEVER flat format.
- timeMs is RELATIVE to the item's startMs.

## Video fill
- Handled by the renderer via `objectFit: 'cover'`. Do NOT apply any crop or zoom transforms to video items.

## Zero creative decisions
- Execute the plan mechanically. Every value comes from SCENE_PLAN.md and depthAssets.

## V1/V3 Matte Placement
- V1 and V3 ALWAYS use `{ x: 0, y: 0, width: CANVAS_W, height: CANVAS_H }` — matching the original video exactly.
- The speaker NEVER moves or shifts. No oversizing, no offsets.
- Animations (V2/V4) position themselves around the speaker's natural position using SPEAKER constants.

## Scene Splitting
- "Split: XBehind + XFront" → two scene items: XBehind.tsx on V2, XFront.tsx on V4.
- Both share the same startMs/endMs and SPEAKER constants.

## V1/V3 — Punch-in Only
- V1 and V3 items: NO opacity keyframes (hard cuts). Only punch-in spatial keyframes allowed.
- Base transform: `{ x: 0, y: 0, width: CANVAS_W, height: CANVAS_H }`, IDENTICAL on both V1 and V3.
- **Zoom-in: 300ms smooth animation.** First keyframe holds resting position to prevent drift.
- **Hold: 3 seconds minimum** (or until 500ms before scene end).
- **Zoom-out: INSTANT** (1ms snap back). Never animate the zoom-out.
- V1 + V3 get IDENTICAL punch-in keyframes — they are one visual layer.
</critical_reminder>
