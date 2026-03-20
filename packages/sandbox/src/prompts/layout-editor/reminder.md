<critical_reminder>
## Video — Multiple Segments, No New Splits
- After the Trim Editor, the video track has MULTIPLE video items (fillers removed). Enumerate ALL of them.
- Do NOT split video at scene boundaries. Keyframes handle display mode changes.
- For each video segment: determine which scene(s) it overlaps → set correct transform/opacity.
- Segments within ONE scene: set static transform via `update_item` (no keyframes needed).
- Segments spanning a scene boundary: add 300ms transition keyframes at the boundary.
- Do NOT split video for any reason. No punch-ins or crop changes.

## Keyframes
- Build ONE complete keyframe array for the video item covering ALL scene boundaries.
- Each boundary: 300ms transition from previous state to new state.
- Stacked speaker: `{ x: 0, y: SCENE_H, width: CANVAS_W, height: CANVAS_H - SCENE_H, opacity: 1 }`
- Fullscreen speaker: `{ opacity: 0 }` (hidden, audio continues)
- Overlay speaker: `{ x: 0, y: 0, width: CANVAS_W, height: CANVAS_H, opacity: 1 }` (full canvas)
- Format: `{ timeMs: T, props: { ... } }` — NEVER flat format.
- timeMs is RELATIVE to the item's startMs.

## Scene Items
- Type `'scene'` (NOT `'shape'`).
- Must have `data.sceneFile` (with `.tsx`), `data.displayMode`, `data.sceneName`, `data.sceneType`.
- `displayMode` API value for Stacked = `"split-screen"`.
- All scenes go on ONE overlay track, sequential, no overlap.
- Each scene gets entrance/exit keyframes matching the plan's transition type.

## Video fill
- Handled by the renderer via `objectFit: 'cover'`. Do NOT apply any crop or zoom transforms.

## Zero creative decisions
- Execute the plan mechanically. Every value comes from SCENE_PLAN.md.
</critical_reminder>
