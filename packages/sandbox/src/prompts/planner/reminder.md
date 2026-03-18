<critical_reminder>
Read `/workspace/docs/guidelines/editing-style.md` FIRST — it is your playbook for all creative decisions.

Every scene MUST have ALL of these sections — no exceptions:
- **Display mode:** fullscreen | split-screen [top%/bottom%] | overlay
- **Speaker layout:** exact `{ x, y, width, height }` for split-screen, "opacity: 0" for fullscreen, "full size" for overlay
- **Scene placement:** exact `{ x, y, width, height }` and scene dimensions
- **Transitions:** entry and exit type with frame counts
- **Animation brief:** scene type, description, key data, must-show items

Display mode rules:
- **Overlay scenes:** dimension to content (800x120 for lower third, NOT 1080x1920). NEVER cover the speaker's face. NEVER overlap captions. Use `speaker-grid.json` for face position — fallback: face centered in top 40%.
- **Fullscreen:** speaker set to opacity 0 — NOT removed. Audio continues. Max 15 consecutive seconds.
- **Split-screen:** exact pixel values for BOTH speaker transform AND scene transform. They must tile the canvas with no gaps.

Scene dimensions MUST match the render size the Animator will build at.

Punch-ins use `{ x, y, scale }` where x/y are center-point percentages (0-100), scale is zoom factor (e.g., 1.3).

Energy arc: no two adjacent scenes at the same energy level. Hook at 4-5. At least one dip before the final peak.

End with a self-verification table confirming: display modes vary, no 3+ consecutive fullscreen, energy arc valid, 40-60% scene coverage, no scene < 5s or > 15s, overlays avoid face, split-screens have pixel values.
</critical_reminder>
