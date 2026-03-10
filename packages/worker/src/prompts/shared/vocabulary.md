# Shared Animation Vocabulary

<text_animations>
## Text Animations
| Name | Effect | Best For |
|------|--------|----------|
| `word-cascade` | Words appear one-by-one with slide-up + fade | Quotes, taglines, explanations |
| `char-stagger` | Characters appear letter-by-letter with spring scale | Titles, emphasis words |
| `text-reveal` | Fade in with gentle scale (1.05-1.15x) + SMOOTH spring | Hook titles, big reveals |
| `typewriter` | Characters reveal left-to-right with blinking cursor | Code, terminal output |
| `text-morph-position` | Text smoothly repositions/rescales | Title settling after hook |
| `number-roll` | Counter animates from 0 to target with easing | Stats, metrics, data points |
</text_animations>

<element_animations>
## Element Animations
| Name | Effect | Best For |
|------|--------|----------|
| `spring-in` | Scale 0→1 with spring overshoot | Icons, cards, focal elements |
| `fade-rise` | Opacity 0→1 + translateY up 20px | Subtle entrances, secondary content |
| `stagger-cascade` | Multiple elements enter sequentially (6-8f apart) | Lists, grid items, steps |
| `draw-in` | SVG path draws progressively | Diagrams, connections, flow lines |
| `fill-progress` | Bar/shape fills from 0% to target | Progress bars, chart bars |
| `count-up` | Number ticks from 0 to value over ~45 frames | Metrics, scores, percentages |
| `pop-scatter` | Elements burst outward from center | Celebrations, impact moments |
| `orbit-float` | Elements slowly float around center (RARE — prefer stagger-cascade or radial layout) | Ambient only, max 1 scene per project |
| `converge-to-point` | Multiple elements translate+scale toward a single point | Consensus, focus, unification |
| `morph-collapse` | Non-survivors slide toward survivor, survivor absorbs with scale pulse | Selection, filtering, narrowing |
| `split-expand` | One element splits into multiple copies spreading outward | Distribution, diversification |
| `mask-reveal` | Element revealed through animated clipPath (circle or wipe) | Before/after, unveiling, dramatic reveals |
| `modular-assembly` | Parts fly in from edges and assemble into final form | Building blocks, construction |
| `exploded-view` | Object breaks apart to show components, then reassembles | Decomposition, analysis, breakdown |
| `parallax-layers` | Foreground/background move at different speeds for depth | Journey, depth, immersion |
| `zoom-transition` | Camera zooms into element to reveal next content | Drilling down, closer look |
| `spotlight-focus` | Darken everything except the key element | Emphasis, isolation, importance |
| `kinetic-typography` | Text IS the animation — words move/scale/rotate expressively | Quotes, key phrases, impact |
</element_animations>

<transitions>
## Transition Vocabulary
| Name | Effect | When to Use |
|------|--------|-------------|
| `crossfade` | Opacity blend over ~15 frames | Mood changes, gentle shifts |
| `slide-left` | New scene slides in from right | Sequential progression |
| `wipe-right` | Reveal wipe from left to right | Before/after, transformations |
| `glow-pulse` | Brightness pulse at boundary | Impact moments |
| `cut` | Instant switch (default) | Fast pace, dramatic contrast |
</transitions>

<scene_archetypes>
## Scene Archetypes
| Archetype | Best For | Key Animations |
|-----------|----------|----------------|
| `hook-title` | Opening scene | `text-reveal` → `text-morph-position` to top |
| `stat-reveal` | Data points, metrics | `count-up` + `text-reveal` for number |
| `process-flow` | How-to, algorithms | `draw-in` connections, `stagger-cascade` steps |
| `comparison-split` | Before/after, A vs B | `slide-left` divider, `stagger-cascade` each side |
| `feature-list` | Benefits, bullet points | `stagger-cascade` with `spring-in` icons |
| `timeline-march` | History, chronology | `draw-in` center line, `stagger-cascade` nodes |
| `code-demo` | Programming, CLI | `typewriter` code, `spring-in` output |
| `quote-spotlight` | Testimonials, key phrases | `word-cascade` quote, `fade-rise` attribution |
| `data-chart` | Charts, rankings | `draw-in` axes, `fill-progress` bars |
| `hero-image` | Real-world context | Ken Burns image + `text-reveal` overlay |
| `concept-visual` | Abstract ideas | `spring-in` template component |
| `payoff-close` | Conclusion, CTA | `spring-in` callback + `word-cascade` summary |

Archetypes are starting recipes, not rigid templates. Mix animations freely.
</scene_archetypes>
