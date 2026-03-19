<critical_reminder>
- Split in REVERSE chronological order — always. Latest timestamp first, work backward.
- Audio and video are married — split_item is per-item, so split BOTH the video AND audio item separately at the same timestamp.
- Every mockup MUST have: data.sceneFile + data.displayMode set.
- Fullscreen scenes: speaker opacity 0 via keyframes (do NOT remove the item — audio must continue).
- Split-screen scenes: exact transform { x, y, width, height } from the plan.
- Overlay scenes: speaker stays full size — no transform change.
- Overlay tracks: type 'overlay', above video track, below caption track.
- Read speaker-grid.json for face position validation if available. Fallback: face centered in top 40%.
- Zero creative decisions — execute the plan mechanically. Every value comes from SCENE_PLAN.md.
- Keyframe timeMs is relative to the item's startMs, NOT the absolute timeline.
- Keyframes MUST use `{timeMs, props: {...}}` format. Example: `{"timeMs": 0, "props": {"opacity": 0}}`. NEVER flat `{"timeMs": 0, "opacity": 0}`.
- After splits: track which ID is the left (original) vs right (newId) portion.
- Step 0: zoom-to-fill MUST be done first. No black bars on 9:16 canvas.
- Splits are MANDATORY. Keyframes on unsplit items = wrong. Each scene boundary = split_item on BOTH video AND audio.
- Every punch-in in the plan MUST be executed. Every multi-angle cut MUST be executed.
- After splits, read the manifest and count video items — verify the count matches your expected number.
</critical_reminder>
