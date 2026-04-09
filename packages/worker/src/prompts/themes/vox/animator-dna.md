## Vox Motion DNA — Animator Rules

### The Stutter Rule (NON-NEGOTIABLE)
ALL graphic elements (text, shapes, icons, data) animate at 12fps stutter:
```ts
import { sf } from '../constants';
// Use sf(frame) for ALL position/scale/rotation interpolations on graphics
// sf() quantizes frame: Math.floor(frame / 2.5) * 2.5
```
- Photographs and video footage stay at full 30fps (smooth Ken Burns pans)
- Opacity transitions stay at full 30fps (stuttered opacity looks broken, not stylish)
- The CONTRAST between stuttered graphics and smooth footage IS the Vox feel

### Easing — NOT Default
Vox uses aggressive ease-out (75% influence), NOT gentle default curves:
```ts
import { Easing } from 'remotion';
const voxEase = Easing.bezier(0.25, 0.1, 0.25, 1.0);
```

### Opacity/Position Offset Rule
Opacity ALWAYS leads position by 3-6 frames:
- Frame 0: opacity starts 0→1
- Frame 4: position starts moving
- Frame 12: position arrives
- Frame 14: opacity reaches 1.0

### Background-Before-Text Rule
Background shapes enter BEFORE their text content:
- Background: frame 0 of element entrance
- Text: delayed 6-12 frames after background settles

### Entrance Vocabulary
| Move | When to use | Duration |
|------|-------------|----------|
| **Slide-in** | Headlines, labels | 8-12 stuttered frames, easeOut |
| **Pop** | Icons, data points | 6 frames, scale 0→1.08→1 |
| **Highlight sweep** | Key claims, evidence | 10 frames, yellow bar width 0%→100%, 1deg rotation |
| **Typewriter** | Definitions, quotes | 2 frames/char, mask-wipe from left |
| **Draw-on** | Lines, borders, connectors | 8-12 frames, width/clip animation |
| **Progressive build** | Charts, lists, steps | Each item 4-6 frames after previous |

### Exit Rules
- Exits = 75% of entrance duration (12-frame entrance → 9-frame exit)
- Direction: reverse of entrance (slide DOWN if entered UP)
- Opacity drops FASTER than position changes
- Last in = first out (reverse stagger)

### Overshoot
Vox overshoot: 5-10% past target, 50% decay per bounce, 10-15 frames to settle.
- Primary elements: damping 20-22
- Secondary elements: damping 18-20 (slightly more bounce for follow-through)

### Hold/Idle (every element must have micro-motion)
- Text: 0.5px vertical breathe (sine wave, 60-frame period)
- Shapes: scale oscillation 0.998–1.002 (90-frame period)
- Background grain: cycling offset every 8 frames
- NO rotation idle. Vox elements don't wobble.

### Surface Treatment (EVERY scene)
1. **Film grain** — cycling noise at 25-35% opacity
2. **Rough edges** — feTurbulence displacement on clip-paths of rectangular shapes
3. NO drop shadows. NO gradients on text. NO glossy surfaces.

### Color Per Scene
- Pick 2 colors from theme: one dominant, one accent
- Yellow highlight RESERVED for single most important element
- If no "most important" element, don't use yellow
- Gray tones for secondary elements
- NEVER all theme colors in one scene

### Typography
- Headlines: Playfair Display, bold, s(48)-s(64)
- Body/labels: Inter, regular-medium, s(24)-s(32)
- Numbers: Inter, bold, s(56)-s(72) for hero stats
- ALL-CAPS only for: labels, section markers, attribution text
- NEVER: italic body text, outlined text, all-caps body

### Three-Layer Composition Rule
Every frame has 3 simultaneous layers:
1. Ambient background — grain cycling, subtle texture shift (10-15% visual weight)
2. Primary element — the hero graphic/text being narrated
3. Secondary details — supporting labels, annotations in idle micro-motion
