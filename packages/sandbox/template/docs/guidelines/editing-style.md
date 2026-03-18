Now# Editing Style: Motion Graphics Focused

> Use when the video is explanatory — tutorials, educational content, presentations, technical breakdowns, thought leadership.
> All visuals are purpose-built Remotion animations. No stock footage. The result looks like a professionally produced explainer video.

## Core Approach

The speaker explains concepts. Viona listens to what's being said, identifies moments that benefit from visual reinforcement, and generates custom animated scenes that illustrate the concept in real time. Every visual is tailored to the specific content — not generic, not stock, not template.

The studio theme (`viona-glass.md`) controls all visual design decisions (colors, fonts, springs, glass effects). This file controls WHEN and HOW animations are used.

## Technique Selection

### Primary Techniques

**1. Explanatory Scene Animations**
Custom Remotion `.tsx` scenes that visualize what the speaker is saying. These are the backbone of this editing style.

Scene types by content:

| Speaker says... | Scene type | Example |
|---|---|---|
| Lists items or steps | **Numbered step cards** | Glass cards appearing one by one with spring animation, numbered 1-2-3 |
| Compares two+ things | **Side-by-side comparison** | Two glass columns with labels, checkmarks, values animating in |
| Describes a process/flow | **Animated flowchart** | Nodes connected by lines, each node entering with stagger, lines drawing between them |
| Mentions data/numbers/stats | **Data visualization** | Animated bar chart, progress rings, or counting numbers |
| Defines a term/concept | **Definition card** | Glass card with term highlighted in violet, definition text fading in below |
| Tells a chronological story | **Timeline** | Horizontal or vertical timeline with events appearing sequentially |
| Explains a hierarchy/structure | **Tree/org diagram** | Nodes branching out from center with staggered spring entrances |
| Describes cause → effect | **Arrow chain** | Elements connected by animated arrows, left-to-right flow |
| Mentions a quote or key phrase | **Kinetic typography** | Key words scale up with spring, hold, then settle into position |
| Gives a percentage or ratio | **Progress indicator** | Animated ring/bar filling to the value with counting number |

**2. Three Display Modes**

Every scene is shown in one of three modes. Viona decides which mode based on the scene complexity and whether the speaker's expression matters at that moment.

**Fullscreen** — scene takes the entire canvas, speaker audio continues underneath.
- When: complex visuals with 5+ elements, detailed diagrams, data-heavy charts
- Transition in: speaker footage fades out (12 frames) while scene fades in
- Transition out: scene fades out, speaker fades back in
- Duration: 5-15 seconds typically
- Rule: never more than 3 consecutive fullscreen scenes — break with split-screen or speaker-only

**Split-screen** — speaker video animates to the bottom 40-60% of the canvas, scene fills the top 30-60%.
- When: the visual is simple enough to read at reduced size AND the speaker's expression/gestures add value
- Transition in: speaker video scales down + translates down (20 frames, spring), scene enters from top with fade
- Transition out: scene fades out (12 frames), speaker scales back to full (20 frames, spring)
- The dividing line is NOT hard — speaker fades into the scene area slightly (no harsh cut)
- Default mode — use this most often

**Transparent overlay** — scene rendered without a background, composited directly on top of the speaker video.
- When: lightweight annotations — floating labels, arrows, small accent graphics, single stat callouts
- Max 1-3 elements visible at once
- **CRITICAL: NEVER place overlays near the speaker's face.** Use dead zones only — sides, top corners, bottom area
- Enter: fade + slight translateY (12px up), spring
- Exit: fade out (8 frames)

**3. Punch-in on Speaker**
Hard cut to a cropped/zoomed version of the speaker at emphasis moments. Use BETWEEN scene segments when the speaker is making a direct point without needing a visual.
- Crop to ~130-150% of original frame, centered on face
- 1-2 per minute max
- Only during speaker-only segments, never during a scene

**4. Jump Cuts**
Remove all filler words, silences >750ms, retakes, false starts. Tighten pacing.
- Add 100-200ms gaps at cut points (not hard cuts)
- 3-8% zoom punch-in at each cut point to mask the jump

**5. Kinetic Typography**
Key phrases animate on screen as the speaker says them. Used for emphasis when a full scene would be overkill.
- Text enters with spring (scale 0.8 → 1.0, opacity 0 → 1, translateY 20 → 0)
- Hold for 1.5-3 seconds while speaker says the phrase
- Exit with fade-out (opacity 1 → 0, 12 frames)
- Color: `COLORS.primary` (#8B5CF6) for the key word, `COLORS.textPrimary` for surrounding text
- Positioned center-screen or lower third depending on context
- Never overlap with a scene — kinetic text is used in speaker-only segments

### Secondary Techniques

**6. Heading/Topic Text**
Section title that appears at section transitions. Positioned at top of frame.
- Glass pill background with topic label
- Enter: slide down from top + fade (15 frames)
- Hold: entire section duration
- Exit: fade out when section changes

**7. Lower Thirds**
Speaker name + title at video start. Topic labels at section changes.
- Glass card style from `viona-glass.md` theme
- Position: bottom-left, above caption area
- Enter: slide right + fade (15 frames, spring)
- Hold: 3-5 seconds
- Exit: fade out (12 frames)

~~**SFX & Background Music** — later phase, not in scope for now.~~

**8. Flash/White Frame**
Brief flash between major section transitions. Signals "new topic" to the viewer.
- Duration: 2-3 frames only
- Color: white at 80% opacity (not pure white — matches the glass aesthetic)
- Use sparingly: only between major sections, not between every scene

**9. On-Screen Bullet Points**
Key points building up as the speaker lists them. Use when the speaker is listing 3-7 items.
- Each bullet enters with spring animation as the speaker says it
- Glass card background containing all bullets
- Active bullet: `COLORS.primary` text, previous bullets: `COLORS.textSecondary`
- Position: split-screen mode (speaker bottom, bullets top) or overlay (right side)

### Do NOT Use
- B-roll stock footage or photos
- Ken Burns pan/zoom
- Emoji/sticker overlays
- Meme/pop culture clips
- Glitch/RGB split transitions (doesn't match the polished glass aesthetic)
- Screen shake (too aggressive for educational content)

## Pacing Rules

### Visual Density
- **Never more than 8 seconds** of speaker-only without a visual element (scene, overlay, kinetic text, or heading)
- **Scenes should cover 40-60%** of total video duration
- **Speaker-only segments: 20-35%** of total duration — these are breathing room
- **Overlays/kinetic text: 10-20%** of total duration — lightweight reinforcement

### Scene Timing
- Scene duration: **5-15 seconds** per scene animation
- Elements within a scene: stagger entrances by **6-10 frames** minimum
- No element should enter after 70% of the scene duration — leave time for the viewer to absorb
- Scene must have motion from **frame 0** — never a static opening frame

### Transition Timing
- Speaker → fullscreen scene: **12-15 frames** crossfade
- Speaker → split-screen: **20 frames** speaker resize (spring) + scene fade-in
- Scene → speaker: **12 frames** scene fade-out + speaker restore
- Between scenes: **6-10 frame** gap with speaker visible (don't chain scenes back-to-back)

### Punch-in Frequency
- **1-2 per minute** in speaker-only segments
- Never during a scene or overlay
- Never two punch-ins within 10 seconds of each other

## Scene Design Rules

### Mandatory
- Every scene follows `viona-glass.md` theme — colors, fonts, springs, glass effects
- All `interpolate()` calls must have BOTH `extrapolateLeft: 'clamp'` AND `extrapolateRight: 'clamp'`
- No `useCurrentFrame()` subtraction inside `<Sequence>` — frame is already 0-relative
- `overflow: 'hidden'` on all containers with moving elements
- Minimum **3 distinct animated elements** per scene
- Motion from **frame 0** — never a static opening frame

### Visual Quality
- Every glass card uses the full glass recipe (bg, backdrop-filter, border, borderTop specular, shadow)
- Text hierarchy: headings at `COLORS.textPrimary`, supporting text at `COLORS.textSecondary`
- Accent elements use `COLORS.primary` (#8B5CF6)
- Numbers and data use monospace font
- Minimum 48px from canvas edge for any content

### Content Accuracy
- Scene content must match EXACTLY what the speaker is saying — not a loose interpretation
- If speaker says "three reasons" the scene must show exactly three items, not two or four
- Numbers shown must match numbers spoken
- Labels must use the speaker's terminology, not synonyms

## Display Mode Decision Tree

```
Is the concept complex? (5+ elements, detailed relationships, data-heavy)
  → YES → Fullscreen
  → NO →
    Does the speaker's face/expression add value right now?
      → YES → Split-screen
      → NO →
        Is it a simple annotation? (1-3 elements, label, single stat)
          → YES → Transparent overlay
          → NO → Split-screen (default)
```

Additional rules:
- Never more than 3 consecutive fullscreen scenes
- After a fullscreen scene, next scene should be split-screen or speaker-only
- Overlay scenes should be short (3-8 seconds)
- Start the video with speaker-only or split-screen, not fullscreen (viewer needs to see who's talking)

## Scene Content Strategy

The planner reads the transcript and decides what type of scene to generate for each segment. The decision is based on the CONTENT of what's being said, not keywords.

### Pattern Matching

**Enumeration** — speaker lists items, steps, reasons, tips
→ Numbered glass cards with staggered entrance. Each card appears as the speaker mentions that item.

**Comparison** — speaker contrasts A vs B, pros/cons, before/after
→ Two-column layout. Left column enters first, right column enters 8 frames later. Matching rows highlight differences.

**Process** — speaker describes a workflow, pipeline, how something works
→ Flowchart with nodes and connecting lines. Nodes enter with spring, lines draw between them progressively.

**Data** — speaker mentions a statistic, percentage, growth, measurement
→ Animated bar/ring/counter. Number counts up from 0 to the value. Bar fills with violet gradient.

**Definition** — speaker explains what something means
→ Glass card with the term in large violet text, definition in secondary text below. Simple, clean.

**Timeline** — speaker describes events in order, history, phases
→ Horizontal timeline with date/event markers appearing left-to-right.

**Hierarchy** — speaker describes relationships, org structure, dependencies
→ Tree diagram. Root node enters first, children branch out with staggered springs.

**Cause & Effect** — speaker explains if X then Y, consequences, results
→ Two elements connected by an animated arrow. Left element enters, arrow draws, right element enters.

**Key Phrase** — speaker says something quotable, a principle, a rule
→ Kinetic typography. Key words scale up with spring, hold, settle. No glass card needed — text directly on screen.

**Quantity/Scale** — speaker compares sizes, amounts, magnitudes
→ Proportional shapes or bars showing relative scale. Animated fill to represent each value.

### When NOT to Add a Scene
- Speaker is telling a personal anecdote or story — let them talk, face-to-camera is best
- Speaker is asking a rhetorical question — let the pause land
- Speaker is being emotional — don't cover their face with graphics
- The concept is already clear without a visual — don't add scenes just to fill time
- Two scenes would be less than 3 seconds apart — consolidate or skip one
