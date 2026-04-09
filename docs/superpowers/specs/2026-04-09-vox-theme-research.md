# Vox Theme Research — Full DNA Specification

> Goal: Not just templates, but a complete visual DNA system that makes every video created under the "vox" theme feel authentically Vox — from how the planner structures scenes, to how the animator moves elements, to how captions behave.

---

## Part I: The Problem — Templates ≠ DNA

### What the current "magazine" theme actually is

The magazine theme today consists of:
1. **Shared library** (`packages/templates/src/magazine/`) — 6 files: constants, animations, effects, textures, decorations, typography
2. **~30 templates** — React components that import from the shared library
3. **theme.md** — A markdown file with color tokens that gets copied to workspace
4. **`{{THEME}}` injection** — A string replacement in prompts telling agents "use magazine"

### What's missing for true DNA

The planner doesn't know HOW Vox thinks about storytelling. The animator doesn't know Vox's signature moves. The caption agent doesn't know Vox's text rhythm. Today, a "theme" is a coat of paint. DNA should be the skeleton, muscles, and nervous system.

**A theme's DNA must inject into 5 layers:**

| Layer | What it controls | Current state | DNA state |
|-------|-----------------|---------------|-----------|
| **1. Narrative structure** | How scenes are sequenced, pacing, information flow | Generic — planner has no theme-aware storytelling rules | Theme-specific planner guidance: "Vox opens with a surprising claim, then zooms out to context" |
| **2. Scene vocabulary** | What kinds of scenes exist | Templates only — pick from a list | Rich scene-type catalog with when/why to use each, including non-template scenes |
| **3. Motion language** | How things move, enter, exit, hold | Generic motion-design.xml shared across all themes | Theme-specific motion rules: "12fps stutter on graphics, smooth on photos" |
| **4. Visual components** | Colors, textures, effects, typography | Shared library (good, keep this) | Expanded library + theme-specific effect behaviors |
| **5. Anti-patterns** | What NOT to do | None | Explicit "never do this in Vox": no corporate polish, no smooth graphic animation, no perfect geometry |

---

## Part II: Vox Visual Identity — Deep Analysis

### 2.1 What Makes Vox Instantly Recognizable

Vox pioneered the "animated opinion essay" — combining expert interviews, archival footage, custom animations, data visualizations, and narration into a cohesive educational package. Their design philosophy is **"visual evidence over decoration"** (Estelle Caswell: "My job wasn't to decorate a video. My job was to tell a story").

Key recognition markers:
- The **yellow highlighter effect** over documents and text
- **12fps animation stutter** within 24fps timelines (deliberately choppy motion on graphics)
- **Rough-edged, hand-crafted lower thirds** with jagged texture
- **Collage-style cutouts** of photographs with intentionally imperfect edges
- **Flat design** with simple 2D elements, emphasizing clarity over realism
- Character over polish — "uniqueness doesn't have to be polished"
- **Evidence-first storytelling** — every graphic serves the argument, nothing is decorative

### 2.2 Typography

**Brand Typefaces (vox.com):**
- **Harriet Display** (OkayType) — Serif, display/headline, often italicized
- **Balto** (TypeSupply) — Sans-serif, headings and emphasis
- **Alright Sans** (OkayType) — Sans-serif, body text and supporting copy

**In-Video Typography Patterns:**
- Bold, large headlines dominate the frame when text is the primary element
- Text animation: slide-in reveals, typewriter character-by-character, scaling, opacity fades
- Title cards: two lines of text against a subtly textured background
- Text moves in sync with narration — sliding in, highlighting, color-blocking
- Lower thirds revealed step-by-step with frame-by-frame mask animation, text delayed a few frames after background shape
- Character-by-character reveals for emphasis statements
- Word-by-word for explanatory text
- Full-line reveals for section transitions

**Remotion Font Mapping** (Harriet not available in @remotion/google-fonts):
- **Display**: `PlayfairDisplay` (serif, closest to Harriet) or `Oswald` (condensed impact)
- **Body**: `Inter` or `DMSans` (closest to Alright Sans)

### 2.3 Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `highlight` | `#FFEB00` | **THE** signature — highlighter, emphasis bars, accents |
| `teal` | `#6D98A8` | Secondary accent, borders, data viz |
| `offWhite` | `#F1F3F2` | Light backgrounds, documentary feel |
| `charcoal` | `#4C4E4D` | Primary text on light backgrounds |
| `darkGray` | `#444745` | Text variant |
| `deepPurple` | `#35313F` | Dark backgrounds, overlays |
| `lightGray` | `#BBBBBB` | Secondary text, borders |
| `medGray` | `#AAAAAA` | Tertiary elements |
| `white` | `#FFFFFF` | Text on dark, clean surfaces |
| `warmBlack` | `#1A1A2E` | Rich dark for cinematic segments |

**Color Principles:**
- Limited palette per video — bright base + contrasting accent, never overwhelming
- Yellow `#FFEB00` is NON-NEGOTIABLE as signature accent
- Dark charcoal backgrounds with white/light text for information-dense screens
- Off-white backgrounds for cleaner documentary-feel segments
- Per-topic color theming within the brand palette
- Border accents: 5px solid, blue bottom, yellow top

### 2.4 The 12fps Stutter — Vox's Heartbeat

This is the single most important DNA trait. In Remotion at 30fps:

```ts
// Quantize frame to 12fps steps
const stutterFrame = (frame: number) => Math.floor(frame / 2.5) * 2.5;
```

**Rules for when to apply:**
- **ALWAYS on graphic elements**: text cards, shapes, icons, data viz elements
- **NEVER on photographs/footage**: Ken Burns pans stay smooth
- **SELECTIVE on transitions**: stutter during hold, smooth during fast entrance
- **Applied to**: position, scale, rotation. NOT applied to opacity (opacity stays smooth for comfort)
- Stutter makes graphics feel hand-placed, stop-motion, tactile
- Smooth footage feels cinematic, grounded in reality
- The CONTRAST between stuttered graphics and smooth footage is what creates the Vox feel

### 2.5 Animation Micro-Patterns

**Text Entrances:**
- **Headline slide-in**: From left, 8-12 frames, easeOut, arrives with 2px overshoot then settles
- **Body text fade-up**: translateY(s(20)) → 0, opacity 0→1, 10 frames, staggered 3 frames per line
- **Number counter**: Rolls up from 0 to target value over 15-20 frames, easeInOut
- **Labels**: Pop in (scale 0→1.05→1), 6 frames, slight overshoot
- **Character reveal**: 2 frames per character, mask-wipe from left, background highlight follows 4 frames behind

**Text Exits:**
- **Fade down**: opacity 1→0 + translateY(0→s(10)), 8 frames
- **Cut**: Instant disappear (jump cut feel) — used between major sections
- **Slide out**: Reverse of entrance direction, slightly faster than entrance

**Shape/Element Animation:**
- Background shapes: scale from center 0→1, 6-8 frames, appears BEFORE text (text delayed 4-6 frames)
- Divider lines: draw-on from left edge, 8 frames
- Icons: pop with 10% overshoot, 6 frames
- Highlight bars: width wipe 0%→100%, 10 frames, 1-2deg rotation for imperfection
- Stagger between elements: 4-6 frames (tighter than magazine's 12 frames)

**The Highlighter Effect (Signature Move):**
- Yellow `div` behind text, semi-transparent (opacity 0.85)
- Width animates 0% → 100% over 8-10 frames
- Height: 110% of text line-height (slightly taller)
- Rotation: 0.5-1.5deg (randomized per instance, subtle imperfection)
- Y-offset: -2px to +2px (slight vertical wobble)
- Appears BEHIND text (z-index lower)
- Color: `#FFEB00` at 85% opacity

**Timing and Rhythm:**
- Typical scene/card duration: 3-6 seconds
- Hold time before transition: 0.5-1s
- Element entries synced to narration word boundaries
- Stagger rhythm: regular 4-6 frame gaps
- Entrance → hold → exit ratio: roughly 20% / 60% / 20% of scene duration

**Spring/Physics:**
- Mild overshoot: 5-10% past target, settle in 4-6 frames
- No heavy bounce — Vox is confident, not playful
- Easing: custom cubic-bezier(0.25, 0.1, 0.25, 1.0) for entrances, linear for stuttered holds

### 2.6 Transition Patterns

- **Jump cut** (most common): Hard cut between scenes, no transition effect
- **Blur bridge**: 4-6 frame gaussian blur peaking at cut point, used between major sections
- **Scale zoom**: Quick zoom to 105% over 3 frames at section end, new section starts zoomed out
- **Match cut**: Visual element in scene A connects to related element in scene B
- **NO**: Dissolves, wipes, star wipes, or any "transition effect" look. Vox is editorial, not broadcast.

### 2.7 Layout Patterns (Expanded)

**1. Full-Screen Statement Card**
- Dark/charcoal background
- Large centered text (1-2 lines)
- Yellow accent element (underline, sidebar, or highlight)
- Film grain overlay
- Used for: key claims, surprising facts, section openers

**2. Annotated Evidence**
- Source image/document fills 70-80% of frame
- Annotation overlays: circles, arrows, highlight bars
- Small label card in corner with source attribution
- Yellow highlighter sweeps across key text
- Used for: citing sources, showing evidence, document analysis

**3. Data Reveal**
- Clean off-white or dark background
- Chart/number builds progressively
- Annotation callouts appear after data settles
- Yellow accent on the key data point
- Used for: statistics, trends, comparisons

**4. Collage Arrangement**
- 2-4 cutout images with rough edges arranged on textured background
- Parallax depth on hover/movement (layers at different z-depths)
- Labels float near each cutout
- Used for: introducing people, showing examples, visual categorization

**5. Map/Geographic**
- Desaturated base map or solid color region shapes
- Animated borders drawing on
- Location pin drops with radar pulse
- Label cards appearing at locations
- Yellow highlight on focus region
- Used for: location context, geopolitical content, travel

**6. Split Evidence**
- Frame divided vertically or horizontally
- One side: evidence (photo, document, data)
- Other side: interpretation (text, annotation, callout)
- Divider: rough-textured line, not clean
- Used for: before/after, claim vs reality, comparison

**7. Process/Flow**
- Steps arranged vertically or horizontally
- Each step reveals sequentially
- Connecting arrows/lines draw on between steps
- Active step highlighted yellow, completed steps dim
- Used for: explaining processes, cause-effect chains, timelines

**8. Question Card**
- Large serif question text centered
- "?" or "But why?" as visual anchor
- Subtle background texture shift
- Minimal — just the question and negative space
- Used for: rhetorical questions, section pivots, creating curiosity

**9. Definition/Term Spotlight**
- Term in large bold serif
- Definition in smaller sans-serif below
- Yellow underline on the term
- Optional pronunciation guide or origin note
- Used for: introducing jargon, explaining concepts

**10. Counter/Ticker**
- Single large number that counts up/down
- Unit label below or beside
- Contextual comparison line (e.g., "That's 3x more than...")
- Yellow accent on the number itself
- Used for: shocking statistics, scale visualization

---

## Part III: Pipeline DNA Architecture

### 3.1 Current Pipeline Flow (Where Theme Touches Today)

```
Brief → Orchestrator (picks theme string)
  ↓
Planner (gets {{THEME}}, calls browse_templates, reads theme.md)
  → Outputs: SCENE_PLAN.md with scene types + template assignments
  ↓
Setup Agent (reads theme.md, extracts tokens → constants.ts, forks templates → src/theme/)
  → Outputs: workspace with constants.ts, Background.tsx, scene skeletons, shared lib
  ↓
Animators ×N in parallel (reads skeleton, constants.ts, theme/, SCENE_PLAN.md brief)
  → Outputs: animated Scene{N}.tsx files
  ↓
Caption Agent (reads theme fonts/colors)
  → Outputs: caption track with theme-styled text
```

**The problem**: Theme only provides TOKENS (colors, fonts, timing) and COMPONENTS (shared lib). It doesn't provide CREATIVE DIRECTION. The planner uses the same storytelling logic for magazine and vox. The animator uses the same motion principles. Only the colors and textures change.

### 3.2 Proposed DNA Injection Points

A theme's DNA should inject at EVERY creative decision point:

#### Layer 1: Theme Manifest (`packages/templates/src/vox/theme.json`)

New file — machine-readable theme definition:
```json
{
  "slug": "vox",
  "name": "Vox Explainer",
  "version": "1.0.0",
  "fontPair": "voxEditorial",
  "dna": {
    "planner": "planner-dna.md",
    "animator": "animator-dna.md",
    "caption": "caption-dna.md",
    "antiPatterns": "anti-patterns.md"
  },
  "sharedLib": [
    "constants.ts",
    "animations.ts",
    "effects.tsx",
    "textures.tsx",
    "typography.tsx",
    "decorations.tsx"
  ]
}
```

#### Layer 2: Planner DNA (`planner-dna.md`)

Injected into the planner's system prompt when theme=vox. This tells the planner HOW VOX STRUCTURES STORIES:

```markdown
## Vox Storytelling Structure

### Opening Pattern (first 15-20 seconds)
Vox videos ALWAYS open with one of:
1. **Surprising claim** — a bold statement that challenges assumptions ("This tiny line on a map caused a war")
2. **Visual mystery** — show something unexpected, then ask "why?" ("Look at this chart. Notice anything weird?")
3. **Personal hook** — connect to viewer's experience ("You've probably seen this but never thought about why")

NEVER open with: definitions, history, or "today we'll talk about..." — that's lecture style, not Vox.

### Scene Flow Pattern
Vox videos follow a SPIRAL structure, not linear:
1. Hook (surprising claim)
2. Zoom out (broader context)
3. Zoom in (specific evidence)
4. New angle (reframe the question)
5. Deeper evidence (data, documents, experts)
6. Synthesis (connect the dots)
7. Implications (so what?)

Each scene should be 3-6 seconds. Vox scenes are SHORT and punchy.

### Scene Type Selection
When choosing visual approaches for scenes:
- If the scene CLAIMS something → use Statement Card or Highlight
- If the scene PROVES something → use Annotated Evidence or Data Reveal
- If the scene COMPARES things → use Split Evidence or Versus
- If the scene LOCATES something → use Map/Geographic
- If the scene QUESTIONS something → use Question Card
- If the scene DEFINES something → use Definition Spotlight
- If the scene QUANTIFIES something → use Counter/Ticker or Bar Chart
- If the scene SHOWS PROCESS → use Process/Flow or Timeline
- If the scene INTRODUCES PEOPLE → use Collage or Profile

### Display Mode Guidance
- Overlay scenes: prefer for PUNCHY moments (key stats, bold claims, single words)
- Stacked scenes: prefer for EVIDENCE (data + speaker explaining it)
- Fullscreen scenes: prefer for COMPLEX VISUALS (maps, charts, process diagrams)
```

#### Layer 3: Animator DNA (`animator-dna.md`)

Injected into animator's system prompt. This tells the animator HOW VOX MOVES:

```markdown
## Vox Motion DNA

### The Stutter Rule
ALL graphic elements (text, shapes, icons, data) animate at 12fps stutter:
```ts
const sf = (f: number) => Math.floor(f / 2.5) * 2.5;
// Use sf(frame) for ALL position/scale/rotation interpolations on graphics
```
Photographs and video footage stay at full 30fps (smooth Ken Burns pans).
Opacity transitions stay at full 30fps (stuttered opacity looks broken, not stylish).

### Entrance Vocabulary
| Move | When to use | Implementation |
|------|-------------|----------------|
| **Slide-in** | Headlines, labels | translateX/Y with easeOut, 8-12 stuttered frames |
| **Pop** | Icons, data points | scale 0→1.08→1, 6 frames |
| **Highlight sweep** | Key claims, evidence text | Yellow bar width 0%→100%, 1deg rotation |
| **Typewriter** | Definitions, quotes | Character mask-wipe, 2 frames/char |
| **Draw-on** | Lines, borders, connectors | Width/height or stroke animation, 8-12 frames |
| **Progressive build** | Charts, lists, steps | Each item enters 4-6 frames after previous |
| **Parallax reveal** | Collage cutouts | Multiple layers at different translateZ speeds |

### Hold/Idle Vocabulary
Vox holds are NOT static. Every element has micro-motion during holds:
- Text: subtle 0.5px vertical breathe (sine, 60-frame period)
- Shapes: very gentle scale oscillation (0.998–1.002, 90-frame period)
- Background texture: cycling grain offset every 8-10 frames
- NO rotation idle. Vox elements don't wobble.

### Exit Vocabulary
- **Fade-down**: opacity + translateY down, 6-8 frames (most common)
- **Jump cut**: instant disappear, no animation (between major sections)
- **Slide-out**: reverse of entrance, 20% faster

### Surface Treatment
Every scene has:
1. **Film grain** — cycling noise at 25-35% opacity over entire scene
2. **Warm shift** — slight warm color temperature (+3-5% toward amber)
3. **Rough edges** — any rectangular shape gets feTurbulence displacement on its clip-path
4. NO drop shadows (too corporate). NO gradients on text. NO glossy surfaces.

### Color Usage Per Scene
- Pick 2 colors from theme: one dominant (background or large shape), one accent
- Yellow highlight is RESERVED for the single most important element per scene
- If a scene has no "most important" element, don't use yellow at all
- Gray tones for supporting/secondary elements
- NEVER use all theme colors in one scene — restraint is Vox

### Typography Rules
- Headlines: serif (PlayfairDisplay), bold, s(48)-s(64)
- Body/labels: sans (Inter), regular or medium, s(24)-s(32)
- Numbers: sans (Inter), bold, s(56)-s(72) for hero stats
- NEVER: italic body text, outlined text, all-caps body text
- ALL-CAPS only for: labels, section markers, tiny attribution text
```

#### Layer 4: Caption DNA (`caption-dna.md`)

```markdown
## Vox Caption Style

### Typography
- Font: Inter (sans-serif, clean)
- Hero words: bold, white, large
- Satellite words: regular, slightly dimmed

### Behavior
- Captions should feel like annotations, not subtitles
- Hero budget: LOWER than magazine (25-35%) — Vox is conversational, not dramatic
- Highlight key TERMS and DATA, not emotional words
- Yellow highlight on first occurrence of a key term only

### Anti-patterns
- No kinetic-luxe swooping. Vox captions are grounded.
- No color cycling. Consistent white/near-white.
- Minimal scale animation. Words appear, they don't dance.
```

#### Layer 5: Anti-Patterns (`anti-patterns.md`)

Injected into ALL agents. Tells them what BREAKS the Vox feel:

```markdown
## What is NOT Vox

### Animation Anti-Patterns
- NO smooth 30fps on graphic elements (must stutter at 12fps)
- NO bounce/elastic springs on text (too playful — Vox is confident, not cute)
- NO rotating idle animations (elements don't spin or wobble)
- NO particle effects or floating elements
- NO 3D transforms or perspective rotations
- NO neon glows, lens flares, or light rays
- NO stroke-based animations (strokeDasharray is banned)

### Visual Anti-Patterns
- NO gradients on text
- NO drop shadows (too corporate)
- NO glossy/glass surfaces
- NO perfectly rounded corners on everything (rough edges preferred)
- NO clean vector illustrations (prefer cutout/collage aesthetic)
- NO symmetric layouts (slight asymmetry is intentional)
- NO more than 3 colors per scene (including background)

### Storytelling Anti-Patterns
- NO "Today we'll learn about..." openings
- NO linear chronological structure (spiral, not timeline)
- NO scene that exists only to be pretty (every scene serves the argument)
- NO transitions for the sake of transitions (prefer jump cuts)
- NO "in conclusion" or "to summarize" — just end with the strongest point

### Texture Anti-Patterns
- NO clean, sterile backgrounds (always have grain or texture)
- NO pure white (#FFFFFF) backgrounds — use off-white (#F1F3F2)
- NO pure black (#000000) — use warm charcoal (#4C4E4D) or deep purple (#35313F)
```

### 3.3 How DNA Flows Through Pipeline

```
Brief → Orchestrator picks theme="vox"
  ↓
  ├─ Copies theme.md (design tokens) → /workspace/docs/guidelines/theme.md
  ├─ Copies planner-dna.md → /workspace/docs/guidelines/planner-dna.md
  ├─ Copies animator-dna.md → /workspace/docs/guidelines/animator-dna.md
  ├─ Copies caption-dna.md → /workspace/docs/guidelines/caption-dna.md
  ├─ Copies anti-patterns.md → /workspace/docs/guidelines/anti-patterns.md
  ↓
Planner
  ├─ Reads planner-dna.md → knows Vox storytelling structure
  ├─ Reads anti-patterns.md → knows what NOT to plan
  ├─ Calls browse_templates(theme: "vox") → discovers vox templates
  ├─ Selects scene types from Vox vocabulary (not generic)
  └─ SCENE_PLAN.md uses Vox scene terminology and Vox pacing (3-6s scenes)
  ↓
Setup Agent
  ├─ Reads theme.md → extracts Vox tokens to constants.ts
  ├─ Includes stutterFrame helper in constants.ts (DNA-specific utility)
  ├─ Forks vox templates → src/theme/vox/ shared library
  └─ Scene skeletons import from vox shared lib
  ↓
Animators ×N
  ├─ Reads animator-dna.md → knows 12fps stutter rule, entrance vocabulary, hold behaviors
  ├─ Reads anti-patterns.md → knows what NOT to animate
  ├─ Uses sf() stutter helper from constants
  ├─ Uses vox shared lib (FilmGrain, HighlighterMark, RoughEdgeMask, etc.)
  └─ Every scene has: grain, stutter, rough edges, restrained color, evidence-first layout
  ↓
Caption Agent
  ├─ Reads caption-dna.md → lower hero budget, annotation feel, no kinetic swooping
  └─ Captions styled as grounded annotations
```

### 3.4 Implementation: What Changes in the Codebase

#### A. New theme directory structure

```
packages/templates/src/vox/
├── theme.json              # NEW: Machine-readable manifest
├── constants.ts            # Design tokens (colors, fonts, timing, springs)
├── animations.ts           # Vox-specific: stutterFrame, highlighterSweep, maskWipeReveal, etc.
├── effects.tsx             # FilmGrain, ChromaticAberration, RoughEdgeMask, HighlighterMark, LensBlur
├── textures.tsx            # ConstructionPaper, NewsprintOverlay, GrainCycle
├── typography.tsx          # VoxHeadline, VoxLabel, VoxAnnotation, VoxLowerThird, VoxCounter
├── decorations.tsx         # HighlighterStroke, AnnotationCircle, AnnotationArrow, CutoutFrame, SourceBadge
├── planner-dna.md          # NEW: Storytelling structure injected into planner
├── animator-dna.md         # NEW: Motion language injected into animator
├── caption-dna.md          # NEW: Caption behavior injected into caption agent
└── anti-patterns.md        # NEW: What NOT to do, injected into all agents
```

#### B. Prompt loader changes (`prompt-loader.ts`)

```ts
// After existing {{THEME}} injection, also load DNA files:
if (ctx.theme) {
  const dnaPath = `docs/guidelines/${ctx.theme}`;
  // Planner gets planner-dna.md appended
  // Animator gets animator-dna.md appended
  // Caption agent gets caption-dna.md appended
  // ALL agents get anti-patterns.md appended
}
```

#### C. Setup agent changes

```ts
// In addition to extracting shared lib to src/theme/vox/,
// also copy DNA docs to workspace:
// /workspace/docs/guidelines/planner-dna.md
// /workspace/docs/guidelines/animator-dna.md
// /workspace/docs/guidelines/caption-dna.md
// /workspace/docs/guidelines/anti-patterns.md
```

#### D. Orchestrator changes

```ts
// When dispatching each agent, include DNA file reference:
// "Read /workspace/docs/guidelines/animator-dna.md for theme-specific motion rules"
// "Read /workspace/docs/guidelines/anti-patterns.md for what NOT to do"
```

#### E. Font pair registration (`fonts.ts`)

```ts
voxEditorial: {
  display: PlayfairDisplay,
  body: Inter,
  label: "Vox Editorial"
}
```

#### F. Template registration

Each vox template's `meta.json`:
```json
{
  "themes": ["vox"],
  "stylePreset": "voxEditorial"
}
```

---

## Part IV: Complete Template Catalog

### 4.1 Core Scene Types (Templated)

These are the bread-and-butter scenes that appear in nearly every Vox video.

#### Text & Statement

| Slug | Category | Description | When to Use |
|------|----------|-------------|-------------|
| `vox-headline` | text-typography | Full-screen bold statement card. Large serif text centered, yellow accent bar, film grain, off-white or charcoal background. | Opening hooks, bold claims, section openers, key takeaways |
| `vox-highlight` | text-typography | Document/text with animated yellow highlighter sweep across key phrases. Source attribution in corner. | Citing evidence, quoting sources, showing text from documents |
| `vox-definition` | text-typography | Key term in large bold serif with typewriter reveal, definition in sans below, yellow underline on term. | Introducing jargon, explaining concepts, first use of technical terms |
| `vox-quote` | text-typography | Pull quote with large serif text in quotation marks, yellow highlight on key phrase, speaker attribution below. | Expert quotes, historical quotes, document excerpts |
| `vox-question` | text-typography | Large centered question text with "?" as visual anchor. Minimal — just the question and negative space. Subtle texture shift. | Rhetorical questions, section pivots, creating curiosity |
| `vox-label` | text-typography | Clean contextual label card: location, date, source. Small caps, sans-serif, subtle background bar. | Scene-setting, source attribution, temporal context |

#### Data & Numbers

| Slug | Category | Description | When to Use |
|------|----------|-------------|-------------|
| `vox-stats` | data-visualization | Single hero number with counter animation (rolls up), unit label, contextual comparison line below. Yellow accent on the number. | Shocking statistics, scale visualization, key data points |
| `vox-barchart` | data-visualization | Animated horizontal/vertical bar chart. Bars grow sequentially with stutter. Annotation callouts on key bars. Yellow highlight on the surprising bar. | Comparing quantities, showing rankings, distribution data |
| `vox-linechart` | data-visualization | Animated line graph with progressive draw-on. Annotation dots at key inflection points. Shaded area below line. | Trends over time, growth/decline, before/after periods |
| `vox-piechart` | data-visualization | Animated pie/donut chart with segments revealing sequentially. Percentage labels pop in after segment. | Proportions, market share, demographic breakdowns |
| `vox-counter` | data-visualization | Large number that ticks up/down in real-time with unit. Side-by-side comparison variant ("3x more than..."). | Live counting, scale comparison, shocking quantities |
| `vox-stacked` | data-visualization | Stacked area or stacked bar chart showing composition over time. Color-coded layers with labels. | Showing how parts make up a whole, changing composition |

#### Comparison & Analysis

| Slug | Category | Description | When to Use |
|------|----------|-------------|-------------|
| `vox-versus` | comparison | A vs B split with rough divider. Each side has label + key metric. Yellow highlight on the winner/difference. | Direct comparisons, policy alternatives, competing claims |
| `vox-beforeafter` | comparison | Horizontal split or overlay-toggle showing before and after states. Rough divider line between. | Showing change over time, impact of events, transformation |
| `vox-factcheck` | comparison | Claim card (dimmed/strikethrough) → correction card (yellow highlighted). Progressive reveal: claim first, then reality. | Debunking myths, correcting misconceptions, fact-checking |
| `vox-spectrum` | comparison | Continuous scale/spectrum with labeled endpoints and positioned markers. | Showing where things fall on a continuum, political spectrums |
| `vox-matrix` | comparison | 2×2 grid with labeled axes and items placed in quadrants. | Categorizing along two dimensions, strategic analysis |

#### Structure & Process

| Slug | Category | Description | When to Use |
|------|----------|-------------|-------------|
| `vox-process` | structure | Numbered step sequence (vertical or horizontal). Each step reveals with stagger. Connecting lines draw on. Active step yellow, completed dim. | Explaining how something works, procedures, mechanisms |
| `vox-causeeffect` | structure | Chain of cause → effect boxes with animated arrow connectors. Can branch for multiple effects. | Explaining consequences, chain reactions, policy impacts |
| `vox-timeline` | structure | Horizontal timeline with dated events. Marker drops at each date. Active period highlighted yellow. | Historical context, chronology, event sequences |
| `vox-funnel` | structure | Narrowing stages showing reduction/filtering. Each stage labeled with count/percentage. | Showing attrition, selection processes, narrowing down |
| `vox-tree` | structure | Hierarchical branching diagram. Parent → children reveal with draw-on connections. | Organizational structure, decision trees, classification |
| `vox-cycle` | structure | Circular process with steps arranged in a loop. Arrow follows the cycle path. | Recurring processes, feedback loops, systems |

#### Geographic & Location

| Slug | Category | Description | When to Use |
|------|----------|-------------|-------------|
| `vox-map` | geographic | Simplified map region with animated border draw-on. Location pin drops with radar pulse. Label cards at locations. Desaturated palette with yellow highlight on focus area. | Location context, geopolitical content, regional analysis |
| `vox-country` | geographic | Country silhouette outline with key stats inside or beside. Flag-colored accent. | Country profiles, national statistics, international comparison |
| `vox-location` | geographic | Location pin with place name, coordinates display, and contextual details card. | Setting the scene, where something happened |

#### Narrative & Evidence

| Slug | Category | Description | When to Use |
|------|----------|-------------|-------------|
| `vox-collage` | narrative | 2-4 cutout images with rough edges, arranged on textured background. Parallax depth layers. Labels near each cutout. | Introducing multiple people/things, visual categorization |
| `vox-annotation` | narrative | Image/photo with animated overlays: circles, arrows, underline marks, and label callouts. Progressive annotation reveal. | Analyzing images, pointing out details, visual evidence |
| `vox-profile` | narrative | Person's name, title, key fact in a clean card layout. Optional photo cutout with rough edge. | Introducing experts, key figures, interview subjects |
| `vox-source` | narrative | Source document/screenshot with zoom and highlight. Attribution badge in corner. | Citing primary sources, showing original documents |
| `vox-evidence` | narrative | Split layout: evidence on one side (image/doc), interpretation on other (text callout). Rough divider. | Presenting proof, connecting evidence to argument |

#### Lists & Rankings

| Slug | Category | Description | When to Use |
|------|----------|-------------|-------------|
| `vox-ranking` | data-visualization | Numbered ranked list. Items enter with stagger from bottom. #1 highlighted yellow. Optional metric beside each. | Top N lists, ordered comparisons, priority lists |
| `vox-checklist` | structure | Items with check/cross marks revealing sequentially. Checks in teal, crosses in muted red. | Criteria evaluation, requirements, qualifying conditions |
| `vox-bullets` | text-typography | Bulleted list with progressive reveal. Each bullet slides in from left with stagger. Key terms in bold. | Supporting points, evidence lists, feature lists |
| `vox-proscons` | comparison | Two-column layout: pros (teal) and cons (muted red). Items stagger in alternately. | Weighing options, evaluating trade-offs |

#### Emphasis & Alert

| Slug | Category | Description | When to Use |
|------|----------|-------------|-------------|
| `vox-alert` | text-typography | Yellow alert bar with bold text. Film grain heavier than usual. Slight camera shake on entrance. | Breaking information, critical warnings, pivotal moments |
| `vox-callout` | text-typography | Boxed callout with rough edge, icon + text. Slightly rotated (1-2deg). | Important side notes, contextual additions, "fun fact" |
| `vox-takeaway` | text-typography | Key takeaway card with numbered points. Clean layout, strong hierarchy. Yellow marker on number. | Summarizing arguments, key insights, concluding points |
| `vox-verdict` | comparison | Final judgment/conclusion card. Large serif verdict text with supporting rationale below. | Conclusions, final analysis, editorial opinion |

### 4.2 Template Count: 38

This gives complete coverage of Vox's visual vocabulary:
- 6 Text & Statement
- 6 Data & Numbers
- 5 Comparison & Analysis
- 6 Structure & Process
- 3 Geographic & Location
- 5 Narrative & Evidence
- 4 Lists & Rankings
- 4 Emphasis & Alert

Every scene type that appears in a Vox video maps to at least one template. The animator can also create non-template scenes using the shared library directly.

---

## Part V: Shared Library Specification

### 5.1 `constants.ts`

```ts
// === COLORS ===
export const VOX_COLORS = {
  highlight: '#FFEB00',      // THE signature yellow
  teal: '#6D98A8',           // Secondary accent
  offWhite: '#F1F3F2',       // Light backgrounds
  charcoal: '#4C4E4D',       // Primary text
  darkGray: '#444745',       // Text variant
  deepPurple: '#35313F',     // Dark backgrounds
  lightGray: '#BBBBBB',      // Secondary text
  medGray: '#AAAAAA',        // Tertiary
  white: '#FFFFFF',          // Text on dark
  warmBlack: '#1A1A2E',      // Rich dark cinematic
  mutedRed: '#C84B4B',       // Negative/cons (never bright red)
  mutedGreen: '#5B8A72',     // Positive/pros (never bright green)
} as const;

// === FONTS ===
export const VOX_FONTS = {
  headline: 'Playfair Display',  // Serif display
  body: 'Inter',                 // Clean sans
  mono: 'JetBrains Mono',       // Data/code
} as const;

// === FONT SIZES (at 1080px base) ===
export const VOX_SIZES = {
  hero: 72,         // Single big number
  h1: 56,           // Main headline
  h2: 44,           // Sub-headline
  h3: 36,           // Section label
  body: 28,         // Body text
  label: 22,        // Small labels
  tiny: 16,         // Attribution, fine print
} as const;

// === TIMING ===
export const VOX_TIMING = {
  stutterStep: 2.5,          // Frames per 12fps step (30fps / 12fps)
  entranceDuration: 10,      // Default entrance frames
  exitDuration: 8,           // Default exit frames
  staggerDelay: 5,           // Frames between staggered items
  holdMinimum: 20,           // Minimum hold before exit
  highlighterSpeed: 10,      // Frames for highlight sweep
  typewriterSpeed: 2,        // Frames per character
  drawOnSpeed: 10,           // Frames for line draw-on
} as const;

// === SPRING ===
export const VOX_SPRING = {
  // Vox uses mild overshoot, NOT bouncy
  entrance: { damping: 20, stiffness: 180, mass: 1 },
  settle: { damping: 25, stiffness: 200, mass: 1 },
  // No heavy bounce config — Vox is confident, not playful
} as const;

// === EASING ===
export const VOX_EASING = {
  entrance: [0.25, 0.1, 0.25, 1.0],   // Smooth ease-out
  exit: [0.4, 0.0, 1.0, 1.0],          // Quick ease-in
  linear: [0, 0, 1, 1],                // For stuttered holds
} as const;

// === GRAIN ===
export const VOX_GRAIN = {
  opacity: 0.3,           // 25-35% range
  cycleFrames: 8,         // Grain shifts every N frames
} as const;

// === ROUGH EDGE ===
export const VOX_ROUGH = {
  turbulenceFrequency: 0.04,
  displacementScale: 3,
  seed: 42,               // Override per-element for variety
} as const;

// === STUTTER HELPER ===
export const sf = (frame: number): number =>
  Math.floor(frame / VOX_TIMING.stutterStep) * VOX_TIMING.stutterStep;
```

### 5.2 `animations.ts`

Key functions the shared library must export:

| Function | Signature | Description |
|----------|-----------|-------------|
| `sf(frame)` | `(frame: number) => number` | Stutter-frame quantizer (12fps at 30fps) |
| `voxEntrance(frame, start, duration, direction)` | Returns `{ opacity, translateX, translateY }` | Stuttered slide-in with easeOut |
| `voxExit(frame, start, duration)` | Returns `{ opacity, translateY }` | Fade-down exit |
| `highlighterSweep(frame, start, duration)` | Returns `{ width%, rotation, yOffset }` | Yellow bar growing across text |
| `typewriterReveal(frame, start, text, speed)` | Returns `{ visibleChars, maskWidth }` | Character-by-character mask reveal |
| `drawOn(frame, start, duration)` | Returns `{ progress 0-1 }` | For lines, borders, connectors |
| `counterRoll(frame, start, duration, target)` | Returns `{ displayValue }` | Number counting up to target |
| `progressiveBuild(frame, start, itemCount, stagger)` | Returns `{ visibleItems, itemOpacities[] }` | Staggered item reveals |
| `parallaxShift(frame, depth, amplitude)` | Returns `{ translateX, translateY }` | Depth-based parallax offset |
| `voxIdle(frame, seed, type)` | Returns `{ translateY } or { scale }` | Micro-motion during holds |
| `popIn(frame, start, duration)` | Returns `{ scale, opacity }` | Scale 0→1.08→1 with overshoot |

### 5.3 `effects.tsx`

| Component | Props | Description |
|-----------|-------|-------------|
| `FilmGrain` | `{ opacity?, cycleFrames?, seed? }` | Cycling SVG noise overlay. Frame-aware — shifts pattern every N frames. |
| `ChromaticAberration` | `{ offset?, children }` | Wraps children, renders 3 layers (red/green/blue) offset by N pixels. |
| `RoughEdgeMask` | `{ frequency?, scale?, seed?, children }` | SVG feTurbulence + feDisplacementMap on clip-path. Wraps children in jagged container. |
| `HighlighterMark` | `{ width, height, rotation?, color?, opacity? }` | Positioned yellow rectangle with slight rotation for imperfect highlight feel. |
| `LensBlur` | `{ amount?, radius?, children }` | Radial gradient mask with gaussian blur at edges. |
| `WarmShift` | `{ intensity?, children }` | Subtle warm color temperature overlay (+amber). |

### 5.4 `textures.tsx`

| Component | Props | Description |
|-----------|-------|-------------|
| `ConstructionPaper` | `{ color?, opacity?, seed? }` | SVG feTurbulence base texture simulating paper fibers. |
| `NewsprintOverlay` | `{ opacity?, dotSize?, seed? }` | Halftone dot-matrix pattern at low opacity. |
| `GrainCycle` | `{ frame, opacity?, speed? }` | Frame-aware cycling grain texture. Shifts every `speed` frames for organic movement. |

### 5.5 `typography.tsx`

| Component | Props | Description |
|-----------|-------|-------------|
| `VoxHeadline` | `{ text, size?, color?, accentBar?, accentColor? }` | Large serif headline. Optional yellow accent bar (left side or underline). |
| `VoxBody` | `{ text, size?, color?, maxWidth? }` | Clean sans-serif body text with controlled line-height. |
| `VoxLabel` | `{ text, color?, background? }` | Small caps sans label with optional rough background shape. |
| `VoxCounter` | `{ value, unit?, size?, color? }` | Large animated number display. Integrates with `counterRoll` animation. |
| `VoxAnnotation` | `{ type, x, y, size?, color?, label? }` | Annotation mark (circle, arrow, underline) at specified position. Uses RoughEdgeMask for imperfection. |
| `VoxLowerThird` | `{ name, title, delay? }` | Two-line lower third with rough background shape. Background enters first, text delayed. |
| `VoxQuestion` | `{ text, size? }` | Large centered question with "?" as visual anchor. |
| `VoxSourceBadge` | `{ source, position? }` | Small attribution badge ("Source: WHO, 2024") in specified corner. |

### 5.6 `decorations.tsx`

| Component | Props | Description |
|-----------|-------|-------------|
| `HighlighterStroke` | `{ width, rotation?, color?, thickness? }` | Horizontal marker-pen stroke. Animated via `highlighterSweep`. |
| `AnnotationCircle` | `{ cx, cy, radius, color?, strokeWidth? }` | Rough circle drawn around a focal point. Uses RoughEdgeMask. |
| `AnnotationArrow` | `{ from, to, color?, headSize? }` | Arrow pointing from one position to another. Rough, not clean vector. |
| `CutoutFrame` | `{ width, height, rotation?, seed?, children }` | Rough-edged container for photo/image cutouts. |
| `RoughDivider` | `{ direction, length, color?, thickness? }` | Horizontal or vertical divider with textured/rough appearance. |
| `SourceDocument` | `{ children, tilt?, shadow? }` | Slightly tilted document frame with paper texture background. |

---

## Part VI: What This Enables

With full DNA injection, creating a Vox-style video becomes:

1. **Planner** reads `planner-dna.md` → structures the video as "hook → zoom out → evidence → reframe → deeper → synthesis → implication" (Vox spiral, not generic linear)
2. **Planner** uses Vox scene vocabulary → assigns `vox-factcheck` for debunking scenes, `vox-annotation` for evidence analysis (not just "text card")
3. **Setup Agent** extracts Vox tokens → `sf()` stutter helper available to all animators
4. **Animators** read `animator-dna.md` → every graphic stutters at 12fps, every scene has film grain, highlights are yellow and imperfect, entrances use Vox vocabulary
5. **Animators** read `anti-patterns.md` → no smooth graphics, no bounce, no gradients on text, no drop shadows
6. **Caption Agent** reads `caption-dna.md` → annotations not subtitles, lower hero budget, grounded feel
7. **Result**: Video FEELS like Vox even on scenes that don't use a template, because every agent internalized the DNA

Compare to today: planner would structure the video generically, animator would use smooth 30fps animation with magazine-like editorial reveals, captions would have kinetic-luxe swooping. Same content, completely wrong feel.

---

---

## Part VII: Deep Motion DNA — Micro-Animation Specifications

> From forensic analysis of After Effects breakdowns, motion designer interviews, and frame-by-frame reverse engineering.

### 7.1 Easing — NOT Default EasyEase

Vox uses **75% influence** bezier curves, NOT the After Effects default 33.33% EasyEase. This creates a much more aggressive S-curve: "fast take-off, slow landing" — elements accelerate quickly from start and decelerate slowly into resting position.

In Remotion terms:
```ts
// Vox easing (75% influence equivalent)
const voxEaseOut = Easing.bezier(0.25, 0.1, 0.25, 1.0);
// NOT the default cubic which is much gentler
```

### 7.2 Opacity/Position Offset Rule

Opacity ALWAYS leads position by 3-6 frames. The element starts fading in BEFORE it starts moving, so it's partially visible as it slides into place. This creates a layered, intentional feel.

```
Frame 0:  opacity starts 0→1 transition
Frame 4:  position starts moving
Frame 12: position arrives at target
Frame 14: opacity reaches 1.0
```

### 7.3 Background-Before-Text Rule

Background shapes ALWAYS enter before their text content:
- Background: appears at frame 0 of the element's entrance
- Text: delayed 6-12 frames after background settles
- This creates the Vox "step-reveal" signature

### 7.4 Exit = 75% of Entrance Duration

If an entrance takes 12 frames, the exit takes 9 frames. Exits are always faster.
- Exit direction: reverse of entrance (slide DOWN if entered UP)
- Exit hierarchy: last element in = first element out (reverse stagger)
- Opacity drops FASTER than position changes — element is mostly transparent before it finishes moving

### 7.5 Overshoot Specifications

Vox overshoot follows a 50%-decay-per-bounce pattern:
```
Bounce 1: 110-115% of target (first overshoot)
Bounce 2: 93-95% (undershoot)
Bounce 3: 103-105% (settling)
Bounce 4: 98-99% (nearly there)
Final: 100% (settled)
```
Total settle time: 10-15 frames (0.4-0.6s) after initial arrival.

Spring parameters for Remotion:
- Primary elements: `damping: 20-22, stiffness: 180-220` (controlled settle)
- Secondary/trailing elements: `damping: 18-20` (slightly more bounce — follow-through)

### 7.6 The Highlighter — Precise Specification

From After Effects reverse-engineering:
- **Method**: Generate > Stroke effect on a solid yellow layer, animated via Stroke "End" parameter 0%→100%
- **Duration**: ~20-30 frames (0.8-1.2s at 24fps, ~25-35 frames at 30fps)
- **Sweep**: Left-to-right wipe (not a width grow — it's a mask wipe)
- **Multi-line**: "Stroke Sequentially" — each line sweeps after previous completes
- **Blend mode**: Multiply (yellow tints underlying text, doesn't obscure it)
- **Path**: Deliberately imperfect — slight curves and irregularity in the mask path, NOT a perfectly straight line
- **Height**: 100-120% of text cap-height (full coverage, not a thin underline)
- **No overshoot**: Clean sweep from 0→100%, no bounce-back
- **Speed**: Matched to narrator's reading speed of the highlighted phrase

### 7.7 The Lower Third — Frame-by-Frame Specification

1. Background bar appears via irregular mask expansion: mask path manually increased with deliberate frame-skipping, creating jagged "eaten in reverse" appearance
2. Frame-by-frame: NOT a smooth wipe. Individual frames jump the mask boundary in irregular increments
3. Texture: 5-6 texture frames cycling at 2-3/sec over the background shape
4. Text layer: delayed 6-8 frames AFTER background is fully revealed
5. Combined with 12fps stutter for the final lo-fi editorial feel
6. Chromatic aberration applied at edges (1-2px RGB split + 3.5px Gaussian blur, masked to edges via 50pt feather circle)

### 7.8 Counter/Number Animation

- Ticks from 0 to target over 30-45 frames (1.0-1.5s at 30fps)
- Uses ease-out curve: decelerates as it approaches final value
- **Overshoot**: Number briefly exceeds target by 8-12% before settling back
- Optional micro-pulse on arrival: scale 1.0→1.08→1.0 over 6 frames
- At 12fps stutter: numbers jump in visible discrete increments (adds drama)

### 7.9 Timing Rhythm

- **20-second rule**: Major visual/musical change every 20 seconds ("every 20 seconds I'm stopping and changing a song" — Joss Fong, Vox editor)
- **3-5 seconds**: Every narration beat has corresponding visual content change
- **Opening hook**: ALWAYS fast-paced ("there's so many options right next to your video")
- **Scene durations**:
  - Hook: 7-8 seconds
  - Build/tension: ~10 seconds
  - Deep explanation: 12-15 seconds
  - Close/payoff: 7-8 seconds
  - Maximum: 15 seconds per scene

### 7.10 Three-Layer Composition Rule

Every Vox frame has 3 simultaneous layers of motion:
1. **Ambient background** — continuous grain cycling, subtle texture shift, or color drift (10-15% visual weight)
2. **Primary element** — the hero graphic/text currently being narrated
3. **Secondary details** — supporting labels, annotations, or decorative elements that entered earlier and are now in "idle" micro-motion

Never just one moving thing on screen. Never a completely static frame.

---

## Part VIII: Data Visualization Patterns — Expanded

> From analysis of Alvin Chang's data journalism, Bard Edlund's Vox.com commissions, and Vox Explained Netflix series.

### 8.1 Unit/Isotype Visualizations (Vox Signature)

Vox's most distinctive data format. Instead of abstract bars or lines, individual markers represent each unit:
- 100 dots = 100% of population in a 3D environment
- Dots move, regroup, and transform to show data shifts
- Makes abstract statistics feel PERSONAL by giving each data point physical presence
- Example: "All Student Debt in the US" — every person with student debt as an individual marker

### 8.2 Narrative Chart Titles

Vox NEVER uses technical axis labels as titles. Instead:
- ~~"U.S. Wind Energy Capacity 1981-2024"~~
- ✓ "Since 2005, wind power has grown X times bigger"
- Titles are CLAIMS, not descriptions. This is the editorial voice in data viz.

### 8.3 Cartoon System Diagrams

Alvin Chang's approach: cartoon characters with "real goals and fleshed out personalities" represent stakeholders in complex systems (e.g., how the individual mandate works). Not org charts — narrative illustrations.

### 8.4 Metaphorical Simplification

Abstract concepts get concrete visual proxies:
- Sandwich metaphor for corporate tax reform
- Cereal bowl for the GOP tax bill
- Construction paper clocks for work-hour comparisons
- Paper-craft pie charts for budget breakdowns

These are NOT just illustrations — they're animated props that TRANSFORM to reveal data.

### 8.5 Chart Animation Rules

1. **Growth from zero**: Bars/lines ALWAYS grow from baseline, never appear pre-populated
2. **Sequential within chart**: Elements within a single chart enter with 4-8 frame stagger
3. **Highlight AFTER settle**: Yellow accent only appears on a data point after the full chart has settled
4. **Annotation follows data**: Callout labels appear 3-6 frames after their associated data element
5. **12fps stutter**: Applied to chart elements just like all graphics
6. **Rough line quality**: Chart lines/borders have slight feTurbulence displacement

---

## Part IX: Series-Specific Visual Languages

> Each Vox series has its own visual sub-DNA within the broader Vox brand.

### 9.1 Vox Atlas (Sam Ellis)

**Distinctive traits**: Google Earth Studio orbits, zoom-to-ground transitions, desaturated map color grading, posterize time at 10fps for historical sequences, hand-drawn annotations overlaid on geographic footage, red circles (80% transparency) at focal points with pulse animation.

**Templates needed**: `vox-map`, `vox-country`, `vox-location` cover this but would benefit from an "atlas" variant with more dramatic zoom transitions.

### 9.2 Vox Earworm (Estelle Caswell)

**Distinctive traits**: Beat-synced animation, rhyme scheme color grids, circle of fifths visualization, waveform displays, beat maps, repetition diagrams, lyric highlight cascading, mixed media collage, long static holds (unusual for Vox), progressive music theory building.

**Template implications**: Music/audio content would need specialized templates not in the current 38: `vox-waveform`, `vox-beatmap`, `vox-rhymegrid`, `vox-spectrum-audio`.

### 9.3 Darkroom

**Distinctive traits**: Photograph as primary canvas, directed Ken Burns with annotated focal points, spotlight isolation (darken everything except focus area), photo layer separation for parallax, contact sheet/film strip layouts, fade between photo versions.

### 9.4 Missing Chapter

**Distinctive traits**: Archival image collage with protest-poster aesthetic, scrapbook assembly animation, then/now split screens, demographic map overlays.

### 9.5 By Design

**Distinctive traits**: Blueprint/schematic overlays, exploded view animations, design evolution timelines, dimension/scale annotations with measurement lines.

---

## Part X: Expanded Template Catalog — 52 Templates

Building on the 38 from Part IV, adding templates from series-specific analysis and data viz patterns:

### Additional Templates (14 new)

| Slug | Category | Description | Source Series |
|------|----------|-------------|---------------|
| `vox-unitchart` | data-visualization | Isotype/unit visualization — individual dots/icons represent data points, regroup to show statistics | Main Explainers |
| `vox-systemdiagram` | structure | Cartoon character system diagram — stakeholders with personalities showing how a system works | Main Explainers |
| `vox-metaphor` | narrative | Abstract concept with concrete visual proxy (sandwich, cereal bowl, etc.) that transforms to reveal data | Main Explainers |
| `vox-spotlight` | narrative | Photo/image with darkened surroundings, spotlight circle on focal area, annotation labels | Darkroom |
| `vox-filmstrip` | narrative | Contact sheet / film strip layout showing sequence of images or states | Darkroom |
| `vox-blueprint` | structure | Schematic/blueprint overlay with dimension lines, labels, and exploded view | By Design |
| `vox-scrapbook` | narrative | Archival collage assembled piece-by-piece, protest-poster aesthetic, scrapbook feel | Missing Chapter |
| `vox-thennow` | comparison | Then/now split screen — historical on one side, current on other, with date labels | Missing Chapter |
| `vox-wordswap` | text-typography | Sentence with one key word that swaps/changes to show contrast or progression | Main Explainers |
| `vox-supercut` | narrative | Rapid montage of similar screenshots/images/clips flickering at 2 frames each | Main Explainers |
| `vox-areachart` | data-visualization | Stacked area chart showing composition over time with fill-down animation | Main Explainers |
| `vox-treemap` | data-visualization | Treemap/block chart showing hierarchical proportions with sequential block fills | Main Explainers |
| `vox-donut` | data-visualization | Animated donut/pie chart with segment reveals and percentage labels popping in | Main Explainers |
| `vox-diverging` | data-visualization | Diverging trend lines showing how two metrics separate over time | Main Explainers |

### Final Template Count: 52

- 7 Text & Statement (added `vox-wordswap`)
- 10 Data & Numbers (added `vox-unitchart`, `vox-areachart`, `vox-treemap`, `vox-donut`, `vox-diverging`)
- 6 Comparison & Analysis (added `vox-thennow`)
- 8 Structure & Process (added `vox-systemdiagram`, `vox-blueprint`)
- 3 Geographic & Location
- 9 Narrative & Evidence (added `vox-spotlight`, `vox-filmstrip`, `vox-scrapbook`, `vox-metaphor`, `vox-supercut`)
- 4 Lists & Rankings
- 4 Emphasis & Alert

---

## Part XI: Behance & Community Findings

> From Behance portfolio analysis and community reverse-engineering projects.

### Key Behance Projects Referencing Vox Style

| Project | Creator | Key Techniques |
|---------|---------|----------------|
| Data Visualization Animation for Vox.com | Bard Edlund | Actual Vox commission — 100-dot 3D population viz |
| Vox "The Mind, Explained" on Netflix | Yuval Haker | Emmy-nominated, hazy illustration, spot colors |
| Vox Explained Season 1 | John McColgan | 4 episodes, each unique visual world |
| Mixed Media Explainer: Vox Creative x JP Morgan | Sara Afridi | Mixed media collage, Vox Creative team |
| Development of Siberia collage animation | Various | Vox Atlas style geographic collage |

### Vox Media Design System ("Unison")

Vox Media unified 8 editorial brands under one shared design system:
- Foundational elements: type scale, color system, spacing variables
- Brand "guideposts": core principles + visual signifiers + moodboards per brand
- Components are flexible and can scale for many visual designs
- This validates our DNA approach — a shared system with brand-specific guidance on top

### Production Philosophy Quotes

- **Joey Sendaydiego (Art Director)**: "You don't want it to look perfect because that might make it look more like an ad than an editorial piece"
- **Estelle Caswell (Earworm)**: "My job wasn't to decorate a video. My job was to tell a story"
- **Alvin Chang**: Uses cartoon characters with "real goals and fleshed out personalities" to represent stakeholders
- **Sam Ellis (Atlas)**: Uses Google Earth Studio with hand-drawn annotations — the contrast between CG map and human annotation IS the aesthetic

---

## Companion Documents

- **Forensic Visual Catalog**: `docs/superpowers/specs/2026-04-09-vox-forensic-visual-catalog.md` — 1,200-line deep taxonomy with 54 scene types, 55 animation micro-patterns, per-series breakdowns

---

## Sources

- [5 Breakdowns on Replicating the VOX Motion Graphic Look — PremiumBeat](https://www.premiumbeat.com/blog/replicating-vox-motion-graphic/)
- [How Vox uses animation to make complicated topics digestible — Storybench](https://www.storybench.org/how-vox-uses-animation-to-make-complicated-topics-digestible-for-everyone/)
- [How to Make Informational Videos Like Vox — Kapwing](https://www.kapwing.com/resources/how-to-make-informational-videos-like-vox/)
- [Vox website fonts — Fonts In Use](https://fontsinuse.com/uses/6828/vox-website)
- [Vox Color Palette — color-hex.com](https://www.color-hex.com/color-palette/7200)
- [Vox Style Guide CSS (GitHub)](https://github.com/mjsxi/vox-style-guide/blob/master/source/stylesheets/style.css.scss)
- [Vox Earworm: Estelle Caswell Interview — School of Motion](https://www.schoolofmotion.com/blog/estelle-caswell-vox-podcast)
- [Vox Atlas Map Animations — Storybench](https://www.storybench.org/vox-atlas-producer-sam-ellis-on-his-map-animations/)
- [New Logo for Vox Media — Brand New / UnderConsideration](https://www.underconsideration.com/brandnew/archives/new_logo_for_vox_media_by_triboro_and_in_house.php)
- [Mastering Vox Style Animation (YouTube)](https://galaxy.ai/youtube-summarizer/mastering-vox-style-animation-in-after-effects-a-step-by-step-guide-jBC1jIzrxx8)
- [How to Create Vox Style Maps — No Film School](https://nofilmschool.com/how-create-vox-style-map-animations-after-effects)
- [Create Better Motion Graphics Like Vox — Motion Street](https://motionstreet.thinkingtales.com/article/create-better-motion-graphics-like-vox)
- [Film School: The Infographics of Vox — viewinder](https://viewinder.com/motion-infographics-of-vox/)
- [How Vox Video uses Earth Studio — Google Earth / Medium](https://medium.com/google-earth/how-vox-video-uses-earth-studio-for-dynamic-visual-storytelling-703fc871766e)
- [Data Visualization Animation for Vox.com — Bard Edlund / Behance](https://www.behance.net/gallery/74759983/Data-Visualization-Animation-for-Voxcom)
- [Q&A: Vox data guru on how cartoons can help simplify — CJR](https://www.cjr.org/innovations/vox-cartoons-data-journalism.php)
- [Behind the Scenes: Escape Velocity for Vox — Figures and Figures](https://figuresandfigures.substack.com/p/behind-the-scenes-creating-the-escape)
- [Vox Explained Season 1 — John McColgan](https://www.mcmotion.art/vox-explained)
- [Overshoot Animation Principle — VDODNA](https://www.vdodna.com/blog/overshoot-the-missing-animation-principle/)
- [Realistic Bounce and Overshoot Expressions — MotionScript](https://www.motionscript.com/articles/bounce-and-overshoot.html)
- [Offset and Delay in Motion Design — SVGator](https://www.svgator.com/blog/offset-delay-motion-design/)
- [PosterizeTime Expression — AE Expressions](https://aeexpressions.com/expressions/time/posterize-time-expression)
- [Highlighter Effect in After Effects — Premiere Gal](https://premieregal.com/blog/2021/4/12/fast-and-realistic-3d-paper-highlighter-animation-in-adobe-after-effects-2021)
- [How to Animate Maps Like VOX — Lilys.ai](https://lilys.ai/en/notes/map-animation-20260119/animate-maps-vox-after-effects)
- [Vox "The Mind, Explained" on Netflix — Behance](https://www.behance.net/gallery/94528081/Vox-The-Mind-Explained-on-Netflix)
- [How we got inspired by VOX-style videos — Bearicorn](https://thoughts.bearicorn.com/vox-style-videos-b7ac47421bfe)
