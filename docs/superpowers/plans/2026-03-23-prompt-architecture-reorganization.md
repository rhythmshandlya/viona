# Prompt Architecture Reorganization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the prompt system from 7+ duplicated files into a clean three-layer architecture: composition patterns + genre strategies + agent roles.

**Architecture:** New files (composition.md, strategies/) are created first, loader updated, callers migrated, then old files slimmed/deleted. Backward-compat aliases maintained during transition.

**Task Dependencies:** Tasks 1-4 are independent foundations. Task 5 must complete before Task 10 (Task 5 removes `get_director_style` usage; Task 10 deletes the function). Task 9 must remove module-level constants from `animator.py` before deleting `.md` files. Task 12 must run after Tasks 8-11.

**Note on verification commands:** All `python -c` commands must run from `packages/worker/src` (or use `PYTHONPATH=src`) since prompt imports resolve relative to `src/`.

**Tech Stack:** Python (prompt loader), Markdown (prompt files), Claude Agent SDK pipeline

**Spec:** `docs/superpowers/specs/2026-03-23-prompt-architecture-reorganization-design.md`

---

### Task 1: Create composition.md — Display Mode Rules

**Files:**
- Create: `packages/worker/src/prompts/composition.md`

This is the single source of truth for overlay/stacked/fullscreen modes. Content merged from 5 existing sources.

- [ ] **Step 1: Create composition.md with display mode overview section**

The overview comes from `director/display-mode-table.md` (all 25 lines) + `director/system.md` lines 104-177 (OVERLAY DESIGN PHILOSOPHY, SPEAKER-POSITION-AWARE LAYOUT, OVERLAY ZONE CONSTRAINTS). Structure:

```markdown
# Composition Patterns — Display Modes

<display_mode_overview>
## Display Mode Overview

Three modes control how visuals composite with the speaker video:

| Mode | What Happens | When to Use | Frequency |
|------|-------------|-------------|-----------|
| `"stacked"` | Video + visuals split vertically | Standard explanation, diagrams, animations | 60-70% of beats |
| `"fullscreen"` | Visuals fill entire canvas, speaker hidden | Big reveals, complex diagrams, title cards | 1-3 key moments |
| `"overlay"` | Speaker fills canvas, visuals float on top | Speaker-focused moments, emotional beats | Accent/complement |

Each beat in scenes.json specifies its display mode. Consecutive beats with the same layout go in one segment.
</display_mode_overview>
```

- [ ] **Step 2: Add overlay mode section**

Merge full content from `animator/overlay-rules.md` (uses `{ew}` and `{eh}` placeholders for runtime substitution). Wrap in `<overlay_rules>` XML tags. Include: zero-tolerance background rules, speaker grid placement, two zones (top strip 0-15%, lower-third 58-85%), element design rules (max 2 visible, 1-3 words, typography-first), animation rules (gentle fade+slide entrance 15-25 frames, breathing idle, quick exit), prohibited patterns.

Also merge overlay content from `director/system.md` lines 104-177 (OVERLAY DESIGN PHILOSOPHY, SPEAKER-POSITION-AWARE LAYOUT, OVERLAY ZONE CONSTRAINTS). These are the Director-facing planning rules for overlays.

- [ ] **Step 3: Add stacked mode sections**

Extract the two stacked variants from `animator.py` `_build_default_rules()` function (lines 511-596). Create two tagged sections:

```markdown
<stacked_compact_rules>
## STACKED MODE — {ew}×{eh} (nearly square)
... content from _build_default_rules() compact branch (lines 516-553) ...
</stacked_compact_rules>

<stacked_portrait_rules>
## STACKED MODE — {ew}×{eh} (portrait)
... content from _build_default_rules() portrait branch (lines 555-596) ...
</stacked_portrait_rules>
```

- [ ] **Step 4: Add fullscreen mode section**

Merge full content from `animator/fullscreen-rules.md` (uses `{ew}` and `{eh}` placeholders). Wrap in `<fullscreen_rules>` XML tags.

- [ ] **Step 5: Add segment grouping and per-scene viewport sections**

Copy segment grouping guidance from `director/system.md` lines 116-155 (layout types table, layout props, planning guidelines). Then copy per-scene viewport pattern from `animator/system.md` lines 777-812 (`<per_scene_viewport>` section).

- [ ] **Step 6: Commit**

```bash
git add packages/worker/src/prompts/composition.md
git commit -m "feat(prompts): create composition.md — display mode single source of truth"
```

---

### Task 2: Create explainer-videos Strategy

**Files:**
- Create: `packages/worker/src/prompts/strategies/explainer-videos/creative-direction.md`
- Create: `packages/worker/src/prompts/strategies/explainer-videos/technique-preferences.md`

- [ ] **Step 1: Create creative-direction.md**

This file captures the creative philosophy for explainer videos. Source content from:
- `shared/motion-design-principles.md` — adapt the three-layer model, choreography phases, visual hierarchy (these are general principles but framed for explainer context)
- `director/system.md` lines 22-47 — philosophy section (deep transcript analysis, visual continuity, technique diversity)
- `director/system.md` lines 474-501 — visual metaphor table (filter to explainer-relevant entries)

Structure:

```markdown
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
| Process/steps | Circle nodes connected by animated line connectors |
| Before/after | Shape morph (Circle→Star), split-screen reveal |
| Transformation | @remotion/shapes morph (A → B), scatter/reform |
... (adapt from director/system.md visual metaphor table, explainer-relevant rows)
</visual_metaphor_approach>

<layer_philosophy>
## Three Motion Layers (adapted from motion-design-principles)
| Layer | Role | Weight | Example |
|-------|------|--------|---------|
| Primary | Main element — diagram, data viz, illustration | 60% | Animated diagram, counter |
| Secondary | Supporting labels, icons, annotations | 30% | Staggered labels, accent lines |
| Ambient | Background texture, continuous subtle motion | 10%, ≤15% opacity | Dot grid drift, gradient rotation |
</layer_philosophy>

<choreography>
## Choreography Phases
Phase 1 (frame 0): AMBIENT — Background begins
Phase 2 (frame 0-15): PRIMARY — Hero element enters
Phase 3 (keySync): SETTLE — Hero settles, secondary appears
Phase 4 (keySync+8..): STAGGER — Details cascade (6-8 frame stagger)
Phase 5 (last 15 frames): EXIT — Reverse hierarchy
</choreography>
```

- [ ] **Step 2: Create technique-preferences.md**

Source content from:
- `shared/vocabulary.md` — technique names and archetypes (all of them — explainers use the full vocabulary)
- `shared/quality-checklist.md` — per-scene and per-plan checklists
- `animator/system.md` technique selection guide (lines 556-566)
- The @remotion/shapes and MCP icon guidance we added earlier

Structure:

```markdown
# Explainer Videos — Technique Preferences

<preferred_techniques>
## Preferred Techniques
| Technique | When to Use | Implementation |
|-----------|------------|----------------|
| `"animated-diagram"` | Processes, systems, cause-effect | Circle nodes + line connectors |
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
- Use `@remotion/shapes` (Rect, Circle, Triangle, Ellipse, Star, Pie, Polygon) for geometry
- Use `make*()` functions when you need SVG path strings (e.g. for evolvePath)
- Use Freepik/Iconify MCP for icons, logos, illustrations — NEVER hand-draw SVG paths
- Use `<line>`, `<rect>`, `<circle>` SVG primitives for simple connectors
- All strokeWidth canvas-relative: `strokeWidth={s(3)}`, NEVER hardcoded 1-3px
- Minimum visible stroke: `s(2)` (~4px on 1080 canvas)
</shapes_and_icons>

<animation_vocabulary>
## Animation Vocabulary
(Copy full content from shared/vocabulary.md — text_animations, element_animations, transitions, scene_archetypes tables)
</animation_vocabulary>

<quality_checklist>
## Quality Checklist
(Copy from shared/quality-checklist.md — scene_checklist and plan_checklist sections)
</quality_checklist>

<anti_patterns>
## Anti-Patterns
- Heavy stock footage dominating scenes (explainers should be visually constructed)
- Talking-head focus without supporting graphics
- News-style data presentation (avoid journalistic framing)
- Every scene in a card — vary between cards, open compositions, diagrams
- Hand-drawn SVG paths — use @remotion/shapes or MCP icons
- Hardcoded strokeWidth (1-3px) — use canvas-relative s() sizing
- Same technique in 3+ scenes
</anti_patterns>
```

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/prompts/strategies/explainer-videos/
git commit -m "feat(prompts): add explainer-videos strategy"
```

---

### Task 3: Create informative-media Strategy

**Files:**
- Create: `packages/worker/src/prompts/strategies/informative-media/creative-direction.md`
- Create: `packages/worker/src/prompts/strategies/informative-media/technique-preferences.md`

- [ ] **Step 1: Create creative-direction.md**

Similar structure to explainer-videos but with informative-media tone:

```markdown
# Informative Media — Creative Direction

<tone_and_pacing>
## Tone & Pacing
- Serious, trustworthy, journalistic
- Measured pacing with data reveals at key moments
- Rhythm: strong hook with data (7-8s) → context build (10s) → deep analysis (12-15s) → definitive close (7-8s)
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
| People/organizations | MCP icons (flags, logos via simple-icons), stock photos |
</visual_metaphor_approach>

<layer_philosophy>
## Three Motion Layers
Same three-layer model but weighted toward data and real-world imagery:
| Layer | Role | Weight | Example |
|-------|------|--------|---------|
| Primary | Data visualization, map, key statistic | 60% | Animated chart, map highlight |
| Secondary | Labels, source citations, supporting stats | 30% | Staggered data labels |
| Ambient | Subtle background, low-key movement | 10%, ≤15% opacity | Gradient shift, grid drift |
</layer_philosophy>
```

- [ ] **Step 2: Create technique-preferences.md**

Same structure as explainer-videos but different preference ordering and anti-patterns:

```markdown
# Informative Media — Technique Preferences

<preferred_techniques>
## Preferred Techniques
| Technique | When to Use |
|-----------|------------|
| `"data-viz"` | Statistics, poll results, rankings — PRIMARY technique |
| `"icon-composition"` | Country flags, org logos, concept icons from MCP |
| `"kinetic-typography"` | Key quotes, bold claims, headline text |
| `"split-composition"` | Before/after, side-by-side comparison |
| `"animated-diagram"` | Timelines, relationship maps |
| `"card-data"` | Stat displays, fact cards |
| `"geometric-reveal"` | Data-driven shape reveals (Pie for polls) |
</preferred_techniques>

<shapes_and_icons>
(Same @remotion/shapes and MCP rules as explainer-videos)
</shapes_and_icons>

<animation_vocabulary>
(Same vocabulary tables — these are universal)
</animation_vocabulary>

<quality_checklist>
(Same checklists — universal quality standards)
</quality_checklist>

<anti_patterns>
## Anti-Patterns
- Childish diagrams or overly playful animation (undermines credibility)
- Abstract shapes without real-world context
- Too many geometric decorations without data purpose
- Missing source citations on data displays
- Hand-drawn SVG paths — use @remotion/shapes or MCP icons
- Hardcoded strokeWidth — use canvas-relative s() sizing
</anti_patterns>
```

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/prompts/strategies/informative-media/
git commit -m "feat(prompts): add informative-media strategy"
```

---

### Task 4: Update loader.py — New Assembly Functions

**Files:**
- Modify: `packages/worker/src/prompts/loader.py`

- [ ] **Step 1: Add new functions to loader.py**

Add after the existing `load_shared_modules()` function (keep it for backward compat):

```python
# --- Strategy-based prompt composition ---

def load_strategy(genre: str) -> str:
    """Load both strategy files for a genre.

    Args:
        genre: Strategy directory name (e.g. 'explainer-videos', 'informative-media')

    Returns:
        Concatenated creative-direction + technique-preferences content.

    Raises:
        FileNotFoundError: If the strategy directory or files don't exist.
    """
    creative = load_prompt(f"strategies/{genre}/creative-direction")
    techniques = load_prompt(f"strategies/{genre}/technique-preferences")
    return f"{creative}\n\n{techniques}"


def list_strategies() -> list[str]:
    """Return available genre strategy names."""
    strategies_dir = _PROMPTS_DIR / "strategies"
    if not strategies_dir.exists():
        return []
    return sorted([d.name for d in strategies_dir.iterdir() if d.is_dir()])


def build_agent_prompt(agent: str, genre: str) -> str:
    """Assemble the full system prompt for an agent.

    Components (in order):
    1. composition.md — display mode rules (always loaded)
    2. strategy — genre-specific creative direction + technique preferences
    3. agent/system.md — role-specific workflow

    Args:
        agent: Agent name ('director' or 'animator')
        genre: Strategy genre name (e.g. 'explainer-videos')

    Returns:
        Assembled system prompt string.
    """
    composition = load_prompt("composition")
    strategy = load_strategy(genre)
    role = load_prompt(f"{agent}/system")
    return f"{composition}\n\n{strategy}\n\n{role}"
```

- [ ] **Step 2: Verify the new functions work**

Run from the worker directory:
```bash
cd packages/worker/src && python -c "
from prompts.loader import load_strategy, list_strategies, build_agent_prompt
print('Strategies:', list_strategies())
print('Explainer strategy length:', len(load_strategy('explainer-videos')))
print('Director prompt length:', len(build_agent_prompt('director', 'explainer-videos')))
print('Animator prompt length:', len(build_agent_prompt('animator', 'explainer-videos')))
print('OK')
"
```

Expected: prints strategy names, lengths, and "OK" without errors.

- [ ] **Step 3: Update _loader.py bridge module**

Add new exports:

```python
from prompts.loader import (
    load_prompt, load_template, clear_cache, load_shared_modules,
    load_strategy, list_strategies, build_agent_prompt,
)

__all__ = [
    "load_prompt", "load_template", "clear_cache", "load_shared_modules",
    "load_strategy", "list_strategies", "build_agent_prompt",
]
```

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/prompts/loader.py packages/worker/src/prompts/_loader.py
git commit -m "feat(prompts): add strategy loader and build_agent_prompt assembly"
```

---

### Task 5: Update director.py — New Prompt Builder

**Files:**
- Modify: `packages/worker/src/prompts/director/director.py`
- Modify: `packages/worker/src/prompts/director/__init__.py`

- [ ] **Step 1: Add get_director_prompt() function**

Add to `director.py` after the existing `DIRECTOR_SYSTEM_PROMPT` constant (keep the constant for backward compat):

```python
from prompts._loader import build_agent_prompt

def get_director_prompt(genre: str) -> str:
    """Build the Director system prompt for a given genre."""
    base = build_agent_prompt("director", genre)
    # Reuse existing module-level _SEGMENT_GROUPING constant (line ~11)
    return f"{base}\n\n{_SEGMENT_GROUPING}"
```

Note: No default value for `genre` — callers must explicitly pass it to avoid masking missing genre threading.

- [ ] **Step 2: Replace get_style_description() and remove get_director_style dependency**

This must happen BEFORE Task 10 (which deletes `get_director_style()` from `theme_loader.py`).

1. Remove the import `from prompts.theme_loader import get_director_style` (line ~17)
2. Remove `STYLE_PRESET_DESCRIPTIONS` dict (line ~28-31) — it calls `get_style_description()` at module load time which calls `get_director_style()`, so removing the import without removing the dict will crash
3. Replace `get_style_description()` function body:

```python
def get_style_description(style_preset: str) -> str:
    """Get style description — returns minimal color/font summary from theme."""
    theme = get_theme(style_preset)
    if not theme:
        return ""
    colors = theme.get("colors", {})
    variant = theme.get("variant", "dark")
    return (
        f"Theme: {variant} mode. "
        f"Background: {colors.get('background', '#0B0F1A')}, "
        f"text: {colors.get('text', '#FFFFFF')}, "
        f"accent: {colors.get('accentDefault', '#6366F1')}, "
        f"secondary: {colors.get('secondaryDefault', '#EC4899')}."
    )
```

- [ ] **Step 3: Update director/__init__.py**

Add `get_director_prompt` to exports:

```python
from .director import (
    DIRECTOR_SYSTEM_PROMPT,
    build_director_user_message,
    get_aspect_ratio_name,
    get_director_prompt,
    get_layout_context,
    get_style_description,
)
```

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/prompts/director/
git commit -m "feat(prompts): add get_director_prompt(genre) with backward compat"
```

---

### Task 6: Update animator.py — New Prompt Builder + Display Mode Refactor

**Files:**
- Modify: `packages/worker/src/prompts/animator/animator.py`
- Modify: `packages/worker/src/prompts/animator/__init__.py`

- [ ] **Step 1: Add get_animator_prompt() function**

Add after the existing `ANIMATOR_BASE_PROMPT` alias:

```python
def get_animator_prompt(genre: str) -> str:
    """Build the Animator system prompt for a given genre."""
    from prompts._loader import build_agent_prompt
    return build_agent_prompt("animator", genre)
```

No default value for `genre` — callers must pass it explicitly to avoid masking missing genre threading.

- [ ] **Step 2: Refactor get_display_mode_rules() to read from composition.md**

Replace the existing function to extract tagged sections from composition.md:

```python
import re

def _extract_section(tag: str) -> str:
    """Extract content between <tag> and </tag> from composition.md.
    Uses load_prompt() which has its own cache — no extra caching needed."""
    content = load_prompt("composition")
    pattern = rf"<{tag}>(.*?)</{tag}>"
    match = re.search(pattern, content, re.DOTALL)
    if match:
        return match.group(1).strip()
    return ""

def get_display_mode_rules(display_mode: str, ew: int = 1080, eh: int = 960) -> str:
    """Get display-mode-specific rules with runtime dimension injection."""
    if display_mode == "overlay":
        rules = _extract_section("overlay_rules")
    elif display_mode == "fullscreen":
        rules = _extract_section("fullscreen_rules")
    else:
        # Select compact vs portrait based on aspect ratio
        is_compact = eh < ew * 1.2
        tag = "stacked_compact_rules" if is_compact else "stacked_portrait_rules"
        rules = _extract_section(tag)

    return rules.replace("{ew}", str(ew)).replace("{eh}", str(eh))
```

- [ ] **Step 3: Update animator/__init__.py**

Add `get_animator_prompt` to exports:

```python
from .animator import (
    ANIMATOR_BASE_PROMPT,
    # ... existing exports ...
    get_animator_prompt,
    get_display_mode_rules,
    get_studio_section,
    # ... rest ...
)
```

- [ ] **Step 4: Verify get_display_mode_rules still works**

```bash
cd packages/worker/src && python -c "
from prompts.animator import get_display_mode_rules
overlay = get_display_mode_rules('overlay', 1080, 1920)
stacked = get_display_mode_rules('default', 1080, 960)
fullscreen = get_display_mode_rules('fullscreen', 1080, 1920)
assert '1080' in overlay, 'overlay should have dimensions'
assert '960' in stacked, 'stacked should have dimensions'
assert '1920' in fullscreen, 'fullscreen should have dimensions'
print('All display mode rules OK')
"
```

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/prompts/animator/
git commit -m "feat(prompts): add get_animator_prompt(genre) + refactor display mode rules to composition.md"
```

---

### Task 7: Add Genre to Orchestrator Pipeline

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py`
- Modify: `packages/worker/src/agents/visual_generator/_director.py`
- Modify: `packages/worker/src/agents/visual_generator/_animator.py`
- Modify: `packages/worker/src/agents/visual_generator/_scene_verification.py`
- Modify: `packages/worker/src/agents/visual_generator/_visual_verification.py`

- [ ] **Step 1: Add genre parameter to ClaudeVisualGenerator**

In `claude_visual_generator.py`, add `genre: str = "auto"` parameter to `__init__()` and store as `self.genre`. Thread it through to `_run_director()` and `_run_animator_sequential()`.

Also find all callers of `ClaudeVisualGenerator()` (likely in `_pipeline.py` or the BullMQ job handler) and pass `genre` through. Search with:
```bash
cd packages/worker && grep -rn "ClaudeVisualGenerator(" src/ --include="*.py"
```

- [ ] **Step 2: Update _director.py to use get_director_prompt(genre)**

Replace:
```python
from prompts.director import DIRECTOR_SYSTEM_PROMPT, build_director_user_message
# ...
"append": DIRECTOR_SYSTEM_PROMPT
```

With:
```python
from prompts.director import get_director_prompt, build_director_user_message
# ...
"append": get_director_prompt(self.genre)
```

- [ ] **Step 3: Update _animator.py to use get_animator_prompt(genre)**

Replace `ANIMATOR_BASE_PROMPT` import (line ~22) with `get_animator_prompt`. Then update all 4 usage sites:

1. **Setup phase** (line ~241): `f"{get_animator_prompt(self.genre)}{studio_section}\n\n{skills_directive}..."`
2. **Coordinator system** (line ~328): same pattern
3. **AgentDefinition** (line ~353-363): The coordinator dispatches `AgentDefinition(prompt=scene_gen_system)` where `scene_gen_system` is built from `ANIMATOR_BASE_PROMPT`. Update this to use `get_animator_prompt(self.genre)` in the same way.
4. **Scene generation** (line ~469): same pattern

```python
from prompts.animator import get_animator_prompt
# ...
animator_base = get_animator_prompt(self.genre)
setup_system = f"{animator_base}{studio_section}\n\n{skills_directive}\n\n{ANIMATOR_SETUP_PROMPT}{user_assets_section}"
```

- [ ] **Step 4: Update _scene_verification.py and _visual_verification.py**

Each file has two points to change — the import (lazy import inside a method) and the usage:

- `_scene_verification.py`: import at line ~143, usage at line ~176
- `_visual_verification.py`: import at line ~179, usage at line ~260

Replace both import and usage in each file:
```python
# Change import from:
from prompts.animator import ANIMATOR_BASE_PROMPT
# To:
from prompts.animator import get_animator_prompt
# And usage from:
ANIMATOR_BASE_PROMPT
# To:
get_animator_prompt(self.genre)
```

- [ ] **Step 5: Add classify_transcript() to orchestrator**

> **Spec deviation note:** The spec calls for LLM-based classification via `quick_classify()`. We use keyword heuristics instead to avoid an extra LLM call (latency + cost). This is sufficient for 2 genres. If genre count grows past 5, revisit with LLM classification.

Create in `packages/worker/src/agents/visual_generator/genre_classifier.py`:

```python
"""Transcript genre classifier for strategy selection."""

from prompts.loader import list_strategies


def classify_transcript(transcript: str) -> str:
    """Classify transcript into a genre strategy.

    Uses keyword heuristics to select the appropriate strategy.
    Falls back to 'explainer-videos' as the safe default.

    Args:
        transcript: The formatted transcript text.

    Returns:
        Genre name matching a strategy directory.
    """
    available = list_strategies()
    if not available:
        return "explainer-videos"

    text = transcript.lower()

    # Informative media signals
    informative_signals = [
        "country", "countries", "government", "president", "minister",
        "war", "conflict", "military", "geopolit", "election",
        "economy", "gdp", "inflation", "market", "stock",
        "news", "report", "according to", "study shows",
        "percent", "billion", "million", "population",
        "climate", "policy", "regulation", "law",
    ]

    informative_score = sum(1 for signal in informative_signals if signal in text)

    if informative_score >= 3 and "informative-media" in available:
        return "informative-media"

    return "explainer-videos"
```

- [ ] **Step 6: Wire classify_transcript into orchestrator**

In `claude_visual_generator.py`, call `classify_transcript()` before the Director phase:

```python
from agents.visual_generator.genre_classifier import classify_transcript

# In the generate method, before Director phase:
if self.genre == "auto":
    self.genre = classify_transcript(formatted_transcript)
    self._log(f"Genre classified as: {self.genre}")
```

The `__init__` defaults `genre="auto"`, so this always runs unless the caller provides an explicit genre.

- [ ] **Step 7: Commit**

```bash
git add packages/worker/src/agents/
git commit -m "feat(pipeline): thread genre parameter through orchestrator → director → animator"
```

---

### Task 8: Slim director/system.md

**Files:**
- Modify: `packages/worker/src/prompts/director/system.md`
- Delete: `packages/worker/src/prompts/director/display-mode-table.md`

- [ ] **Step 1: Remove content that moved to composition.md**

Remove these sections from `director/system.md`:
- Lines 104-177: `OVERLAY DESIGN PHILOSOPHY`, `SPEAKER-POSITION-AWARE LAYOUT`, `OVERLAY ZONE CONSTRAINTS` (→ composition.md)
- The display mode table reference (→ composition.md)

- [ ] **Step 2: Remove content that moved to strategy files**

Remove these sections:
- Lines 28: philosophy section mentioning specific techniques (→ strategy creative-direction)
- Lines 36-47: motion_design_planning technique-specific content like "SVG path drawing, shape morphing" (→ strategy)
- Lines 393-403: technique valid values list (→ strategy technique-preferences)
- Lines 474-501: visual_metaphors table (→ strategy creative-direction)

Keep references like "Use technique names from the loaded strategy" instead of listing them inline.

- [ ] **Step 3: Update technique field documentation in output format**

Replace the hardcoded technique valid values with:
```markdown
The `technique` field identifies the primary visual technique. Valid values come from the loaded creative strategy. No two adjacent beats should share the same `technique` value.
```

- [ ] **Step 4: Delete display-mode-table.md**

```bash
rm packages/worker/src/prompts/director/display-mode-table.md
```

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/prompts/director/
git commit -m "refactor(prompts): slim director/system.md — moved composition + strategy content"
```

---

### Task 9: Slim animator/system.md

**Files:**
- Modify: `packages/worker/src/prompts/animator/system.md`
- Delete: `packages/worker/src/prompts/animator/overlay-rules.md`
- Delete: `packages/worker/src/prompts/animator/fullscreen-rules.md`

- [ ] **Step 1: Remove content that moved to composition.md**

Remove:
- `<per_scene_viewport>` section (lines 777-812) → composition.md
- Overlay mode rules in `<assets_and_visuals>` (lines 703-763) → composition.md

- [ ] **Step 2: Remove content that moved to strategy files**

Remove:
- `<visual_techniques>` section (lines 488-584) — technique library with code examples → skills + strategy
- Most of `<advanced_techniques>` (lines 814-850) — SVG stroke draw-in, clip-path → skills
- `<animation_recipes>` section (lines 852-949) — all code recipes → skills

Keep: `interpolateColors` and `gradient text` recipes (small, frequently needed).

- [ ] **Step 3: Remove content that moved to skills**

Remove:
- `<three_dimensional_animations>` section (lines 569-595) → remotion-best-practices skill already has `rules/3d.md`

- [ ] **Step 4: Clean up prohibited patterns**

In `<prohibited_patterns>`, keep only workflow-related items. Remove technique-specific ones that are now in strategy (e.g., technique variety rules). The strategy's anti-patterns section handles these.

- [ ] **Step 5: Remove module-level OVERLAY_RULES and FULLSCREEN_RULES constants from animator.py**

**CRITICAL — must happen BEFORE deleting the .md files.** In `animator.py`, remove the module-level constants (lines ~505-508):
```python
# DELETE these lines:
OVERLAY_RULES = load_prompt('animator/overlay-rules')
FULLSCREEN_RULES = load_prompt('animator/fullscreen-rules')
```
These constants are loaded at import time — if the files are deleted first, `from prompts.animator import ...` will crash with `FileNotFoundError`. The new `get_display_mode_rules()` reads from composition.md instead, so these constants are no longer needed.

Also remove `_build_default_rules()` (lines ~511-596) — its content is now in composition.md's `<stacked_compact_rules>` and `<stacked_portrait_rules>` sections.

- [ ] **Step 6: Update animator/__init__.py — remove deleted exports**

Remove `OVERLAY_RULES`, `FULLSCREEN_RULES`, and `_build_default_rules` from the `__init__.py` exports.

- [ ] **Step 7: Delete overlay-rules.md and fullscreen-rules.md**

```bash
rm packages/worker/src/prompts/animator/overlay-rules.md
rm packages/worker/src/prompts/animator/fullscreen-rules.md
```

- [ ] **Step 8: Commit**

```bash
git add packages/worker/src/prompts/animator/
git commit -m "refactor(prompts): slim animator/system.md — moved composition + strategy + skill content"
```

---

### Task 10: Strip Theme Files

**Files:**
- Modify: `packages/worker/src/prompts/themes/studio/design-system.md`
- Modify: `packages/worker/src/prompts/themes/studio/dark/style-guide.md`
- Modify: `packages/worker/src/prompts/themes/studio/light/style-guide.md`
- Delete: `packages/worker/src/prompts/themes/studio/director-style.md`
- Modify: `packages/worker/src/prompts/theme_loader.py`

- [ ] **Step 1: Strip design-system.md — remove animation rules**

Remove from `design-system.md`:
- `ANIMATION QUALITY STANDARDS` section (8 rules) → strategy quality checklist
- `VISUAL CONTENT HIERARCHY` section (Layer 1/2/3) → strategy creative-direction
- `SYNC COVERAGE` section → strategy
- `WHAT NOT TO BUILD (ANTI-PATTERNS)` section → strategy anti-patterns
- `CONTINUOUS MOTION RECIPES` section → skills

Keep: template library reference, THEME color tokens, useScale(), FONT_PAIRS, DotGrid pattern, card styling, accent transparency convention, ANIMATION LIFECYCLE, SPRING CONFIGS (these are theme-specific design tokens, not general animation rules).

- [ ] **Step 2: Strip style-guide.md files — remove animation rules**

From both `dark/style-guide.md` and `light/style-guide.md`, remove:
- Animation timeline rules
- Mandatory animation quality rules
- Spring config section (duplicates constants.ts)

Keep: color palette, DotGrid SVG code, typography pairs, card layout values.

- [ ] **Step 3: Delete director-style.md**

```bash
rm packages/worker/src/prompts/themes/studio/director-style.md
```

- [ ] **Step 4: Update theme_loader.py — remove get_director_style()**

Remove the `get_director_style()` function from `theme_loader.py`.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/prompts/themes/
git commit -m "refactor(prompts): strip animation rules from theme files — colors + fonts + templates only"
```

---

### Task 11: Strip Workspace CLAUDE.md Files

**Files:**
- Modify: `packages/worker/workspace/CLAUDE.md`
- Modify: `packages/worker/workspace/.claude/CLAUDE.md`

- [ ] **Step 1: Slim both CLAUDE.md files**

Keep only:
- Commands section (`npx tsc --noEmit`, `npx remotion bundle`)
- Code Style section (TypeScript, functional components, useCurrentFrame, spring, interpolate clamp)
- File Structure section
- Common Gotchas (Math.sin/cos on text, damping < 18, useFrame ban, ThreeCanvas)
- MANDATORY: Use Skills section (framer-motion, motion-one, video-engagement, remotion-best-practices)

Remove:
- Any technique guidance ("Use path drawing, animated diagrams, morphing...")
- SVG/shapes rules (now in strategy)
- strokeWidth rules (now in strategy)
- Display mode references (now in composition.md)

Both files should be identical (they currently are).

- [ ] **Step 2: Commit**

```bash
git add packages/worker/workspace/CLAUDE.md packages/worker/workspace/.claude/CLAUDE.md
git commit -m "refactor: slim workspace CLAUDE.md — skills + code style only"
```

---

### Task 12: Delete Shared Modules + Update Exports

**Files:**
- Delete: `packages/worker/src/prompts/shared/technical-rules.md`
- Delete: `packages/worker/src/prompts/shared/motion-design-principles.md`
- Delete: `packages/worker/src/prompts/shared/vocabulary.md`
- Delete: `packages/worker/src/prompts/shared/quality-checklist.md`
- Modify: `packages/worker/src/prompts/loader.py` — clear `_SHARED_MODULES` list
- Modify: `packages/worker/src/prompts/__init__.py` — update exports

- [ ] **Step 1: Verify skill coverage of shared/technical-rules.md**

Per the spec's "Skill Coverage Verification" requirement: before deleting shared modules, verify that topics from `shared/technical-rules.md` are covered by existing Remotion skills (`remotion-best-practices`, `motion-one`, `framer-motion`). Read the skills and cross-reference.

If any topic is missing from skills, add it to the relevant skill BEFORE deleting. Topics to verify:
- interpolate() clamping rules → check `remotion-best-practices`
- inputRange monotonic constraint → check `remotion-best-practices`
- Spring config minimums → check `motion-one`
- useCurrentFrame/Sequence usage → check `remotion-best-practices`

- [ ] **Step 2: Clear _SHARED_MODULES in loader.py**

Change to:
```python
_SHARED_MODULES: list[str] = []  # Cleared — content moved to strategies/ and skills
```

Also add deprecation docstring to `load_shared_modules()`:
```python
def load_shared_modules() -> str:
    """Deprecated: shared modules moved to strategies/ and skills.
    Returns empty string for backward compatibility."""
    return "\n\n".join(load_prompt(m) for m in _SHARED_MODULES)
```

- [ ] **Step 3: Delete shared directory**

```bash
rm -rf packages/worker/src/prompts/shared/
```

- [ ] **Step 4: Update prompts/__init__.py**

Add new exports:

```python
from .director.director import DIRECTOR_SYSTEM_PROMPT, build_director_user_message, get_director_prompt
from .animator.animator import ANIMATOR_SYSTEM_PROMPT, build_animator_user_message, get_studio_section, get_animator_prompt
from .loader import build_agent_prompt, load_strategy, list_strategies

__all__ = [
    "DIRECTOR_SYSTEM_PROMPT",
    "build_director_user_message",
    "get_director_prompt",
    "ANIMATOR_SYSTEM_PROMPT",
    "build_animator_user_message",
    "get_studio_section",
    "get_animator_prompt",
    "build_agent_prompt",
    "load_strategy",
    "list_strategies",
]
```

- [ ] **Step 5: Verify nothing imports deleted shared modules directly**

```bash
cd packages/worker && grep -r "shared/technical-rules\|shared/motion-design\|shared/vocabulary\|shared/quality-checklist" src/ --include="*.py" --include="*.ts" || true
```

Expected: only hits in loader.py (the cleared `_SHARED_MODULES` list). No other direct imports.

- [ ] **Step 6: Verify full pipeline still assembles prompts**

```bash
cd packages/worker/src && python -c "
from prompts.director import get_director_prompt
from prompts.animator import get_animator_prompt, get_display_mode_rules

dp = get_director_prompt('explainer-videos')
ap = get_animator_prompt('explainer-videos')
dm = get_display_mode_rules('overlay', 1080, 1920)

assert len(dp) > 1000, f'Director prompt too short: {len(dp)}'
assert len(ap) > 1000, f'Animator prompt too short: {len(ap)}'
assert len(dm) > 100, f'Display mode rules too short: {len(dm)}'
assert 'explainer' in dp.lower() or 'creative direction' in dp.lower(), 'Strategy not loaded in director'
assert 'composition' in dp.lower() or 'overlay' in dp.lower() or 'stacked' in dp.lower(), 'Composition not loaded in director'
print(f'Director prompt: {len(dp)} chars')
print(f'Animator prompt: {len(ap)} chars')
print(f'Display mode rules: {len(dm)} chars')
print('All OK')
"
```

- [ ] **Step 7: Commit**

```bash
git add packages/worker/src/prompts/
git commit -m "refactor(prompts): delete shared modules — content moved to strategies + skills"
```

---

### Task 13: Add Deprecation Comment to TypeScript Loader

**Files:**
- Modify: `packages/worker/src/prompts/loader.ts` (if it exists)

- [ ] **Step 1: Add deprecation comment**

Add at the top of the file:
```typescript
/**
 * @deprecated This TypeScript loader is part of the legacy single-agent pipeline.
 * The production pipeline uses the Python loader (loader.py) with the
 * build_agent_prompt() function. This file is kept for backward compatibility
 * with generate-visuals.ts but should not be used for new code.
 */
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/src/prompts/loader.ts
git commit -m "chore: add deprecation comment to legacy TS prompt loader"
```

---

### Task 14: Final Verification

- [ ] **Step 1: Verify no broken imports**

```bash
cd packages/worker/src && python -c "
# Test all prompt module imports
from prompts import get_director_prompt, get_animator_prompt, build_agent_prompt
from prompts.animator import (
    get_display_mode_rules, get_studio_section, get_animator_prompt,
    ANIMATOR_SETUP_PROMPT, ANIMATOR_SCENE_PROMPT_TEMPLATE,
    build_scene_task_prompt, build_setup_user_message,
    SCENE_VERIFY_PROMPT, COMPOSITION_VERIFY_PROMPT,
    VISUAL_VERIFY_PROMPT, VISUAL_FIX_PROMPT_TEMPLATE,
)
from prompts.director import (
    get_director_prompt, build_director_user_message,
    get_aspect_ratio_name, get_layout_context, get_style_description,
)
from prompts.loader import load_strategy, list_strategies, build_agent_prompt
from prompts.theme_loader import get_theme, get_design_system, get_style_guide
print('All imports OK')
"
```

- [ ] **Step 2: Verify both strategies produce valid prompts**

```bash
cd packages/worker/src && python -c "
from prompts.director import get_director_prompt
from prompts.animator import get_animator_prompt

for genre in ['explainer-videos', 'informative-media']:
    dp = get_director_prompt(genre)
    ap = get_animator_prompt(genre)
    print(f'{genre}: director={len(dp)} chars, animator={len(ap)} chars')
    assert len(dp) > 500
    assert len(ap) > 500
print('Both strategies OK')
"
```

- [ ] **Step 3: Verify display mode rules work for all modes**

```bash
cd packages/worker/src && python -c "
from prompts.animator import get_display_mode_rules

for mode, ew, eh in [('overlay', 1080, 1920), ('default', 1080, 960), ('default', 1080, 1920), ('fullscreen', 1080, 1920)]:
    rules = get_display_mode_rules(mode, ew, eh)
    assert str(ew) in rules, f'{mode} missing ew'
    assert str(eh) in rules, f'{mode} missing eh'
    print(f'{mode} ({ew}x{eh}): {len(rules)} chars')
print('All display modes OK')
"
```

- [ ] **Step 4: Verify deleted files are gone**

```bash
cd packages/worker/src && python -c "
from pathlib import Path
base = Path('src/prompts')

# These should NOT exist
deleted = [
    'shared/technical-rules.md',
    'shared/motion-design-principles.md',
    'shared/vocabulary.md',
    'shared/quality-checklist.md',
    'animator/overlay-rules.md',
    'animator/fullscreen-rules.md',
    'director/display-mode-table.md',
    'themes/studio/director-style.md',
]
for f in deleted:
    assert not (base / f).exists(), f'{f} should be deleted'

# These SHOULD exist
required = [
    'composition.md',
    'strategies/explainer-videos/creative-direction.md',
    'strategies/explainer-videos/technique-preferences.md',
    'strategies/informative-media/creative-direction.md',
    'strategies/informative-media/technique-preferences.md',
]
for f in required:
    assert (base / f).exists(), f'{f} should exist'

print('File structure OK')
"
```

- [ ] **Step 5: Verify get_director_style is removed**

```bash
cd packages/worker/src && python -c "
try:
    from prompts.theme_loader import get_director_style
    print('FAIL: get_director_style should be deleted')
    exit(1)
except ImportError:
    print('OK: get_director_style correctly removed')
"
```

- [ ] **Step 6: Final commit (if any remaining changes)**

Only commit if there are unstaged prompt-related fixes from verification:
```bash
git add packages/worker/src/prompts/ packages/worker/workspace/
git diff --cached --quiet || git commit -m "chore: final verification fixes for prompt architecture"
```
