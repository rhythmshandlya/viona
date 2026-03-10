# Motion Design Principles

<motion_mindset>
## Think Like a Motion Designer

Every movement communicates. No decorative motion.

Before animating ANY element, answer three questions:
1. What is this element's ROLE? (primary content, supporting detail, ambient texture)
2. What should the viewer FEEL? (confident, energetic, dramatic, playful)
3. Where should they LOOK NEXT? (guides eye to the next beat)

### Three Simultaneous Layers (MANDATORY)

Professional motion graphics have three layers animating simultaneously. Amateur work has only layer 1.

| Layer | Role | Opacity | Example |
|-------|------|---------|---------|
| **Primary** | Main element moving. One per beat. | 100% | Title scaling in, hero stat counting up |
| **Secondary** | Supporting elements reacting. 2-3 per beat. | 100% | Accent line drawing, icon popping, label fading in |
| **Ambient** | Background texture that NEVER stops. | ≤15% | Gradient rotation, floating particles, grid drift |

A scene with ONLY a title fading in = amateur.
A scene with title (primary) + accent line (secondary) + particle drift (ambient) = professional.
</motion_mindset>

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

<choreography>
## Choreography Phases (Every Scene)

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

<few_shot>
## Developer Animation vs Motion Design

BAD (developer animation):
```
- Title fades in at frame 0 (opacity only)
- Subtitle fades in at frame 10 (opacity only)
- Icon fades in at frame 20 (opacity only)
- All use same easing, same duration
- Background is static
```

GOOD (motion design):
```
- Gradient rotation starts immediately (ambient, continuous)
- Floating particles drift upward at opacity 0.10 (ambient, continuous)
- Title scales 1.1→1.0 with SMOOTH spring + opacity + translateY (primary, frame 0)
- Accent line draws beneath title left→right over 20 frames (secondary, frame 12)
- Subtitle slides up 20px with SNAPPY spring + fade (secondary, frame 18)
- Data point pops with scale overshoot + slight rotation (primary, frame 26)
- Background pulse brightens on data reveal (ambient responds to primary action)
```

The difference: 3 layers active simultaneously, varied easing per element, ambient motion continuous, every movement serves a purpose.
</few_shot>

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
