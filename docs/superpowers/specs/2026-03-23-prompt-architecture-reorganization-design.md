# Prompt Architecture Reorganization — Design Spec

**Date:** 2026-03-23
**Status:** Draft v2

## Problem

Animation knowledge (techniques, vocabulary, visual rules, display mode constraints) is duplicated across 7+ files. Changing one rule requires touching 6+ files, files drift out of sync, the same animation strategy applies to all video types, and agents receive overlapping instructions from multiple sources.

## Architecture

Three-layer prompt system:

```
Layer 1: Composition Patterns     → HOW display modes work (always loaded)
Layer 2: Creative Strategy        → WHAT to animate for this genre (selected per video)
Layer 3: Agent Role               → WHO does what (always loaded)
Technical Foundation              → Remotion skills (loaded on-demand by agent)
```

### File Structure

```
prompts/
  composition.md                         ← NEW: display mode rules (always loaded)
  strategies/                            ← NEW: genre-specific creative direction
    explainer-videos/
      creative-direction.md
      technique-preferences.md
    informative-media/
      creative-direction.md
      technique-preferences.md
    (future genres added as directories)
  director/
    system.md                            ← SLIMMED: role + workflow + output format only
    segment-grouping.md                  ← Keep as-is
    display-mode-table.md                ← DELETE (merged into composition.md)
  animator/
    system.md                            ← SLIMMED: role + workflow + asset rules only
    setup.md                             ← Keep as-is
    scene-template.md                    ← Keep as-is
    overlay-rules.md                     ← DELETE (merged into composition.md)
    fullscreen-rules.md                  ← DELETE (merged into composition.md)
    composition-assembly.md              ← Keep as-is (composition.tsx assembly guide)
    video-overlay-section.md             ← Keep as-is (conditional section)
    youtube-clip-section.md              ← Keep as-is (conditional section)
    scene-verify.md                      ← Keep as-is
    composition-verify.md                ← Keep as-is
    verify.md                            ← Keep as-is
    fix-template.md                      ← Keep as-is
  themes/                                ← SLIMMED: colors + fonts + template system ONLY
    themes.json                          ← Keep as-is
    studio/
      design-system.md                   ← Strip animation/technique rules, keep templates + colors + fonts
      director-style.md                  ← DELETE (strategy replaces it)
      dark/style-guide.md               ← Strip animation rules, keep colors + DotGrid + fonts + cards
      light/style-guide.md              ← Same
  references/                            ← Keep as-is (example prompts, not in assembly path)
  shared/                                ← DELETE entire directory
  loader.py                              ← UPDATED: new assembly logic
  _loader.py                             ← UPDATED: re-exports updated functions
  theme_loader.py                        ← UPDATED: remove get_director_style()
  __init__.py                            ← UPDATED: new exports
```

### Workspace CLAUDE.md

Both `workspace/CLAUDE.md` and `workspace/.claude/CLAUDE.md` stripped to:
- File structure reference
- Skill pointers (must-read: `remotion-best-practices`, `framer-motion`, `motion-one`)
- Basic code style (TypeScript, functional components, `useCurrentFrame()`)
- No animation techniques, no display mode rules, no quality checklists

---

## Content Migration

### composition.md — Display Mode Rules

Single source of truth for overlay, stacked, and fullscreen modes. Merged from:
- `animator/overlay-rules.md` (full content)
- `animator/fullscreen-rules.md` (full content)
- `animator/system.md` overlay sections, per-scene viewport pattern
- `director/system.md` overlay zone constraints, speaker-position-aware layout, layout types
- `director/display-mode-table.md` (full content)
- `_build_default_rules()` stacked mode content from `animator.py`

**Uses `{ew}` and `{eh}` placeholders** for runtime dimension injection (same as current overlay-rules.md and fullscreen-rules.md). The existing `get_display_mode_rules()` function continues to work — it reads sections from composition.md instead of separate files.

**Sections:**

1. **Display Mode Overview** — When to use each mode, decision criteria for Director
2. **Overlay Mode** — Zone constraints (top strip 0-15%, OFF-LIMITS 15-58%, lower-third 58-85%, subtitle 85-100%), speaker-position-aware layout, element rules (max 2 visible, 1-3 words), animation (gentle fade+slide), prohibited patterns, safe placement grid
3. **Stacked Mode** — Split layout (video + visuals), splitRatio/position props, effective visual dimensions, subtitle zone, content centering formula, compact vs portrait variants
4. **Fullscreen Mode** — Full canvas, zone guide (top 20%, middle 40%, bottom 25%, subtitle 15%), max 4 elements, background requirements
5. **Segment Grouping Rules** — Same-layout grouping, contiguity, layout changes = new segment
6. **Per-Scene Viewport** — effectiveDimensions, EW/EH pattern, clipping container

### strategies/ — Creative Strategy (per genre)

Each genre directory contains two files:

#### creative-direction.md
- Visual metaphor approach
- Pacing philosophy
- Tone and mood
- Key visual patterns
- Layer philosophy (primary/secondary/ambient)
- Typography emphasis

#### technique-preferences.md
- Preferred techniques with when-to-use guidance
- @remotion/shapes usage patterns
- MCP icon/asset strategy
- Scene archetype mappings
- Quality checklist specific to genre
- Anti-patterns specific to genre
- Stroke/line sizing rules

### Initial Strategies

**explainer-videos/** — Algorithm explainers, product demos, tutorials, how-tos
- Pacing: simple → complex, step-by-step reveals
- Tone: educational, clear, methodical
- Preferred techniques: animated-diagram (Circle nodes + line connectors), geometric-reveal, shape-morph, data-viz (Pie, Rect bars), kinetic-typography
- Key patterns: flowcharts, before/after, code blocks, process diagrams
- Anti-patterns: heavy stock footage, talking-head focus, news-style data

**informative-media/** — News, geopolitics, current events, analysis, commentary
- Pacing: measured, authoritative, data reveals at key moments
- Tone: serious, trustworthy, journalistic
- Preferred techniques: data-viz, icon-composition (flags, maps), split-composition, kinetic-typography, stock footage + overlay
- Key patterns: maps, data charts, country/flag icons, quote highlights, poll results
- Anti-patterns: childish diagrams, overly playful animation, abstract shapes without context

### director/system.md — Slimmed

Keeps: role definition, transcript analysis (4-pass), beat planning, output format (SCENE_PLAN.md + scenes.json v2 schema), sync timing, cross-scene anchoring, pacing guide, self-verification table, hook rule, canvas/responsive requirements.

Removes: visual technique lists → strategy, visual metaphor tables → strategy, technique valid values → strategy, overlay zone constraints → composition.md, motion design philosophy → strategy.

### animator/system.md — Slimmed

Keeps: role definition, mandatory process (TODO + IMPLEMENTATION_LOG), MCP asset workflow (Freepik, Iconify, screenshots, stock photos, user assets), AnimatedIcon/AnimatedImage, React keys, content-first design, continuous storytelling, layout rules (centering, side-by-side), workflow-related prohibited patterns.

Removes: visual technique library → skills, animation recipes → skills, SVG/shapes guidance → strategy, overlay/fullscreen rules → composition.md, 3D section → skills, technique selection guide → strategy.

### themes/ — Colors + Fonts + Templates Only

**design-system.md** keeps: template library reference, theme color tokens, useScale(), FONT_PAIRS, DotGrid pattern, card styling, accent transparency convention.

**design-system.md** removes: animation quality standards (8 rules), visual content hierarchy (Layer 1/2/3), sync coverage rules, anti-patterns, continuous motion recipes, technique selection guide.

**director-style.md** → DELETE (strategy replaces it)

**style-guide.md (dark/light)** keeps: color palette, DotGrid code, typography, card styling. Removes: animation timeline rules, animation quality rules, spring configs.

---

## Loader Changes

### New loader.py

```python
_SHARED_MODULES = []  # Cleared — shared modules deleted

def load_shared_modules() -> str:
    """Deprecated. Returns empty string for backward compatibility during transition."""
    return ""

def load_strategy(genre: str) -> str:
    """Load both strategy files for a genre."""
    creative = load_prompt(f"strategies/{genre}/creative-direction")
    techniques = load_prompt(f"strategies/{genre}/technique-preferences")
    return f"{creative}\n\n{techniques}"

def list_strategies() -> list[str]:
    """Return available genre strategy names."""
    strategies_dir = _PROMPTS_DIR / "strategies"
    return [d.name for d in strategies_dir.iterdir() if d.is_dir()]

def build_agent_prompt(agent: str, genre: str) -> str:
    """Assemble the full system prompt for an agent.

    Components (in order):
    1. composition.md — display mode rules
    2. strategy — genre-specific creative direction + technique preferences
    3. agent/system.md — role-specific workflow
    """
    composition = load_prompt("composition")
    strategy = load_strategy(genre)
    role = load_prompt(f"{agent}/system")
    return f"{composition}\n\n{strategy}\n\n{role}"
```

### New _loader.py

```python
from prompts.loader import (
    load_prompt, load_template, clear_cache,
    load_shared_modules,  # deprecated, kept for compat
    load_strategy, list_strategies, build_agent_prompt,
)
```

### Updated director.py

```python
from prompts.loader import build_agent_prompt, load_prompt
from prompts.theme_loader import get_theme

_SEGMENT_GROUPING = load_prompt('director/segment-grouping')

def get_director_prompt(genre: str) -> str:
    """Build the Director system prompt for a given genre."""
    base = build_agent_prompt("director", genre)
    return f"{base}\n\n{_SEGMENT_GROUPING}"

# Backward compat — DIRECTOR_SYSTEM_PROMPT still works during transition
DIRECTOR_SYSTEM_PROMPT = get_director_prompt("explainer-videos")

def get_style_description(style_preset: str) -> str:
    """Get style description. Now returns genre strategy summary instead of theme directive."""
    # During transition: return a minimal color/font summary from the theme
    # After transition: this function is removed, strategy handles creative direction
    theme = get_theme(style_preset)
    if not theme:
        return ""
    colors = theme.get("colors", {})
    variant = theme.get("variant", "dark")
    return f"Theme: {variant} mode. Background: {colors.get('background', '#0B0F1A')}, text: {colors.get('text', '#FFFFFF')}, accent: {colors.get('accentDefault', '#6366F1')}, secondary: {colors.get('secondaryDefault', '#EC4899')}."
```

### Updated animator.py

```python
from prompts.loader import build_agent_prompt, load_prompt
from prompts.theme_loader import get_design_system, get_theme

def get_animator_prompt(genre: str) -> str:
    """Build the Animator system prompt for a given genre."""
    return build_agent_prompt("animator", genre)

# Backward compat constants — still work during transition
ANIMATOR_SYSTEM_PROMPT = get_animator_prompt("explainer-videos")
ANIMATOR_BASE_PROMPT = ANIMATOR_SYSTEM_PROMPT

# --- Existing functions stay ---
# get_studio_section(), get_video_overlay_section(), get_youtube_clip_section()
# get_display_mode_rules(), build_setup_user_message(), build_scene_task_prompt()
# ANIMATOR_SETUP_PROMPT, ANIMATOR_SCENE_PROMPT_TEMPLATE, etc. — all unchanged

def get_display_mode_rules(display_mode: str, ew: int = 1080, eh: int = 960) -> str:
    """Get display-mode-specific rules. Reads from composition.md sections.

    composition.md has {ew} and {eh} placeholders for runtime substitution,
    same as the old overlay-rules.md and fullscreen-rules.md.
    """
    # Implementation: load composition.md, extract the relevant section,
    # substitute {ew}/{eh}. OR keep overlay/fullscreen as subsections
    # that are loaded separately. See implementation notes below.
    ...
```

### Caller Migration

All callers currently use `ANIMATOR_BASE_PROMPT` (which equals `ANIMATOR_SYSTEM_PROMPT`). The constant stays as a backward-compat alias during transition:

| Caller | Current Code | New Code |
|--------|-------------|----------|
| `_animator.py:241` (setup) | `f"{ANIMATOR_BASE_PROMPT}{studio_section}\n\n{skills_directive}\n\n{ANIMATOR_SETUP_PROMPT}{user_assets}"` | `f"{get_animator_prompt(genre)}{studio_section}\n\n{skills_directive}\n\n{ANIMATOR_SETUP_PROMPT}{user_assets}"` |
| `_animator.py:328` (coordinator) | `f"{ANIMATOR_BASE_PROMPT}{studio_section}\n\n{skills_directive}"` | `f"{get_animator_prompt(genre)}{studio_section}\n\n{skills_directive}"` |
| `_animator.py:469` (scene) | `f"{ANIMATOR_BASE_PROMPT}{studio_section}\n\n{skills_directive}\n\n{scene_prompt}{user_assets}"` | `f"{get_animator_prompt(genre)}{studio_section}\n\n{skills_directive}\n\n{scene_prompt}{user_assets}"` |
| `_scene_verification.py:176` | `f"{ANIMATOR_BASE_PROMPT}{studio_section}\n\n{skills_directive}"` | `f"{get_animator_prompt(genre)}{studio_section}\n\n{skills_directive}"` |
| `_visual_verification.py:260` | `f"{ANIMATOR_BASE_PROMPT}{studio_section}\n\n{skills_directive}"` | `f"{get_animator_prompt(genre)}{studio_section}\n\n{skills_directive}"` |
| `_director.py:100` | `"append": DIRECTOR_SYSTEM_PROMPT` | `"append": get_director_prompt(genre)` |

**Pattern is the same:** replace constant with function call, pass `genre` parameter. The `studio_section` and `skills_directive` appendages remain unchanged — they are orthogonal (theme colors and skill loading).

### How `genre` Flows Through the Pipeline

```
orchestrator.py
  → classify_transcript(transcript) → genre: str
  → passes genre to ClaudeVisualGenerator(genre=genre)
    → _director.py: get_director_prompt(genre)
    → _animator.py: get_animator_prompt(genre)
    → _scene_verification.py: get_animator_prompt(genre)
    → _visual_verification.py: get_animator_prompt(genre)
```

The `genre` parameter is added to `ClaudeVisualGenerator.__init__()` and stored as `self.genre`. Each phase uses it to build the prompt.

### get_display_mode_rules() — Runtime Dimension Injection

The existing function uses `{ew}` and `{eh}` placeholders in overlay-rules.md and fullscreen-rules.md, and has a Python-generated `_build_default_rules()` for stacked mode.

**New approach:** composition.md is split into loadable sections using XML tags:

```markdown
<overlay_rules>
## OVERLAY MODE — {ew}×{eh}
...zone constraints with {ew} and {eh} placeholders...
</overlay_rules>

<fullscreen_rules>
## FULLSCREEN MODE — {ew}×{eh}
...
</fullscreen_rules>

<stacked_compact_rules>
## STACKED MODE — {ew}×{eh} (nearly square)
...
</stacked_compact_rules>

<stacked_portrait_rules>
## STACKED MODE — {ew}×{eh} (portrait)
...
</stacked_portrait_rules>
```

`get_display_mode_rules()` loads composition.md once (cached), extracts the relevant section by tag, and substitutes `{ew}`/`{eh}`. The `_build_default_rules()` logic (compact vs portrait detection) stays in Python — it just selects between `stacked_compact_rules` and `stacked_portrait_rules`.

---

## Strategy Selection

### classify_transcript()

**Location:** `packages/worker/src/agents/visual_generator/orchestrator.py` (or a new `genre_classifier.py` in the same directory)

**Implementation:** LLM-based classification. The orchestrator already runs AI calls — this is a quick one-shot classification before dispatching to Director.

```python
async def classify_transcript(transcript: str) -> str:
    """Classify transcript into a genre strategy.

    Uses a quick LLM call to analyze the transcript and return a genre name
    matching an available strategy directory.

    Args:
        transcript: The raw or formatted transcript text.

    Returns:
        Genre name (e.g. "explainer-videos", "informative-media").
        Falls back to "explainer-videos" if classification fails.
    """
    available = list_strategies()  # ["explainer-videos", "informative-media", ...]

    # Quick LLM call with structured output
    prompt = f"""Classify this transcript into one of these video genres: {', '.join(available)}

    Return ONLY the genre name, nothing else.

    Transcript (first 500 words):
    {transcript[:2000]}"""

    try:
        result = await quick_classify(prompt)  # lightweight LLM call
        genre = result.strip().lower()
        if genre in available:
            return genre
    except Exception:
        pass

    return "explainer-videos"  # safe default
```

**Input:** The formatted transcript string (same object passed to the Director).
**Override:** Future per-user settings can override this (out of scope for now).

---

## TypeScript Loader

`packages/worker/src/prompts/loader.ts` exists and exports `loadSharedModules()`. It is NOT used by the production Python pipeline (the TS pipeline in `generate-visuals.ts` is legacy).

**Action:** Add a deprecation comment. Do not update — the legacy TS pipeline (`generate-visuals/`) is out of scope. It can be cleaned up separately.

---

## Unchanged Files

These files are NOT part of this migration:

| File | Reason |
|------|--------|
| `animator/setup.md` | Setup workflow, no animation technique content |
| `animator/scene-template.md` | Per-scene subagent template |
| `animator/scene-verify.md`, `composition-verify.md`, `verify.md` | Verification prompts |
| `animator/fix-template.md` | Fix agent template |
| `animator/video-overlay-section.md` | Conditional video section |
| `animator/youtube-clip-section.md` | Conditional YouTube section |
| `animator/composition-assembly.md` | Composition.tsx assembly guide |
| `director/segment-grouping.md` | Segment grouping rules |
| `themes/themes.json` | Theme registry |
| `references/*` | Example reference prompts |
| `generate-visuals/*` | Legacy TS pipeline (not in Python assembly path) |
| `loader.ts` | Legacy TS loader (add deprecation comment only) |

---

## Breaking Changes

| Change | Old | New |
|--------|-----|-----|
| System prompt assembly | `load_shared_modules() + agent/system.md` | `build_agent_prompt(agent, genre)` |
| Director prompt | `DIRECTOR_SYSTEM_PROMPT` constant | `get_director_prompt(genre)` function |
| Animator prompt | `ANIMATOR_BASE_PROMPT` / `ANIMATOR_SYSTEM_PROMPT` constants | `get_animator_prompt(genre)` function |
| Style description | `get_director_style(preset)` from theme_loader | Strategy creative-direction replaces it; `get_style_description()` returns minimal color summary |
| Pipeline parameter | No genre parameter | `genre: str` threaded through orchestrator → visual generator → prompt builders |
| Display mode rules | Separate `overlay-rules.md` / `fullscreen-rules.md` | Sections within `composition.md`, same `{ew}/{eh}` substitution |

**Backward compat:** `ANIMATOR_BASE_PROMPT`, `ANIMATOR_SYSTEM_PROMPT`, and `DIRECTOR_SYSTEM_PROMPT` constants remain as aliases pointing to `get_*_prompt("explainer-videos")` during transition. Callers migrate incrementally.

---

## Skill Coverage Verification

Before deleting `shared/technical-rules.md`, verify these topics are covered by existing Remotion skills:

| Topic from technical-rules.md | Expected Skill |
|-------------------------------|---------------|
| Spring configurations (6 presets) | `motion-one` or `framer-motion` |
| Easing guide (entrance/exit/loop) | `motion-one` |
| Interpolate clamp rules | `remotion-best-practices` |
| Frame timing in Sequences (0-relative bug) | `remotion-best-practices` |
| Key sync pattern | `video-engagement` |
| Responsive sizing (EW/EH) | `remotion-best-practices` |

**If any topic is missing from skills, add it to the relevant skill BEFORE deleting shared/technical-rules.md.** This is part of the implementation, not a later phase.

---

## Out of Scope (Later Phases)

1. **Per-user guidelines** — user-specific overrides on top of genre strategy
2. **Theme redesign** — further simplification of theme system beyond stripping animation rules
3. **Template integration** — how templates relate to strategies
4. **Stock-footage-only format** — a strategy that uses only footage + images, no animation
5. **Legacy TS pipeline cleanup** — updating `generate-visuals.ts` and `loader.ts`
