# Prompt Consolidation Design

**Goal:** Make all prompt content live in `.md` files under `packages/worker/src/prompts/`, loaded via `loader.py`/`loader.ts`. Eliminate inline string constants from `animator.py` and TS prompt files.

## Current State

- **Director** (`director.py`): Already loads from `.md` files via `load_prompt()` — no changes needed
- **Animator** (`animator.py`): 13 inline string constants (~3000 lines of prompts) — `.md` files exist but are orphaned
- **TS files** (`generate-visuals.ts`, `motion-utilities.ts`, `visual-references.ts`, `physics-helpers.ts`): Export string constants inline — `.md` files exist but aren't loaded

## Canonical Source Decision

- `.md` files are canonical for all prompts **except** `overlay-rules.md`
- For `overlay-rules.md`: sync from Python inline `OVERLAY_RULES` constant (has latest changes)

## Migration Plan

### 1. Animator Python Migration

Replace each inline constant in `animator.py` with `load_prompt()`:

| Inline Constant | .md File | Template Vars? |
|---|---|---|
| `_STUDIO_DESIGN_SYSTEM_TEMPLATE` | `animator/studio-design-system.md` | Yes (Python `.format()`) |
| `VIDEO_OVERLAY_SECTION` | `animator/video-overlay-section.md` | No |
| `YOUTUBE_CLIP_SCENE_SECTION` | `animator/youtube-clip-section.md` | No |
| `ANIMATOR_SYSTEM_PROMPT` | `animator/system.md` | No |
| `ANIMATOR_BASE_PROMPT` | `animator/base.md` | No |
| `ANIMATOR_SETUP_PROMPT` | `animator/setup.md` | No |
| `ANIMATOR_SCENE_PROMPT_TEMPLATE` | `animator/scene-template.md` | Yes (Python `.format()`) |
| `OVERLAY_RULES` | `animator/overlay-rules.md` | Yes (`{ew}`, `{eh}`) |
| `FULLSCREEN_RULES` | `animator/fullscreen-rules.md` | No |
| `SCENE_VERIFY_PROMPT` | `animator/scene-verify.md` | No |
| `COMPOSITION_VERIFY_PROMPT` | `animator/composition-verify.md` | No |
| `VISUAL_VERIFY_PROMPT` | `animator/verify.md` | No |
| `VISUAL_FIX_PROMPT_TEMPLATE` | `animator/fix-template.md` | Yes (Python `.format()`) |

For constants with template vars: load with `load_prompt()`, then call `.format()` in the function that uses them.

### 2. Overlay Rules Sync

Copy current Python `OVERLAY_RULES` content → `animator/overlay-rules.md` (overwrite stale .md).

### 3. TS File Migration

| TS File | Action | Target .md |
|---|---|---|
| `motion-utilities.ts` | Replace `AD_MOTION_UTILITIES` with `loadPrompt('motion/ad-utilities')` | `motion/ad-utilities.md` (exists) |
| `visual-references.ts` | Replace 4 constants with `loadPrompt()`/`loadTemplate()` calls | `references/*.md` (exist) |
| `physics-helpers.ts` | Delete — already deprecated, content in `motion/*.md` | N/A |
| `generate-visuals.ts` | Replace `STYLE_GUIDELINES` with `loadPrompt()`, load `AUTOAE_SCENE_PATTERNS` from .md | `generate-visuals/*.md` (exist) |

### 4. What Stays as Code

- `loader.py` / `loader.ts` — the loaders themselves
- `studio-templates.ts` — dynamic runtime catalog builder
- Builder functions in `animator.py` (`get_studio_section()`, `build_animator_user_message()`, etc.)
- Builder functions in `director.py` (`build_director_user_message()`, etc.)
- `agents/prompts/_loader.py` — bridge module
