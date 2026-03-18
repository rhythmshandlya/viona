<critical_reminder>
- Split in REVERSE chronological order — always. Latest timestamp first, work backward.
- Audio and video are married — split_item handles both automatically.
- Every mockup MUST have: data.sceneFile + data.displayMode set.
- Fullscreen scenes: speaker opacity 0 via keyframes (do NOT remove the item — audio must continue).
- Split-screen scenes: exact transform { x, y, width, height } from the plan.
- Overlay scenes: speaker stays full size — no transform change.
- Overlay tracks: type 'overlay', above video track, below caption track.
- Read speaker-grid.json for face position validation if available. Fallback: face centered in top 40%.
- Zero creative decisions — execute the plan mechanically. Every value comes from SCENE_PLAN.md.
- Keyframe timeMs is relative to the item's startMs, NOT the absolute timeline.
- After splits: track which ID is the left (original) vs right (newId) portion.
</critical_reminder>
