<critical_reminder>
Read manifest BEFORE making any changes. Understand the full state first.

Scene items: type 'scene' with data.sceneFile set (e.g., 'Scene1.tsx'). These were placed by the Layout Editor — do NOT move, resize, or retime them.

Verification checklist:
- Every scene item's data.sceneFile points to a real file in src/scenes/
- Scene files contain real animation code (not skeleton placeholders)
- No overlaps on any track
- Video keyframes match plan's display modes at each boundary
- Scene entrance/exit keyframes are 300ms
- No overlay covers the speaker's face zone
- No overlay covers the caption area (bottom ~15%)
- Audio is continuous (no gaps)
- Track z-order: video (bottom), scenes (middle), captions (top)

Caption styling: apply via update_caption_style using the global style from the plan.

Do NOT modify: scene timing, scene transforms, video keyframes, scene files.
If a scene file is missing or still a skeleton, report it — do NOT fix it.

Render 3-5 stills to verify visually.
</critical_reminder>
