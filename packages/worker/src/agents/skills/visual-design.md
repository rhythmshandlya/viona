# Visual Design for Explainer Videos

## Goal: ByteByteGo-Quality Explainers

Your visuals should make abstract concepts UNDERSTANDABLE through:
- Visual metaphors that click
- Process animations showing things HAPPENING
- Progressive build-up of complexity
- Professional motion graphics quality

## What Makes It Professional

### Good Animation (ByteByteGo-style)
- Objects TRAVEL along paths (requests flying, data streaming)
- Processes are VISIBLE (server processing with internal activity)
- Cause and effect are CONNECTED (action → reaction)
- Timing creates RHYTHM (build up, pause, payoff)

### Bad Animation (PowerPoint-style)
- Everything just "appears" with a fade
- Static icons sitting on screen
- No sense of process or flow
- All animations at once, no choreography

## Visual Metaphor Guidelines

| Concept | Strong Metaphor | Weak Metaphor |
|---------|-----------------|---------------|
| API Request | Envelope flying to destination | Arrow pointing at box |
| Server Processing | Machine with gears spinning | Static server icon |
| Data Flow | Stream of particles along path | Arrow with "data" label |
| Error | Object rejected, bouncing back | Red X appearing |
| Success | Celebration burst, green glow | Green checkmark |

## Layout Principles

### Spatial Flow
- **Left-to-right**: Time progression, request→response
- **Top-to-bottom**: Hierarchy, steps, data flow
- **Center-out**: Radial processes, hub-and-spoke

### Safe Zones
- **Top 10%**: Title area
- **Bottom 15%**: RESERVED for subtitles - never place content here
- **Side 5%**: Breathing room margins

### Visual Balance
- Primary elements: Large, centered, prominent
- Secondary elements: Smaller, supporting
- No more than 6 primary elements visible at once

## Color Psychology

| Color | Use For | Feeling |
|-------|---------|---------|
| Blue | Trust, data, connections | Reliable, stable |
| Purple | Primary actions, highlights | Creative, premium |
| Cyan | Accents, success states | Fresh, modern |
| Green | Success, completion | Positive, confirmed |
| Orange/Yellow | Warnings, attention | Caution, energy |
| Red | Errors, critical | Danger, stop |

## Animation Timing

### Pacing
- **Quick entrance**: 15-20 frames (0.5-0.7s)
- **Normal entrance**: 25-35 frames (0.8-1.2s)
- **Dramatic entrance**: 45-60 frames (1.5-2s)
- **Travel animation**: 45-90 frames (1.5-3s)
- **Hold for emphasis**: 20-30 frames

### Stagger
- Elements entering together: 8-15 frame delay between each
- Never have more than one "hero" animation at a time

### Spring Settings
```tsx
// Smooth, professional
{ damping: 20, stiffness: 60 }

// Bouncy, playful
{ damping: 12, stiffness: 80 }

// Snappy, impactful
{ damping: 15, stiffness: 150 }
```

## Hero Moments

Every scene should have ONE hero moment - the key animation that deserves extra attention:

- Longer duration
- Extra visual effects (glow, trail, particles)
- Clear before/after states
- Moment of satisfaction

Examples:
- Request envelope flying across and being absorbed
- Data transforming from raw to structured
- Connection line drawing between nodes
- Success celebration after completion

## Process Animation Patterns

### Object Travel
```
Start position → Path (curved arc) → End position
Effects: motion trail, slight rotation, scale pulse on arrival
```

### State Transformation
```
Initial state → Processing animation → Final state
Effects: morphing, color shift, particle transition
```

### Connection Formation
```
Start node → Line draws → End node → Pulse
Effects: dash animation, glow on completion
```

### Reveal/Disclosure
```
Hidden → Build up anticipation → Reveal → Settle
Effects: blur to focus, scale from 0, slide from edge
```
