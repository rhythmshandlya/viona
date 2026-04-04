# Explainer Videos — Technique Preferences

<preferred_techniques>
## Preferred Techniques
| Technique | When to Use | Implementation |
|-----------|------------|----------------|
| `"animated-diagram"` | Processes, systems, cause-effect | Filled circle nodes + solid bar connectors |
| `"geometric-reveal"` | Shape-driven reveals, progress | @remotion/shapes (Pie, Circle, Star) |
| `"shape-morph"` | Transformations, before/after | Cross-fade between @remotion/shapes |
| `"data-viz"` | Stats, metrics, comparisons | Pie progress, Rect bars, counters |
| `"kinetic-typography"` | Hooks, key phrases, bold claims | Word cascade, char stagger |
| `"card-data"` | Stat displays, feature lists | Card with animated content inside |
| `"split-composition"` | Comparisons, A vs B | Side-by-side with animation |
| `"icon-composition"` | Feature lists, concept illustration | MCP icons + geometric accents |
| `"particle-scatter"` | Impact moments, celebrations | Geometric elements scatter/converge |

No two adjacent beats should share the same technique.
</preferred_techniques>

<shapes_and_icons>
## Shape & Icon Rules
- Use `@remotion/shapes` (Rect, Circle, Triangle, Ellipse, Star, Pie, Polygon) for geometry — always with `fill`, not `stroke`
- Use Freepik/Iconify MCP for icons, logos, illustrations — NEVER hand-draw SVG paths
- Use solid filled `div` elements for connectors and bars — NOT SVG `<line>` or `<path>` with strokes
- Use `boxShadow` for depth and edge definition — NOT thin borders
- Use `clip-path` for masking and progressive reveals
</shapes_and_icons>

<animation_vocabulary>
## Animation Vocabulary

### Text Animations
| Name | Effect | Best For |
|------|--------|----------|
| `word-cascade` | Words appear one-by-one with slide-up + fade | Quotes, taglines, explanations |
| `char-stagger` | Characters appear letter-by-letter with spring scale | Titles, emphasis words |
| `text-reveal` | Fade in with gentle scale (1.05-1.15x) + SMOOTH spring | Hook titles, big reveals |
| `typewriter` | Characters reveal left-to-right with blinking cursor | Code, terminal output |
| `text-morph-position` | Text smoothly repositions/rescales | Title settling after hook |
| `number-roll` | Counter animates from 0 to target with easing | Stats, metrics, data points |

### Element Animations
| Name | Effect | Best For |
|------|--------|----------|
| `spring-in` | Scale 0→1 with spring overshoot | Icons, cards, focal elements |
| `fade-rise` | Opacity 0→1 + translateY up 20px | Subtle entrances, secondary content |
| `stagger-cascade` | Multiple elements enter sequentially (6-8f apart) | Lists, grid items, steps |
| `clip-reveal` | Shape fills progressively via clip-path or width/height animation | Diagrams, connections, flow bars |
| `fill-progress` | Bar/shape fills from 0% to target | Progress bars, chart bars |
| `count-up` | Number ticks from 0 to value over ~45 frames | Metrics, scores, percentages |
| `pop-scatter` | Elements burst outward from center | Celebrations, impact moments |
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

### Transitions
| Name | Effect | When to Use |
|------|--------|-------------|
| `crossfade` | Opacity blend over ~15 frames | Mood changes, gentle shifts |
| `slide-left` | New scene slides in from right | Sequential progression |
| `wipe-right` | Reveal wipe from left to right | Before/after, transformations |
| `glow-pulse` | Brightness pulse at boundary | Impact moments |
| `cut` | Instant switch (default) | Fast pace, dramatic contrast |

### Scene Archetypes
| Archetype | Best For | Key Animations |
|-----------|----------|----------------|
| `hook-title` | Opening scene | `text-reveal` → `text-morph-position` to top |
| `stat-reveal` | Data points, metrics | `count-up` + `text-reveal` for number |
| `process-flow` | How-to, algorithms | Filled circle nodes + solid bar connectors, `stagger-cascade` steps |
| `comparison-split` | Before/after, A vs B | `slide-left` divider, `stagger-cascade` each side |
| `feature-list` | Benefits, bullet points | `stagger-cascade` with `spring-in` icons |
| `timeline-march` | History, chronology | Solid filled center bar (height grows), `stagger-cascade` Circle nodes |
| `code-demo` | Programming, CLI | `typewriter` code, `spring-in` output |
| `quote-spotlight` | Testimonials, key phrases | `word-cascade` quote, `fade-rise` attribution |
| `data-chart` | Charts, rankings | Solid filled axis bars, `fill-progress` Rect bars |
| `hero-image` | Real-world context | Ken Burns image + `text-reveal` overlay |
| `concept-visual` | Abstract ideas | `spring-in` template component |
| `payoff-close` | Conclusion, CTA | `spring-in` callback + `word-cascade` summary |

Archetypes are starting recipes, not rigid templates. Mix animations freely.
</animation_vocabulary>

<quality_checklist>
## Quality Checklist

### Per-Scene Verification (Animator)
Before marking any scene complete:
- [ ] All entries pair opacity + transform (no opacity-only fades)
- [ ] Stagger delays vary (not uniform gaps)
- [ ] 3+ elements animating with different start times
- [ ] Ambient layer present and continuous (background never static)
- [ ] Exits faster than entries (75% duration), reverse hierarchy order
- [ ] No frozen frames — persistent elements have micro-motion
- [ ] All content in centered flex container (not scattered absolute positions)
- [ ] Only palette colors used (no random hex values)
- [ ] Spring damping >= 18 everywhere
- [ ] Text scale never exceeds 1.15x during entry
- [ ] extrapolateLeft AND extrapolateRight: 'clamp' on EVERY interpolate()
- [ ] inputRange arrays are strictly monotonically increasing (each value > previous, never equal or decreasing)
- [ ] keySync visual triggers at exact TIMING.sceneNKeySync frame
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Spring configs vary between adjacent elements (not all SMOOTH)
- [ ] Elements visible 30+ frames have ambient motion (float/breathe/pulse)
- [ ] ≥2 different animation techniques used across scenes (not all spring-in + stagger)
- [ ] No hand-drawn SVG `<path d>` with complex coordinates — uses @remotion/shapes or MCP icons
- [ ] No SVG stroke-based visuals — uses solid fills, boxShadow, clip-path instead
- [ ] Content vertically centered: top = (usableHeight - contentHeight) / 2
- [ ] Related elements (icon + label + container) grouped in shared flex container
- [ ] Visual technique varies from adjacent scenes (not all card+text)
- [ ] Last sync animation completes 30+ frames before outro begins

### Plan Verification (Director)
Before finalizing scene plan:
- [ ] MUTE TEST: Concept clear with sound off?
- [ ] CONTINUITY TEST: Same visual element persists and transforms across scenes?
- [ ] SYNC TEST: Key visuals aligned to specific transcript words?
- [ ] HOOK TEST: Scene 1 has motion from frame 0 and striking visual in <3 seconds?
- [ ] PACING TEST: Scene durations varied (not all same length)?
- [ ] DURATION TEST: Every scene under 450 frames (15 seconds)?
- [ ] SYNC GAP TEST: Max 90 frames (3 seconds) between consecutive sync points?
- [ ] ANCHOR TEST: Each scene specifies what carries in/out?
- [ ] LAYER TEST: Each description addresses background + primary element + motion?
- [ ] TECHNIQUE VARIETY TEST: ≥3 different visual techniques used across scenes (not all cards)?
- [ ] OVERLAY ZONE TEST: Overlay elements only in 0-15% or 58-85% Y zones?

### Transcript Coverage (Both Agents)
- [ ] Every 3-5 seconds of narration has corresponding visual content
- [ ] No phrase in the transcript lacks visual representation
- [ ] Visual beats match narration beats (pause at any frame → viewer understands topic)
</quality_checklist>

<anti_patterns>
## Anti-Patterns
- Heavy stock footage dominating scenes (explainers should be visually constructed)
- Talking-head focus without supporting graphics
- News-style data presentation (avoid journalistic framing)
- Every scene in a card — vary between cards, open compositions, diagrams
- Hand-drawn SVG paths — use @remotion/shapes (with fill) or MCP icons
- SVG stroke-based visuals (strokeDasharray, `<line>`, `<path>` outlines) — use solid filled shapes, boxShadow, clip-path reveals
- Same technique in 3+ scenes
- Developer animation: opacity-only fades, same easing everywhere, static backgrounds
- Wireframe/outlined elements — use solid filled surfaces with shadow for depth
- Random floating particles — use smooth uniform dots that move in lines and pulse/beat
</anti_patterns>
