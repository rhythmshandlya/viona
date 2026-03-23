# Explainer Videos — Creative Direction

<tone_and_pacing>
## Tone & Pacing
- Educational, clear, methodical
- Build from simple → complex, step-by-step reveals
- Rhythm: fast hook (7-8s) → build tension (10s) → deep explanation (12-15s) → punchy close (7-8s)
</tone_and_pacing>

<visual_metaphor_approach>
## Visual Metaphors
Abstract concepts → concrete visual representations. Map every concept to something viewers can SEE.

| Concept | Best Visual Approach |
|---------|---------------------|
| Data comparison | Split composition, morphing between states |
| Metrics/progress | Animated counter with Pie progress, Rect bar fill |
| Rankings/tiers | Staggered Rect bar chart, animated tier board |
| Counters/stats | Large animated number with Pie ring or Rect bar context |
| Before/after | Shape morph (Circle→Star), color-shift wipe, split-screen reveal |
| Head-to-head | Animated split with visual metaphors on each side |
| Sequences/steps | Circle nodes connected by animated `<line>` connectors |
| Growth/trends | Animated Rect bars, rising geometric elements |
| Quotes/emphasis | Kinetic typography (word cascade, letter reveal) |
| Features/lists | Staggered MCP icon + label pairs with line connectors |
| Hook/bold claim | Kinetic typography filling the screen, geometric shape reveal |
| Transformation | Shape morph (@remotion/shapes A → B), scatter/reform |
| Emotional moment | MCP icon composition, large animated icon, geometric bloom |
| Convergence/focus | converge-to-point, morph-collapse, spotlight-focus — elements physically move |
| Revealing/unveiling | mask-reveal (circle or directional wipe) — clipPath animation |
| Building/construction | modular-assembly — parts fly in from edges |
| Depth/journey | parallax-layers — multi-speed layers |
| Drilling down | zoom-transition — scale into element |
| Breaking down | exploded-view — parts spread out |

For physical objects and illustrations: use professional icons from Freepik/Iconify MCP. For geometric shapes: use `@remotion/shapes` (Circle, Rect, Star, Pie, Triangle, Polygon, Ellipse). NEVER hand-draw complex SVG paths.
</visual_metaphor_approach>

<layer_philosophy>
## Three Motion Layers (Mandatory)

Professional motion graphics have three layers animating simultaneously. Amateur work has only layer 1.

| Layer | Role | Weight | Example |
|-------|------|--------|---------|
| Primary | Main element — diagram, data viz, illustration | 60% | Animated diagram, counter, shape reveal |
| Secondary | Supporting labels, icons, annotations | 30% | Staggered labels, accent lines, icon pops |
| Ambient | Background texture, continuous subtle motion | 10%, ≤15% opacity | Dot grid drift, gradient rotation, geometric shift |

A scene with ONLY a title fading in = amateur.
A scene with title (primary) + accent line (secondary) + subtle grid drift (ambient) = professional.
</layer_philosophy>

<choreography>
## Choreography Phases

Every scene follows this exact phase progression:

```
Phase 1 (frame 0):        AMBIENT    — Background begins (gradient, particles, grid)
Phase 2 (frame 0-15):     PRIMARY    — Hero element enters (title, main visual)
Phase 3 (keySync):        SETTLE     — Hero settles + secondary content appears
Phase 4 (keySync+8..):    STAGGER    — Details cascade in (8-12 frame stagger)
Phase 5 (last 15 frames): EXIT       — Elements depart in reverse hierarchy
```

No phase may be skipped. Phase 1 (ambient) runs continuously through ALL phases.
</choreography>

<visual_hierarchy>
## Visual Hierarchy (60-30-10 Rule)

- **60%** dominant — background treatment. NEVER static. Gradient rotation, grid drift, or color shift.
- **30%** secondary — containers, shapes, supporting elements. Consistent easing family.
- **10%** accent — highlights, data points, key moments. Springs + overshoot for emphasis.

Hierarchy by impact: Size > Color/Contrast > Position > Motion Speed > Weight
</visual_hierarchy>

<disney_principles>
## Disney's 5 Principles for Short-Form Video

### 1. Anticipation
Wind up before the main action. A slight pull-back (scale 0.95) over 5 frames before a spring entrance makes the reveal 3x more impactful.

### 2. Follow-Through
Secondary elements overshoot then settle. Use lower damping (18-22) on trailing elements so they arrive AFTER and bounce past the primary element.

### 3. Staging
Direct attention. Blur/dim background elements when the hero enters. The viewer's eye goes to the highest-contrast, fastest-moving element.

### 4. Exaggeration
Low damping + high stiffness for dramatic reveals. A stat counter that overshoots by 8-12% before settling reads as confident and premium.

### 5. Arcs
Natural curved motion paths. Elements that move in straight lines feel robotic. Use `Math.sin` on Y while interpolating X for parabolic arcs (on non-text elements only).
</disney_principles>

<hard_rules>
## Hard Rules (Non-Negotiable)

1. Minimum 3 elements animating per scene with DIFFERENT start times
2. Minimum 6-frame stagger between sequential entrances
3. Every scene MUST have ambient motion (background is NEVER static)
4. NEVER use same easing for adjacent elements in a stagger
5. ALWAYS offset opacity from position/scale by 3-6 frames (overlapping action)
6. ALWAYS pair opacity + transform for entrances (opacity-only = amateur)
7. Exits are 75% the duration of entrances (faster out than in)
8. Exit in REVERSE hierarchy order (last in = first out)
</hard_rules>

<planning_principles>
## Planning Principles

The #1 problem with AI-generated animations: they feel RANDOM and DISCONNECTED from the content.

Fix this by:
1. **Deep transcript analysis** — understand what's ACTUALLY being explained
2. **Precise timestamp alignment** — visuals sync to SPECIFIC WORDS
3. **Visual continuity** — the SAME elements transform across scenes
4. **Diverse visual techniques** — @remotion/shapes geometry, MCP icon compositions, kinetic typography, shape morphing, animated diagrams, data viz, AND cards. NOT every scene in a card.

Each scene description should address ALL THREE motion layers:
1. **Background/ambient** — what fills the canvas and moves continuously
2. **Primary element** — the main visual focus (a VISUAL TECHNIQUE, not just "card with text")
3. **Supporting elements** — secondary visuals that reinforce the primary

**VARY techniques across scenes.** No two adjacent scenes should use the same primary visual approach.
</planning_principles>
