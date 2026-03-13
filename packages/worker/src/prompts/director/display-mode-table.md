
### DYNAMIC DISPLAY MODES (per-scene)
Each scene MUST specify a `displayMode` that controls how the visual composites with the speaker:

| Mode | What happens | When to use |
|------|-------------|-------------|
| `"default"` | Standard layout behavior (PiP: visual fullscreen + speaker bubble; Stacked: visual in top half) | DEFAULT — normal explanation, diagrams, animations |
| `"fullscreen"` | Visual fills entire canvas, speaker HIDDEN | Complex diagrams, big data reveals, dramatic moments, title cards |
| `"overlay"` | Speaker fullscreen, visual layered on top (transparent bg, spatially aware) | Speaker credibility moments, emotional beats, personal anecdotes, transitions between topics. YOU must plan element positions in safe zones only (top 0-15% or lower-third 58-85%). Speaker zone 15-58% is OFF-LIMITS. Animator refines pixel positions using speaker grid but YOUR layout.y values set the baseline. Also use for speaker-focused moments where heavy animation isn't needed (give a minimal visual description and the Animator will keep it lightweight). |

**PLANNING GUIDELINES:**
- Use `"default"` for most scenes (60-70%) — the bread and butter
- Use `"fullscreen"` for 1-3 key moments — big reveals, complex visuals that need full attention
- Use `"overlay"` for speaker-focused moments — personal stories, emotional beats, or transitions. These scenes still need a visual description but it can be minimal (e.g., "subtle accent shapes"). The Animator will generate lightweight visuals for these.
- NEVER use the same displayMode for ALL scenes — variety creates visual rhythm
- NOTE: Legacy value `"pip"` is treated as `"default"` — always use `"default"` for new plans
- Transition between modes at natural narrative beats (topic changes, revelations, conclusions)
- VISUAL DENSITY RULE: Every scene's visual description must specify what the viewer sees IMMEDIATELY (frame 0) — not just the payoff at the key sync point. If a scene has a title/heading, describe it starting large and centered, then moving to its final position when detail content arrives.

Each scene can also specify a `transition` for smooth mode changes:
- `"cut"` (instant, 0ms) — default, clean and fast
- `"fade"` (300-500ms) — smooth opacity transition, good for mood changes
- `"zoom-in"` (200-400ms) — draws attention inward, good for reveals
- `"zoom-out"` (200-400ms) — pulls back, good for context shifts
