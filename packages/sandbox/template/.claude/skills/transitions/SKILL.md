# Transitions Skill

## Purpose
Guide the selection and execution of transitions between video sections. This skill covers transition types, when to use each, timing parameters, and the relationship between transition choice and narrative meaning.

---

## 1. Core Principle: Transitions Carry Meaning

Every transition type communicates something to the viewer, whether intentional or not:

| Transition | Implicit Meaning |
|---|---|
| Hard cut | "This follows naturally" or "Pay attention" |
| Jump cut | "Time has passed" or "Let's skip ahead" |
| Cross dissolve | "Time is flowing" or "These are connected" |
| Fade to black | "This chapter is over" |
| Fade from black | "A new chapter begins" |
| Wipe | "We're moving to something different" |
| Slide | "Here's the next item in a series" |
| Match cut | "These two things are fundamentally alike" |
| Zoom | "Let's go deeper" or "Let's step back" |

Choose transitions based on the meaning you want to convey, not just what looks cool.

---

## 2. Transition Types

### Hard Cut (Straight Cut)

The default transition. One frame ends, the next begins. No interpolation.

**Parameters:**
- Duration: 0 frames (instantaneous)
- No configuration needed

**When to use:**
- Between any two sections where the content provides continuity (speaker's voice bridges the visual change)
- For energy and pace (every transition that isn't a hard cut slows things down)
- When the juxtaposition IS the point (contrasting two things)
- 80-90% of transitions in a well-edited video should be hard cuts

**When to avoid:**
- Between two visually similar shots (can read as a glitch)
- At major emotional shifts (too abrupt for tone changes)
- Between unrelated topics without audio continuity

**Best practices:**
- Cut on action (during movement) to hide the edit
- Cut between sentences, not mid-word
- When cutting between speaker angles, change the frame significantly (>30% different)

### Jump Cut

Two shots of the same subject with visible time discontinuity.

**Parameters:**
- Duration: 0 frames (instantaneous like a hard cut)
- Optional: Zoom punch (5-15% size change between shots to soften the jump)

**When to use:**
- Removing filler, pauses, or mistakes from a single-camera speaker
- Creating a fast-paced, authentic feel (vlog/YouTube style)
- Montage sequences showing progression
- Condensing a long explanation into key points

**When to avoid:**
- More than 4 consecutive jump cuts (becomes nauseating)
- Formal or professional content where polish matters
- When the content needs contemplation (jump cuts rush the viewer)

**Execution:**
```
Option A: Raw jump cut
  [Frame A: speaker at position 1] → [Frame B: speaker at position 2]
  Noticeable but accepted in casual content

Option B: Zoom punch
  [Frame A: 100% zoom] → [Frame B: 110% zoom]
  Disguises the jump as an intentional zoom. Reset every 3-4 jumps.

Option C: B-roll bridge
  [Frame A: speaker] → [3-5 frames: B-roll] → [Frame B: speaker]
  Hides the jump entirely. Audio continues uninterrupted.
```

### Cross Dissolve

Two shots blend together over a duration. The outgoing shot fades out while the incoming shot fades in simultaneously.

**Parameters:**
- Duration: 15-30 frames (0.5-1.0s at 30fps)
- Short dissolve (15f): Subtle, feels like a soft cut
- Medium dissolve (20-25f): Classic film transition
- Long dissolve (30f): Dreamy, contemplative, time-passage feel

**When to use:**
- Time passage (hours, days, seasons)
- Topic transitions that are related but distinct
- Mood shifts (serious → reflective, energetic → calm)
- Between speaker and B-roll when the transition should feel gentle
- Montage sequences with a lyrical quality

**When to avoid:**
- Between sections that need sharp contrast
- In high-energy sequences (dissolves slow things down)
- More than 2 dissolves in 60 seconds (becomes dreamlike/unfocused)
- Between shots with very different color grades (the blend looks muddy)

**Execution in Remotion:**
```tsx
// Cross dissolve between scenes
const frame = useCurrentFrame();
const opacity = interpolate(
  frame,
  [transitionStart, transitionStart + 20],
  [1, 0],
  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
);

// Outgoing scene: opacity fades from 1 to 0
// Incoming scene: opacity fades from 0 to 1 (inverse)
```

### Fade to Black / Fade from Black

The shot fades to (or from) a solid black frame.

**Parameters:**
- Duration: 15-30 frames fade to black + 5-15 frames hold black + 15-30 frames fade from black
- Total: 35-75 frames (1.2-2.5s)

**When to use:**
- Between major chapters or acts (strongest section separator)
- End of video (fade to black is the universal "The End")
- Start of video from cold open (fade from black = "Let's begin")
- After an emotional climax (give the viewer space to process)

**When to avoid:**
- Between related sections (too strong a separator)
- More than twice in a video under 5 minutes (loses impact)
- In the middle of an argument or explanation (breaks momentum)
- Never use for routine section transitions (it's the nuclear option)

**Execution:**
```tsx
// Fade to black
const fadeOut = interpolate(
  frame,
  [sceneEnd - 20, sceneEnd],
  [1, 0],
  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
);

// Hold black for 10 frames, then fade in
const fadeIn = interpolate(
  frame,
  [nextSceneStart, nextSceneStart + 20],
  [0, 1],
  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
);
```

### Wipe

A geometric shape reveals the incoming shot by covering the outgoing shot.

**Parameters:**
- Duration: 12-20 frames (0.4-0.7s)
- Direction: left-to-right, right-to-left, top-to-bottom, bottom-to-top, radial
- Edge: hard (clean line) or soft (feathered 5-10px)
- Shape: linear (bar), radial (circle), diagonal

**When to use:**
- Between distinctly different topics (clear visual separator)
- Listicle/numbered content (wipe = "next item")
- Retro or playful aesthetics (wipes have a classic TV feel)
- When you want a visible transition that's lighter than a fade-to-black

**When to avoid:**
- Serious, dramatic, or emotional content (wipes feel casual)
- Documentary-style content (too showy)
- More than 3 in a row (becomes a gimmick)

**Execution:**
```tsx
// Left-to-right wipe
const wipeProgress = interpolate(
  frame,
  [transitionStart, transitionStart + 15],
  [0, 1],
  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
);

// Use clipPath or mask:
// Outgoing: clipPath: `inset(0 0 0 ${wipeProgress * 100}%)`
// Incoming: clipPath: `inset(0 ${(1 - wipeProgress) * 100}% 0 0)`
```

### Slide / Push

The incoming shot pushes the outgoing shot off screen.

**Parameters:**
- Duration: 12-20 frames (0.4-0.7s)
- Direction: left, right, up, down
- Easing: ease-out (outgoing decelerates) or spring (bouncy settle)

**When to use:**
- Sequential content (items in a list, steps in a process)
- Between related panels or cards
- When both shots should be visible briefly (overlap during the push)
- Mobile/app-style aesthetics

**When to avoid:**
- Between unrelated content (the push implies spatial relationship)
- More than 5 consecutively in the same direction (monotonous)
- When the content needs a clean separation

**Execution:**
```tsx
// Slide transition
const slideProgress = spring({
  frame: frame - transitionStart,
  fps,
  config: { damping: 26, stiffness: 120, mass: 1.0 },
});

// Outgoing: translateX from 0 to -100%
// Incoming: translateX from 100% to 0
```

### Match Cut

A cut where the outgoing and incoming shots share a visual element (shape, color, motion, composition).

**Parameters:**
- Duration: 0 frames (it's a hard cut, but planned)
- Requires: Visual similarity between the last frame of outgoing and first frame of incoming

**When to use:**
- Major thematic transitions (connecting two ideas visually)
- Opening sequences (match cut from logo animation to first shot)
- Abstract-to-concrete transitions (animation circle → product photo)
- Time transitions (same composition, different time)

**Planning requirements:**
- Design the outgoing shot's final state to mirror the incoming shot's initial state
- Match on ONE element (shape OR color OR position OR motion — not all)
- The match should be approximate, not pixel-perfect (too precise feels clinical)
- The viewer should recognize the connection subconsciously

**Examples:**
```
Spinning loading icon → Spinning wheel on a car
Circular chart filling → Clock face
Code scrolling down → Waterfall footage
Speaker's hand gesture (palm out) → Stop sign
```

### Zoom Transition

Camera zooms into a detail, then the next shot starts zoomed out from a detail.

**Parameters:**
- Duration: 15-25 frames per direction (zoom in + zoom out = 30-50 frames total)
- Zoom amount: 200-500% (need to zoom far enough that the detail fills the frame)
- Blur: Add 2-5px blur at maximum zoom to hide the cut point

**When to use:**
- "Going deeper" into a topic (literal zoom = metaphorical depth)
- Transitioning from overview to detail
- Between macro and micro perspectives
- As a reveal (zoom in on one thing, zoom out to reveal it's part of something bigger)

**When to avoid:**
- More than once per minute (gimmicky)
- When the content doesn't support the depth metaphor
- Between unrelated topics (confusing spatial relationship)

**Execution:**
```tsx
// Zoom in (outgoing)
const zoomIn = interpolate(
  frame,
  [transitionStart, transitionStart + 15],
  [1, 4],
  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
);
const blurIn = interpolate(
  frame,
  [transitionStart + 10, transitionStart + 15],
  [0, 5],
  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
);

// Zoom out (incoming)
const zoomOut = interpolate(
  frame,
  [transitionStart + 15, transitionStart + 30],
  [4, 1],
  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
);
```

---

## 3. Transition Selection Guide

### By Narrative Relationship

| Relationship Between Sections | Recommended Transition |
|---|---|
| Continuation of same topic | Hard cut |
| New sub-point within same topic | Hard cut or brief dissolve (10f) |
| New topic, same energy level | Hard cut or slide |
| New topic, different energy level | Cross dissolve (20f) |
| Major chapter/act change | Fade to black |
| Time passage | Cross dissolve (25-30f) |
| Cause and effect | Hard cut (emphasizes connection) |
| Contrast/comparison | Hard cut (juxtaposition) or wipe |
| List item progression | Slide or wipe (consistent direction) |
| Abstract concept → concrete example | Match cut or zoom |
| Deep dive into detail | Zoom transition |
| Return from detail to overview | Zoom out or dissolve |
| Emotional climax → reflection | Cross dissolve or fade to black |
| Speaker → B-roll | L-cut (audio leads) |
| B-roll → speaker | J-cut (visual leads) |

### By Content Type

**Tutorial:**
- Between steps: Hard cut or slide (consistent, predictable)
- Between sections: Brief dissolve or title card
- To/from demonstrations: Hard cut
- Default: Hard cut (90%)

**Podcast/Interview:**
- Between speakers: Hard cut
- Between topics: Dissolve or B-roll bridge
- To/from B-roll: L-cut/J-cut
- Default: Hard cut (85%)

**Presentation:**
- Between slides: Slide or wipe (matches slide deck feel)
- Speaker to slide: Hard cut
- Between major sections: Fade to black
- Default: Slide (50%), Hard cut (40%)

**Vlog:**
- Between locations: Cross dissolve
- Time jumps: Jump cut with zoom punch
- Same location: Jump cut
- Default: Jump cut (60%), Hard cut (30%)

---

## 4. Transition Timing

### Duration Guidelines

| Transition | Minimum | Default | Maximum |
|---|---|---|---|
| Hard cut | 0f | 0f | 0f |
| Jump cut | 0f | 0f | 0f |
| Cross dissolve | 10f | 20f | 30f |
| Fade to black (total) | 30f | 50f | 75f |
| Wipe | 10f | 15f | 25f |
| Slide | 10f | 15f | 20f |
| Zoom | 20f | 30f | 50f |

### Pacing Interaction

Transition duration affects perceived pacing:
- **Fast cuts** (0-10f transitions): High energy, urgency, excitement
- **Medium cuts** (10-20f transitions): Balanced, professional, clear
- **Slow cuts** (20-30f+ transitions): Contemplative, emotional, cinematic

**Rule**: Match transition speed to content speed:
- Fast-talking speaker → fast transitions
- Slow, reflective content → slow transitions
- Mixed content → varied transition speeds (but consistent within sections)

### Transition Budget

For a typical 3-5 minute video:
- Hard cuts: 80-90% of transitions
- Dissolves: 5-10%
- Slides/wipes: 2-5%
- Fade to black: 1-2 instances maximum
- Match cuts: 0-1 instances (special occasion)
- Zoom transitions: 0-1 instances

Total transition time should be < 5% of video duration. If transitions are eating > 5%, you're over-transitioning.

---

## 5. Transition Anti-Patterns

### Common Mistakes

**Over-transitioning:**
Using dissolves, wipes, or fancy transitions for every cut. Looks like a PowerPoint presentation. Fix: default to hard cuts, use special transitions sparingly.

**Inconsistent transitions:**
Random mix of transition types with no logic. Dissolve here, wipe there, slide here. Fix: establish a transition vocabulary for the video (e.g., hard cuts for pace, dissolves for time, slides for lists) and stick to it.

**Too-slow transitions:**
30+ frame dissolves everywhere. The video feels sluggish and dreamy when it should feel informative. Fix: shorten to 15-20f or switch to hard cuts.

**Transition-content mismatch:**
Using a playful wipe transition between two serious sections. Or a dramatic fade-to-black between two list items. Fix: match transition weight to content weight.

**Missing audio bridge:**
Visual transition happens but audio stops abruptly at the same moment. Sounds like a glitch. Fix: L-cut or J-cut so audio provides continuity across the visual transition.

**Double transition:**
Outgoing shot fades out AND incoming shot slides in. Two transitions where one would do. Fix: pick one transition effect and apply it to both shots simultaneously.

---

## 6. Transition Planning in Edit Plans

When specifying transitions in an edit plan, use this notation:

```markdown
### Section 3: Memory Safety Explained
- **Time:** 0:32 - 0:55
- **Treatment:** animation
- **Transition In:** dissolve (20f) from speaker
- **Transition Out:** hard cut to Section 4
- **Description:** ...
```

### Default Transition Rules (when not specified):

1. If the treatment changes → hard cut (the treatment change IS the visual change)
2. If the treatment stays the same → brief dissolve (15f) or jump cut
3. If it's a major topic change → dissolve (20f) or title card
4. If it's a chapter change → fade to black
5. If transitioning to/from speaker → L-cut or J-cut

These defaults mean you only need to specify transitions when deviating from the norm.
