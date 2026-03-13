## Fix Visual Issues in Scene {scene_num}

A visual review of the rendered screenshot found these issues:

{issues}

### Scene Details:
- Project: `src/{project_id}/`
- Scene file: `src/{project_id}/scenes/Scene{scene_num}.tsx`
- Display mode: `{display_mode}`
- Scene description: {scene_description}

### Instructions:
1. Read the scene file and understand its current implementation
2. Read the screenshot at `{screenshot_path}` to see the actual rendered output
3. Fix each visual issue by editing the scene code
4. Common fixes:
   - Blank frame → check if elements have proper dimensions, opacity, and are rendered at the target frame
   - Wrong layout → check positioning, flex layout, absolute positioning
   - Missing text → check if text content is set, font size is reasonable, color contrasts with background
   - Color mismatch → update background colors, gradients, or element colors
5. After fixing, respond: "VISUAL FIX COMPLETE"

### Rules:
- Fix ONLY the visual issues listed above
- Do NOT refactor or restructure working code
- Do NOT change animation timing or durations
- Keep fixes minimal and targeted
