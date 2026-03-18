<example>
## Phase 4 Rough Cut Example

**Scene Plan says:**
- Scene 1 (HookTitle): 0-5000ms, stacked, animation
- Scene 2 (DataComparison): 5000-14000ms, stacked, animation
- Scene 3 (SpeakerHighlight): 14000-20000ms, overlay, emphasis

**Steps taken:**
1. Read manifest — found video item (0-60000ms) and audio item (0-60000ms) on their tracks.
2. Split video at 5000ms → got items A (0-5000ms) and B (5000-60000ms). Split audio identically.
3. Split B at 14000ms → got items B (5000-14000ms) and C (14000-60000ms). Split audio identically.
4. Split C at 20000ms → got items C (14000-20000ms) and D (20000-60000ms). Split audio identically.

5. Set transforms per plan:
   - A: position {x:0, y:1056}, size {width:1080, height:864} (speaker in bottom 45%)
   - B: position {x:0, y:1056}, size {width:1080, height:864}
   - C: position {x:0, y:0}, size {width:1080, height:1920} (fullscreen for overlay)

6. Created mockup shapes:
   - Shape on overlay track, 0-5000ms, color #3B82F6 at 20% opacity, data: {sceneFile: "HookTitle", displayMode: "stacked"}
   - Shape on overlay track, 5000-14000ms, color #10B981 at 20% opacity, data: {sceneFile: "DataComparison", displayMode: "stacked"}

7. Rendered stills at 2500ms, 9500ms, 17000ms — composition verified.
</example>
