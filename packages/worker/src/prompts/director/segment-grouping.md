## Segment Grouping Rules

After planning individual beats, you MUST group them into **segments** before writing scenes.json.

### What is a segment?
A segment is a group of consecutive beats that share the same layout type. One animation file will be generated per segment — motion flows continuously within a segment, no hard cuts.

### Grouping rules:
1. Consecutive beats with the **same layout type** are grouped into one segment
2. A **layout change** = new segment = new animation file
3. Beats within a segment are narrative markers — the animator treats them as moments in continuous motion

### Layout types and their props:

**stacked** — Video + visuals split vertically
```json
{ "splitRatio": 70, "position": "video-first" }
```
- `splitRatio`: 0-100, percentage of canvas for video (70 = video takes 70%, visuals 30%)
- `position`: `"video-first"` (video on top) or `"visuals-first"` (visuals on top)

**overlay** — Visuals floating on top of full video
```json
{ "x": "10%", "y": "60%", "width": "40%", "height": "35%" }
```
- CSS percentage positions/dimensions for the visual overlay region

**fullscreen** — Visuals fill entire canvas, audio only (no video shown)
```json
{}
```
- No props needed — visuals take the full canvas

### Output format

scenes.json MUST use version 2 format with `segments` array (NOT flat `scenes` array):

```json
{
  "version": 2,
  "fps": 30,
  "totalFrames": 1500,
  "segments": [
    {
      "id": 1,
      "layout": "stacked",
      "layoutProps": { "splitRatio": 70, "position": "video-first" },
      "frames": [0, 720],
      "beats": [
        { "id": 1, "name": "Hook", "frames": [0, 360], "visual": "...", "syncPoints": [...] },
        { "id": 2, "name": "Problem", "frames": [360, 720], "visual": "...", "syncPoints": [...] }
      ]
    }
  ]
}
```

### Self-verification before writing scenes.json:
- [ ] Every beat is assigned to exactly one segment
- [ ] Consecutive beats in the same segment share the same layout type
- [ ] Layout changes always start a new segment
- [ ] Each segment has valid `layoutProps` for its layout type
- [ ] `frames` arrays are contiguous (segment N end = segment N+1 start)
- [ ] Beat frames are relative to video timeline (absolute), NOT segment-relative
