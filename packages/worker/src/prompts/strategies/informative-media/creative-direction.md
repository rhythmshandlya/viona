# Informative Media — Creative Direction

<tone_and_pacing>
## Tone & Pacing
- Serious, trustworthy, journalistic
- Measured pacing with data reveals at key moments
- Rhythm: strong hook with data (7-8s) → context build (10s) → deep analysis (12-15s) → definitive close (7-8s)
- Authority through restraint — let the data speak, don't over-animate
</tone_and_pacing>

<visual_metaphor_approach>
## Visual Metaphors
Real-world context, data-driven, authoritative. Show evidence, not abstractions.

| Concept | Best Visual Approach |
|---------|---------------------|
| Geographic context | MCP map icons, location pins, country outlines |
| Data/statistics | Animated Rect bar charts, Pie polls, counter reveals |
| Quotes/claims | Kinetic typography, quote spotlight |
| Comparisons | Split composition with data on each side |
| Timelines | Animated line with Circle nodes at key dates |
| People/organizations | MCP icons (flags, logos via simple-icons), labels |
| Rankings/tiers | Staggered Rect bar chart, animated tier board |
| Counters/stats | Large animated number with Pie ring context |
| Head-to-head | Animated split with data on each side |
| Growth/trends | Animated Rect bars, rising geometric elements |
| Economic data | Pie progress ring, Rect bar fill, counter |
| Conflict/tension | Split composition, opposing geometric elements |

For real-world objects, flags, logos: use professional icons from Freepik/Iconify MCP. For geometric shapes: use `@remotion/shapes`. NEVER hand-draw complex SVG paths.
</visual_metaphor_approach>

<layer_philosophy>
## Three Motion Layers

Same three-layer model but weighted toward data and real-world imagery:

| Layer | Role | Weight | Example |
|-------|------|--------|---------|
| Primary | Data visualization, map, key statistic | 60% | Animated chart, map highlight, counter |
| Secondary | Labels, source citations, supporting stats | 30% | Staggered data labels, accent lines |
| Ambient | Subtle background, low-key movement | 10%, ≤15% opacity | Gradient shift, grid drift, muted pulse |

Informative media backgrounds should feel restrained and professional — no playful particles or energetic motion.
</layer_philosophy>

<choreography>
## Choreography Phases

Same phase structure as all genres:

```
Phase 1 (frame 0):        AMBIENT    — Background begins (subtle gradient, grid)
Phase 2 (frame 0-15):     PRIMARY    — Hero element enters (data point, headline)
Phase 3 (keySync):        SETTLE     — Hero settles + secondary data appears
Phase 4 (keySync+8..):    STAGGER    — Details cascade in (8-12 frame stagger)
Phase 5 (last 15 frames): EXIT       — Elements depart in reverse hierarchy
```

No phase may be skipped. Phase 1 (ambient) runs continuously through ALL phases.
</choreography>

<visual_hierarchy>
## Visual Hierarchy (60-30-10 Rule)

- **60%** dominant — background treatment. Subtle, professional. Muted gradients or minimal grid.
- **30%** secondary — data containers, charts, supporting labels. Clean and precise.
- **10%** accent — key data points, critical numbers. Springs + controlled overshoot.

Hierarchy by impact: Size > Color/Contrast > Position > Motion Speed > Weight
</visual_hierarchy>

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

Informative media demands CREDIBILITY through visual design. Every visual choice must feel deliberate and authoritative.

1. **Data-first visuals** — lead with numbers, maps, evidence. Not abstract shapes.
2. **Precise timestamp alignment** — data reveals sync to SPECIFIC WORDS in narration
3. **Visual continuity** — the SAME data elements transform across scenes (a bar chart grows, a map zooms)
4. **Restrained technique variety** — prefer data-viz, kinetic-typography, split-composition over playful scatter/morph

Each scene description should address ALL THREE motion layers:
1. **Background/ambient** — subtle, professional (muted gradient, minimal grid)
2. **Primary element** — data visualization, key statistic, map (NOT decorative shapes)
3. **Supporting elements** — labels, citations, secondary data
</planning_principles>
