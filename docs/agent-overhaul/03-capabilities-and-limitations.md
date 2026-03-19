# What We Can and Cannot Do Right Now

## What Manifest V2 Can Do

Manifest v2 is a capable timeline composition format. Here's what it supports today:

### Items & Tracks
- **7 item types:** video, audio, text, image, scene, caption, shape
- **4 track types:** video, audio, overlay, caption
- Unlimited tracks, unlimited items per track
- Track ordering controls render z-index

### Positioning & Transform
- Position any item with x, y (pixels or percentages)
- Size any item with width, height (pixels or percentages)
- Rotation in degrees
- Opacity 0-1
- All of this means: split-screen layouts, picture-in-picture, overlays, speaker resize — all doable via transform

### Keyframe Animation
- Animate ANY transform property over time (position, size, rotation, opacity)
- Easing options: linear, ease-in, ease-out, ease-in-out, spring, cubic-bezier
- Time-based within item window (timeMs)
- This means: slide-ins, scale-ups, fade-ins, animated repositioning, smooth speaker resize transitions — all possible via keyframes on the manifest level

### Video Control
- Trim via startFrom
- Volume 0-2
- Playback rate 0.25-4x
- Fade in/out with duration
- Crop (x%, y%, scale) — this enables punch-in zoom by cropping into the speaker

### Filters
- brightness, contrast, saturation, blur, hue, grayscale, sepia
- Applicable to video, text, image, scene, shape items

### Captions
- Word-level timing with per-word classification
- Display modes: word-by-word, phrase, karaoke, dynamic-hierarchy
- Global styling: font, color, active color, position, animation presets, shadow/glow effects

### Scene Items (Custom Remotion Animations)
- Full React/Remotion .tsx components
- Spring animations, interpolation, staggered entrances
- Can use Three.js, SVG, any npm package
- Manifest controls scene placement (transform, timing, filters, transitions)
- Scene controls its own internal rendering (what it draws)
- Transitions (enter/exit) supported on scene items

### Operations
- Add/remove/update tracks and items
- Split items at any timestamp (auto-adjusts frameOffset for scenes)
- Set transitions on scene items
- Reorder tracks
- Update global caption style
- Batch replace entire manifest

### Analysis & Verification
- analyze_transcript — fillers, silences, retakes, false starts, content type detection
- validate_timeline — gaps, overlaps, missing files, invalid timestamps
- render_still — capture any frame as PNG for visual verification

---

## What We Cannot Do

### No Masking
- No clipping masks, no shape masks, no alpha masks on items
- Cannot mask the speaker into a circle, rounded rectangle, or custom shape via manifest
- Workaround: a scene item could render a masked element internally, but manifest has no masking primitive

### Audio Limitations
- Can add audio items (SFX, music) to any audio track at any timestamp — this works fine
- No audio keyframes (can't animate volume over time via manifest)
- No EQ, no audio effects (reverb, compression)
- No audio ducking automation — volume is a static value per item, not dynamic
- No SFX/music search tool — agent has no built-in library to find sound files (need to add one)

### No Blending Modes
- No mix-blend-mode on items (multiply, screen, overlay, etc.)
- Everything composites with normal alpha blending only

### No Item Grouping
- Items are flat — no parent-child hierarchy, no groups
- Cannot move/transform a set of items as one unit

### Caption Limitations
- Captions use global style only — no per-caption positioning or per-word animation via manifest
- Per-word animation requires a custom scene instead

### Transition Limitations
- Transitions only on scene items — video, text, image, shape items have no enter/exit transitions
- Workaround: use keyframe animation on opacity/position to simulate transitions

### Scene Editing Limitations
- Scenes are monolithic .tsx files — cannot patch a single element, must regenerate entire file
- Scene content is opaque to manifest — manifest doesn't know what's inside a scene
- No scene template library at runtime — animator writes from scratch each time
- No incremental re-render — render_still recompiles full Remotion bundle each time

### Workflow Limitations
- No undo/rollback mechanism
- No multi-language transcript support
- Content type detection is heuristic (regex-based)

Note: Scene generation will be done in parallel (multiple animator subagents running concurrently). This is a target, not a limitation.
