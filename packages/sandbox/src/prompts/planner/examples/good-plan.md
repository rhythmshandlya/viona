<example>
## SCENE_PLAN.md Excerpt

### Scene 2: DataComparison
- **Display mode:** stacked
- **Dimensions:** 1080x1056 (stacked visual area)
- **Position:** {x: 0, y: 0, width: 1080, height: 1056}
- **Frames:** 150-420 (270 frames, 9s)
- **Energy:** 3 (building)
- **Type:** animation

**Visual description:**
Animated bar chart comparing old vs new metrics. Bars grow from baseline with staggered spring entrances (6-frame stagger). Numbers count up as bars reach height. Title fades in first (frames 0-20), then bars left-to-right.

**Sync points:**
- Frame 0 (5000ms): "Let's look at the numbers" → title entrance
- Frame 60 (7000ms): "The old system was..." → first bar group appears
- Frame 150 (10000ms): "But now we're seeing..." → second bar group, color shift to green

**Transitions:**
- Enter: slide-up 300ms from Scene 1
- Exit: crossfade 300ms to Scene 3

**Anchoring:**
- buildsFrom: "the question mark icon from Scene 1 morphs into the chart title"
- connectsTo: "the green highlight bar persists into Scene 3's summary"
</example>
