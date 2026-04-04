# Editing Style: Motion Graphics Focused

> All visuals are purpose-built Remotion animations. No stock footage, no templates. The result looks like a professionally produced explainer video.
> The theme (`theme.md`) controls visual design (colors, fonts, animations). This file controls WHEN and HOW animations are used.

## 1. Core Approach

- Every visual is a dense, purpose-built Remotion animation tailored to the specific content
- Captions are a SEPARATE system — never part of scene animations
- Animations are dense, not sparse — every scene should feel rich and purposeful
- The Planner covers the ENTIRE timeline: every moment is either a scene (Stacked/Fullscreen) or an overlay

## 2. Display Modes

Three display modes define the animation's ROLE in the scene — each fundamentally changes how the animation is designed, paced, and composed.

### Speaker (spatial state only — NOT planned)

Speaker video at full canvas, nothing else visible. Only exists as a transition target at video boundaries (start/end). The Planner never plans speaker-only time.

### Overlay — graphic supports the speaker

The speaker video stays full-screen. The animation floats over it as a supporting graphic — like TV news graphics, sports broadcast overlays, or YouTube stat callouts.

- **The speaker is the star.** The overlay reinforces what they're saying — a stat, a key term, a quick visual.
- **Simpler compositions.** 1–3 focused elements, single focal point. The viewer glances at the overlay and returns to the speaker.
- **Snappy timing.** Elements enter decisively, hold long enough to read, exit quickly.
- **Transparent canvas.** No background — text needs high contrast treatments for readability over video.
- **Default placement:** lower portion or center, avoiding the speaker's face.

Overlays are NOT filler, text labels, or floating badges — they are properly animated graphics, just simpler than Stacked/Fullscreen.

### Stacked — animation illustrates, speaker explains

The speaker moves to the bottom portion. The animation occupies the top portion. Both are visible simultaneously — like a teacher with a whiteboard. Default 50/50 ratio.

- **Self-explanatory visual.** If you muted the speaker, the animation should still communicate the concept through clear labels, hierarchy, and visual relationships.
- **Medium complexity.** 3–5 content elements with progressive builds, connections, and spatial storytelling.
- **Default mode for structured content** — processes, comparisons, multi-part explanations.
- Ratio calculated from source video dimensions to fit speaker without cropping.

### Fullscreen — the animation IS the content

Speaker video hidden (opacity 0). Animation takes the full canvas. The speaker's audio becomes narration.

- **Immersive visual.** The viewer watches the animation as the primary experience. Rich background, multiple depth layers, cinematic pacing.
- **Use for maximum impact.** Dramatic reveals, complex visualizations, emotional peaks.
- **Use sparingly.** If every scene is fullscreen, the speaker's personal connection is lost.

**Key distinction:** Overlay adds graphics ON the speaker. Stacked gives the animation its own space BY moving the speaker. Fullscreen replaces the speaker with the animation entirely.

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

## 5. Visual Concept Direction

Every scene's animation is driven by a **visual concept** — a metaphor or physical anchor with a primary motion. There are no rigid scene type classifications. The Planner writes a creative brief per scene, and the Animator interprets it freely.

Strong concepts describe a **physical metaphor** (thermometer, staircase, battery, gauge, ribbon, puzzle, scale, chain) with a **primary motion** (rising, splitting, filling, assembling, morphing, crumbling, unrolling). Weak concepts describe layouts ("three cards", "two columns").

No two adjacent scenes should use the same primary motion technique. Vary the energy, spatial approach, and visual vocabulary across scenes.

## 6. Pacing Rules

- Planner covers the ENTIRE timeline — every moment is either a scene (Stacked/Fullscreen) or an overlay
- Stacked/Fullscreen scenes cover 40-60% of total duration (rest is overlays)
- Scene duration: 5-15 seconds each (overlays fill remaining time)
- Elements stagger entrances by 6-10 frames minimum
- Motion from frame 0 — never a static opening frame
- Transitions go directly from one state to the next (300ms)

## 7. Scene Design Rules

### Mandatory
- Follow the active theme from `theme.md` (colors, fonts, springs, surfaces)
- `overflow: 'hidden'` on containers with moving elements
- Content must match EXACTLY what the speaker says
- Numbers, labels, items must match transcript verbatim

### Visual Quality
- Every surface has at least two animated properties (gradient shift, depth shadow, shimmer) — no flat static rectangles
- Text hierarchy: headings at primary color, supporting text at secondary
- Colors from the theme palette — never hardcoded hex values
- Minimum `s(48)` from canvas edge for any content

## 8. Do NOT Use

- B-roll stock footage or photos
- Emoji/sticker overlays
- Meme/pop culture clips
- Glitch/RGB split transitions
- Screen shake
- Captions or subtitles in animations (separate system)
- Kinetic typography as standalone technique (text animation is part of scenes)
- Ken Burns pan/zoom
- Speaker-only segments (entire timeline must be covered)
