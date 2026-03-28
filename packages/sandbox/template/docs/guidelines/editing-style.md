# Editing Style: Motion Graphics Focused

> All visuals are purpose-built Remotion animations. No stock footage, no templates. The result looks like a professionally produced explainer video.
> The studio theme (`studio-theme.md`) controls visual design (colors, fonts, springs, glass effects). This file controls WHEN and HOW animations are used.

## 1. Core Approach

- Every visual is a dense, purpose-built Remotion animation tailored to the specific content
- Captions are a SEPARATE system — never part of scene animations
- Animations are dense, not sparse — every scene should feel rich and purposeful
- The Planner covers the ENTIRE timeline: every moment is either a scene (Stacked/Fullscreen) or an overlay

## 2. Spatial States & Display Modes

4 spatial states define WHERE the speaker and animation live on the canvas:

### Speaker (spatial state only — NOT planned)

Speaker video at full canvas, nothing else visible. The Planner never plans speaker-only time. This state exists only as a transition target at video boundaries (start/end).

### Overlay (display mode)

Speaker video IS the full-screen content. Animation elements are placed on it.

- **Default placement:** lower third, center (around the speaker's chest area in a talking head). User can reposition.
- Avoid speaker face zone.
- Dense real animations — logo morphing, mini data-viz, animated icons, key visual metaphors. NOT text labels or lightweight annotations.

**Overlay quality:** Overlays are NOT filler or basic text pop-ups. Same production quality as scene animations — viona-glass theme (glass effects, springs, motion), contextual to what the speaker is saying, meaningful durations (not <5 second flashes).

Good overlays:
- Animated icon sequences illustrating a concept
- Mini data-viz that builds as the speaker explains
- Glass cards with key terms + depth/parallax entrance
- Abstract pattern animations that visualize metaphors
- Logo morphing sequences

The Planner's animation brief for overlays must be just as detailed as for scenes.

### Stacked (display mode)

Animation gets its own dedicated space by MOVING THE SPEAKER. Speaker shrinks to the bottom portion, animation occupies the top portion. Two separate zones.

- Default split ratio: 50/50
- Ratio calculated from source video dimensions to fit speaker without black bars or excessive cropping
- Default mode for most structured content scenes

### Fullscreen (display mode)

Speaker video hidden (opacity 0, not removed). Animation takes the full canvas. Speaker audio continues underneath.

- Used when the visual needs full viewer attention — complex diagrams, dense data, visual metaphors that need space

**Key distinction:** Overlay adds elements ON the speaker video. Stacked gives the animation its own space BY moving the speaker. Fullscreen removes the speaker entirely.

## 3. Transitions (15 total)

**Duration: 300ms for ALL transitions.** Core principle: each state defines spatial positions for speaker and animation. A transition animates both elements to their new positions simultaneously, same speed, 300ms. No sequential animations. Scenes chain directly — no mandatory Speaker state between scenes.

### Same-mode transitions (content swap, no speaker movement)

**Stacked → Stacked:** Scene A animation exits top. Scene B animation enters top. Speaker stays in bottom portion. Content swap only. 300ms.

**Fullscreen → Fullscreen:** Scene A exits (fade/scale). Scene B enters (fade/scale). Speaker stays hidden. Content swap. 300ms.

**Overlay → Overlay:** Overlay A exits. Overlay B enters its position. Speaker stays full screen. Content swap. 300ms.

### Cross-state transitions (speaker position changes)

**Speaker → Stacked:** Speaker shrinks from full canvas → bottom portion. Animation slides in from top → top portion. Simultaneous, 300ms.

**Speaker → Fullscreen:** Speaker shrinks away (scale down + fade → opacity 0). Animation expands in → full canvas. Simultaneous, 300ms.

**Speaker → Overlay:** Speaker stays full canvas (no movement). Overlay animation slides into its placement position. 300ms.

**Stacked → Speaker:** Animation slides out → off top. Speaker expands from bottom → full canvas. Simultaneous, 300ms.

**Stacked → Fullscreen:** Animation expands from top portion → full canvas. Speaker shrinks from bottom → hidden (opacity 0). Simultaneous, 300ms.

**Stacked → Overlay:** Stacked animation slides out top. Speaker expands bottom → full canvas. Overlay slides into placement position. All simultaneous, 300ms.

**Fullscreen → Speaker:** Animation shrinks away (scale down + fade). Speaker fades/scales back in → full canvas. Simultaneous, 300ms.

**Fullscreen → Stacked:** Animation contracts from full canvas → top portion. Speaker slides in from bottom → bottom portion. Simultaneous, 300ms.

**Fullscreen → Overlay:** Fullscreen animation shrinks away. Speaker fades/scales back in → full canvas. Overlay slides into placement position. All simultaneous, 300ms.

**Overlay → Speaker:** Overlay slides out. Speaker stays full canvas (no change needed). 300ms.

**Overlay → Stacked:** Overlay slides out. Speaker shrinks from full → bottom portion. Stacked animation slides in from top. All simultaneous, 300ms.

**Overlay → Fullscreen:** Overlay slides out. Animation expands in → full canvas. Speaker shrinks away → hidden. All simultaneous, 300ms.

### Major section boundary

Optional white flash frame (2-3 frames, 80% opacity) to signal new topic. Use sparingly — only between major sections.

## 4. Speaker Zoom/Punch-in

- Zoom 130-150%, centered on face
- 1-2 per minute during overlay segments (speaker is full screen, overlay is a separate layer on top)
- Never during Stacked or Fullscreen scenes (speaker is moved/hidden)
- Never two punch-ins within 10 seconds
- Hard cut (split video, apply crop), not animated zoom
- Planner decides timestamps, Layout Editor executes

## 5. Animation Scene Types

| Content pattern | Scene type |
|---|---|
| Lists, steps, reasons | Step cards |
| A vs B, pros/cons | Comparison columns |
| Process, workflow | Flowchart |
| Stats, percentages | Data visualization |
| Term definition | Definition card |
| Chronological events | Timeline |
| Structure, dependencies | Hierarchy/tree |
| Cause → effect | Arrow chain |
| Percentage, ratio | Progress indicator |
| Visual metaphor, abstract/emotional content | Custom animation |

No content is "too abstract" for a scene. If transcript content doesn't fit a structured type, use **Custom animation** with abstract visual metaphors. Example: "thinking outside the box" → animate a glowing dot (person) outside a box with other dots inside. The Planner interprets speech metaphors into literal/abstract visual concepts.

## 6. Layout Patterns (composition within a scene)

- **Center-dominant** — hero element large and centered
- **Asymmetric** — content weighted 60/40 or 70/30
- **Diagonal flow** — elements along a diagonal axis
- **Stacked cascade** — elements overlap with parallax depth
- **Full-bleed** — single element fills canvas
- **Scattered** — organic placement, not grid-aligned

**Rule:** No two adjacent scenes use the same layout pattern. Bottom 12% stays clear for captions.

## 7. Pacing Rules

- Planner covers the ENTIRE timeline — every moment is either a scene (Stacked/Fullscreen) or an overlay
- Stacked/Fullscreen scenes cover 40-60% of total duration (rest is overlays)
- Scene duration: 5-15 seconds each (overlays fill remaining time)
- Elements stagger entrances by 6-10 frames minimum
- Motion from frame 0 — never a static opening frame
- Transitions go directly from one state to the next (300ms)

## 8. Scene Design Rules

### Mandatory
- Follow viona-glass theme (colors, fonts, springs, glass effects)
- All `interpolate()` calls need BOTH `extrapolateLeft: 'clamp'` AND `extrapolateRight: 'clamp'`
- No `useCurrentFrame()` subtraction inside `<Sequence>` — frame is already 0-relative
- `overflow: 'hidden'` on containers with moving elements
- Content must match EXACTLY what the speaker says
- Numbers, labels, items must match transcript verbatim

### Visual Quality
- Every surface has at least two animated properties (gradient shift, depth shadow, shimmer) — no flat static rectangles
- Text hierarchy: headings at primary color, supporting text at secondary
- Accent elements use primary violet (#8B5CF6)
- Minimum 48px from canvas edge for any content

## 9. Do NOT Use

- B-roll stock footage or photos
- Emoji/sticker overlays
- Meme/pop culture clips
- Glitch/RGB split transitions
- Screen shake
- Captions or subtitles in animations (separate system)
- Kinetic typography as standalone technique (text animation is part of scenes)
- Ken Burns pan/zoom
- Speaker-only segments (entire timeline must be covered)
