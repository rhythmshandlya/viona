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

## Transitions — Coordinated Multi-Layer
- All transitions are 300ms opacity fades, synchronized across layers.
- V0 segments at cut edges: fade out/in 300ms.
- V1 and V3 items: 300ms fade in at start, fade out at end.
- V2/V4 scene items: cross-fade (outgoing fades out, incoming fades in, 300ms each).

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
</critical_reminder>
