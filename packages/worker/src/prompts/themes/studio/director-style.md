Polished motion graphics on dot-grid backgrounds with diverse visual techniques. {variant_label}.
The Animator has a rich toolkit: SVG path-drawing, shape morphing, kinetic typography, animated diagrams, particle effects, data visualization, AND card-based templates. Plan scenes that use VARIED visual approaches — not every scene should be a card with text.

**COLOR PALETTE:** {variant_label} — background {background}, text {text}, textMuted {textMuted}.
Cards: {cardBg} background, 1px {cardBorder} border, 32px radius, boxShadow for depth.
Grid: dot-grid ({gridColor}, 32px spacing, r=1 dots).
Default accents: primary #6366F1 (indigo), secondary #EC4899 (pink).

**FONT PAIRS (pick ONE per project):**
| Key | Headline | Body | Vibe |
|-----|----------|------|------|
| boldImpact | Bebas Neue | Roboto | Bold dramatic |
| cleanMinimal | Inter | Inter | Clean restrained |
| modernTech | Montserrat | Inter | Professional |
| elegantEditorial | Playfair Display | Lato | Sophisticated |
| friendlyTech | Poppins | Inter | Approachable |

**VISUAL TECHNIQUES (plan diverse scenes):**
| Technique | When to Plan | Description in Scene |
|-----------|-------------|---------------------|
| SVG path drawing | Reveals, processes, connections | "Line draws from A to B, path reveals progressively" |
| Shape morphing | Transformations, before→after | "Water drop morphs into heart shape" |
| Kinetic typography | Hooks, bold claims, key phrases | "Words cascade in one-by-one with staggered springs" |
| Animated diagram | Systems, relationships, flows | "Nodes appear with connecting lines drawing between them" |
| Card + data viz | Stats, metrics, comparisons | "Card with animated counter reaching 10,000+" |
| Particle scatter | Impact, celebration, global reach | "Dots scatter outward from center point" |
| Full-scene SVG | Metaphors, environments, storytelling | "Stylized pool lanes radiate from center" |
| Split composition | Comparisons, choices, contrasts | "Left half shows choppy wave, right shows smooth flow" |

**RULE: No two adjacent scenes should use the same primary technique.** If Scene 2 is a card, Scene 3 must be kinetic typography, path drawing, morphing, or illustration. Vary the visual vocabulary across the project.

**CARD LAYOUT (when using cards):** Centered flex containers on dot-grid background.
Cards: s(56)-s(64) padding, maxWidth s(900) (or 85% canvas). Solid opaque style default, also gradient/outline.

**TEMPLATE LIBRARY:**
Check src/.templates/ for pre-built template source code. Templates are available for data-viz
(stat-counter, stat-donut, bar-chart-race), lower-thirds, comparisons (versus-screen, pros-cons),
intros/outros, marketing, education. Templates are ONE tool — use when they fit, but do NOT
force every scene into a template. Custom SVG animation is often more compelling.

**TEMPLATE SUGGESTIONS:**
For each scene, optionally add a "suggestedTemplates" array to scenes.json when a template fits.
If a custom visual technique is better, describe the technique in the "visual" field instead.

**ANIMATION FEEL:** SPRINGS.SMOOTH (damping: 26, stiffness: 120) for premium settle, SPRINGS.SNAPPY (damping: 22, stiffness: 170) for hero reveals.
Stagger 6-8 frames. Use spring entrances for cards, interpolate for continuous motion.
