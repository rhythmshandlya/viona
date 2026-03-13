# Prompt Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract all inline prompt strings into `.md` files in a unified `packages/worker/src/prompts/` folder, loaded programmatically via loader utilities.

**Architecture:** Markdown files with `{{variable}}` template syntax, loaded by thin TS/Python loaders. Builder functions stay as code but delegate to loaders. Consumers' imports remain unchanged.

**Tech Stack:** Node.js `fs.readFileSync`, Python `pathlib`, `{{var}}` regex replacement.

---

### Task 1: Create TypeScript Prompt Loader

**Files:**
- Create: `packages/worker/src/prompts/loader.ts`

**Step 1: Write the loader**

```ts
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cache = new Map<string, string>();

/**
 * Load a prompt markdown file by name (e.g. 'animator/system').
 * Returns the raw file content as a string.
 */
export function loadPrompt(name: string): string {
  if (cache.has(name)) return cache.get(name)!;
  const filePath = resolve(__dirname, `${name}.md`);
  const content = readFileSync(filePath, 'utf-8');
  cache.set(name, content);
  return content;
}

/**
 * Load a prompt template and substitute {{variable}} placeholders.
 */
export function loadTemplate(name: string, vars: Record<string, string | number>): string {
  const raw = loadPrompt(name);
  return raw.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (key in vars) return String(vars[key]);
    return `{{${key}}}`; // leave unmatched placeholders
  });
}

/** Clear the prompt cache (useful for testing). */
export function clearPromptCache(): void {
  cache.clear();
}
```

**Step 2: Commit**

```bash
git add packages/worker/src/prompts/loader.ts
git commit -m "feat(prompts): add TypeScript prompt loader with template substitution"
```

---

### Task 2: Create Python Prompt Loader

**Files:**
- Create: `packages/worker/src/prompts/loader.py`

**Step 1: Write the loader**

```python
"""
Prompt loader — reads .md files from the prompts directory tree
and optionally substitutes {{variable}} placeholders.
"""

import re
from pathlib import Path

_PROMPTS_DIR = Path(__file__).parent
_cache: dict[str, str] = {}


def load_prompt(name: str) -> str:
    """Load a prompt markdown file by name (e.g. 'animator/system').

    Returns the raw file content as a string.
    """
    if name in _cache:
        return _cache[name]
    path = _PROMPTS_DIR / f"{name}.md"
    content = path.read_text(encoding="utf-8")
    _cache[name] = content
    return content


def load_template(name: str, **kwargs: str | int) -> str:
    """Load a prompt template and substitute {{variable}} placeholders."""
    raw = load_prompt(name)
    def _replace(m: re.Match) -> str:
        key = m.group(1)
        if key in kwargs:
            return str(kwargs[key])
        return m.group(0)  # leave unmatched
    return re.sub(r"\{\{(\w+)\}\}", _replace, raw)


def clear_cache() -> None:
    """Clear the prompt cache."""
    _cache.clear()
```

**Step 2: Commit**

```bash
git add packages/worker/src/prompts/loader.py
git commit -m "feat(prompts): add Python prompt loader with template substitution"
```

---

### Task 3: Extract Animator Prompt Constants to Markdown

**Files:**
- Source: `packages/worker/src/agents/prompts/animator.py` (lines 16-5800)
- Create: `packages/worker/src/prompts/animator/system.md` (from `ANIMATOR_SYSTEM_PROMPT`, line 580)
- Create: `packages/worker/src/prompts/animator/base.md` (from `ANIMATOR_BASE_PROMPT`, line 3132)
- Create: `packages/worker/src/prompts/animator/scene-template.md` (from `ANIMATOR_SCENE_PROMPT_TEMPLATE`, line 5071)
- Create: `packages/worker/src/prompts/animator/verify.md` (from `VISUAL_VERIFY_PROMPT`, line 5518)
- Create: `packages/worker/src/prompts/animator/fix-template.md` (from `VISUAL_FIX_PROMPT_TEMPLATE`, line 5589)
- Create: `packages/worker/src/prompts/animator/studio-design-system.md` (from `_STUDIO_DESIGN_SYSTEM_TEMPLATE`, line 41)
- Create: `packages/worker/src/prompts/animator/youtube-clip-section.md` (from `YOUTUBE_CLIP_SCENE_SECTION`, line 454)
- Create: `packages/worker/src/prompts/animator/video-overlay-section.md` (from `VIDEO_OVERLAY_SECTION`, line 369)
- Create: `packages/worker/src/prompts/animator/setup.md` (from `ANIMATOR_SETUP_PROMPT`, line 4956)
- Create: `packages/worker/src/prompts/animator/scene-verify.md` (from `SCENE_VERIFY_PROMPT`, line 5435)
- Create: `packages/worker/src/prompts/animator/composition-verify.md` (from `COMPOSITION_VERIFY_PROMPT`, line 5479)
- Create: `packages/worker/src/prompts/animator/overlay-rules.md` (from `OVERLAY_RULES`, line 5173)
- Create: `packages/worker/src/prompts/animator/fullscreen-rules.md` (from `FULLSCREEN_RULES`, line 5306)

**Step 1: Extract each prompt constant**

For each constant listed above:
1. Copy the string content (between the triple quotes) to the corresponding `.md` file
2. Content must be **byte-identical** to the original string (no reformatting)
3. For templates with Python f-string variables like `{scene_num}`, convert to `{{scene_num}}` syntax

**Step 2: Update `animator.py` to use loader**

Replace each constant with a loader call. Example:

```python
from prompts.loader import load_prompt, load_template

# Before:
# ANIMATOR_SYSTEM_PROMPT = """...(2000 lines)..."""

# After:
ANIMATOR_SYSTEM_PROMPT = load_prompt('animator/system')
ANIMATOR_BASE_PROMPT = load_prompt('animator/base')
ANIMATOR_SCENE_PROMPT_TEMPLATE = load_prompt('animator/scene-template')
VISUAL_VERIFY_PROMPT = load_prompt('animator/verify')
VISUAL_FIX_PROMPT_TEMPLATE = load_prompt('animator/fix-template')
_STUDIO_DESIGN_SYSTEM_TEMPLATE = load_prompt('animator/studio-design-system')
YOUTUBE_CLIP_SCENE_SECTION = load_prompt('animator/youtube-clip-section')
VIDEO_OVERLAY_SECTION = load_prompt('animator/video-overlay-section')
ANIMATOR_SETUP_PROMPT = load_prompt('animator/setup')
SCENE_VERIFY_PROMPT = load_prompt('animator/scene-verify')
COMPOSITION_VERIFY_PROMPT = load_prompt('animator/composition-verify')
OVERLAY_RULES = load_prompt('animator/overlay-rules')
FULLSCREEN_RULES = load_prompt('animator/fullscreen-rules')
```

Keep all functions (`get_studio_section()`, `build_animator_user_message()`, `get_display_mode_rules()`, `build_setup_user_message()`, `build_scene_user_message()`, `build_scene_brief()`, `build_scene_task_prompt()`, `_build_default_rules()`) as-is — they contain logic, not just strings. Also keep `STUDIO_THEMES` dict as code.

**Step 3: Verify imports still work**

The `__init__.py` exports don't change. Run a quick Python import test:

```bash
cd packages/worker/src/agents && python -c "from prompts import ANIMATOR_SYSTEM_PROMPT; print(len(ANIMATOR_SYSTEM_PROMPT), 'chars loaded')"
```

**Step 4: Commit**

```bash
git add packages/worker/src/prompts/animator/ packages/worker/src/agents/prompts/animator.py
git commit -m "refactor(prompts): extract animator prompt constants to markdown files"
```

---

### Task 4: Extract Director Prompt Constants to Markdown

**Files:**
- Source: `packages/worker/src/agents/prompts/director.py`
- Create: `packages/worker/src/prompts/director/system.md` (from `DIRECTOR_SYSTEM_PROMPT`, line 8)
- Create: `packages/worker/src/prompts/director/studio-style-template.md` (from `_STUDIO_STYLE_TEMPLATE`, line 760)
- Create: `packages/worker/src/prompts/director/display-mode-table.md` (from `_DISPLAY_MODE_TABLE`, line 876)

**Step 1: Extract prompt constants to `.md` files**

Same approach as Task 3. Copy string content byte-identical. Convert Python f-string vars to `{{var}}` where needed.

**Step 2: Update `director.py` to use loader**

```python
from prompts.loader import load_prompt

DIRECTOR_SYSTEM_PROMPT = load_prompt('director/system')
_STUDIO_STYLE_TEMPLATE = load_prompt('director/studio-style-template')
_DISPLAY_MODE_TABLE = load_prompt('director/display-mode-table')
```

Keep all functions (`get_style_description()`, `get_aspect_ratio_name()`, `_coverage_tier()`, `get_layout_context()`, `build_director_user_message()`) and dicts (`STUDIO_THEMES`, `STYLE_PRESET_DESCRIPTIONS`) as code.

**Step 3: Verify imports**

```bash
cd packages/worker/src/agents && python -c "from prompts import DIRECTOR_SYSTEM_PROMPT; print(len(DIRECTOR_SYSTEM_PROMPT), 'chars loaded')"
```

**Step 4: Commit**

```bash
git add packages/worker/src/prompts/director/ packages/worker/src/agents/prompts/director.py
git commit -m "refactor(prompts): extract director prompt constants to markdown files"
```

---

### Task 5: Extract Assistant Director Prompt to Markdown

**Files:**
- Source: `packages/worker/src/agents/prompts/assistant_director.py`
- Create: `packages/worker/src/prompts/assistant-director/system.md` (from `ASSISTANT_DIRECTOR_SYSTEM_PROMPT`, line 9)

**Step 1: Extract prompt to `.md` file**

**Step 2: Update `assistant_director.py` to use loader**

```python
from prompts.loader import load_prompt

ASSISTANT_DIRECTOR_SYSTEM_PROMPT = load_prompt('assistant-director/system')
```

Keep `build_assistant_director_message()` function as-is.

**Step 3: Verify imports**

```bash
cd packages/worker/src/agents && python -c "from prompts.assistant_director import ASSISTANT_DIRECTOR_SYSTEM_PROMPT; print(len(ASSISTANT_DIRECTOR_SYSTEM_PROMPT), 'chars loaded')"
```

**Step 4: Commit**

```bash
git add packages/worker/src/prompts/assistant-director/ packages/worker/src/agents/prompts/assistant_director.py
git commit -m "refactor(prompts): extract assistant director prompt to markdown file"
```

---

### Task 6: Extract TypeScript Visual Reference Prompts to Markdown

**Files:**
- Source: `packages/worker/src/prompts/visual-references.ts`
- Create: `packages/worker/src/prompts/references/common-patterns.md` (from `COMMON_PATTERNS`)
- Create: `packages/worker/src/prompts/references/search-race.md` (from `REFERENCE_SEARCH_RACE`)
- Create: `packages/worker/src/prompts/references/stack-overflow.md` (from `REFERENCE_STACK_OVERFLOW`)
- Create: `packages/worker/src/prompts/references/hash-collisions.md` (from `REFERENCE_HASH_COLLISIONS`)
- Modify: `packages/worker/src/prompts/visual-references.ts`

**Step 1: Extract each constant to `.md` files**

Copy the template literal content (between backticks) to the corresponding `.md` files. These contain `${projectId}` — convert to `{{projectId}}`.

**Step 2: Update `visual-references.ts` to use loader**

```ts
import { loadPrompt, loadTemplate } from './loader.js';

export const COMMON_PATTERNS = loadPrompt('references/common-patterns');
export const REFERENCE_SEARCH_RACE = loadPrompt('references/search-race');
export const REFERENCE_STACK_OVERFLOW = loadPrompt('references/stack-overflow');
export const REFERENCE_HASH_COLLISIONS = loadPrompt('references/hash-collisions');

export function buildReferenceExamplesSection(projectId: string): string {
  return `
## REFERENCE PATTERNS & EXAMPLES
...
${COMMON_PATTERNS}
---
${loadTemplate('references/search-race', { projectId })}
---
${loadTemplate('references/stack-overflow', { projectId })}
---
${loadTemplate('references/hash-collisions', { projectId })}
`;
}
```

**Step 3: Commit**

```bash
git add packages/worker/src/prompts/references/ packages/worker/src/prompts/visual-references.ts
git commit -m "refactor(prompts): extract visual reference examples to markdown files"
```

---

### Task 7: Extract Motion & Physics Prompts to Markdown

**Files:**
- Source: `packages/worker/src/prompts/motion-utilities.ts`
- Source: `packages/worker/src/prompts/physics-helpers.ts`
- Create: `packages/worker/src/prompts/motion/ad-utilities.md` (from `AD_MOTION_UTILITIES`)
- Create: `packages/worker/src/prompts/motion/ball-physics.md` (from `BALL_PHYSICS_SIMULATION`)
- Create: `packages/worker/src/prompts/motion/squash-stretch.md` (from `SQUASH_STRETCH`)
- Create: `packages/worker/src/prompts/motion/shake-effect.md` (from `SHAKE_EFFECT`)
- Create: `packages/worker/src/prompts/motion/explosion-particles.md` (from `EXPLOSION_PARTICLES`)
- Modify: `packages/worker/src/prompts/motion-utilities.ts`
- Modify: `packages/worker/src/prompts/physics-helpers.ts`

**Step 1: Extract each constant to `.md` files**

**Step 2: Update both `.ts` files to use loader**

```ts
// motion-utilities.ts
import { loadPrompt } from './loader.js';
export const AD_MOTION_UTILITIES = loadPrompt('motion/ad-utilities');

// physics-helpers.ts
import { loadPrompt } from './loader.js';
export const BALL_PHYSICS_SIMULATION = loadPrompt('motion/ball-physics');
export const SQUASH_STRETCH = loadPrompt('motion/squash-stretch');
export const SHAKE_EFFECT = loadPrompt('motion/shake-effect');
export const EXPLOSION_PARTICLES = loadPrompt('motion/explosion-particles');
```

**Step 3: Commit**

```bash
git add packages/worker/src/prompts/motion/ packages/worker/src/prompts/motion-utilities.ts packages/worker/src/prompts/physics-helpers.ts
git commit -m "refactor(prompts): extract motion and physics prompts to markdown files"
```

---

### Task 8: Extract Style Guidelines & Scene Patterns to Markdown

**Files:**
- Source: `packages/worker/src/prompts/generate-visuals.ts`
- Create: `packages/worker/src/prompts/generate-visuals/style-studio-dark.md` (from `STYLE_GUIDELINES['studio-dark']`)
- Create: `packages/worker/src/prompts/generate-visuals/style-studio-light.md` (from `STYLE_GUIDELINES['studio-light']`)
- Create: `packages/worker/src/prompts/generate-visuals/scene-patterns.md` (from `AUTOAE_SCENE_PATTERNS`)
- Modify: `packages/worker/src/prompts/generate-visuals.ts`

**Step 1: Extract each string to `.md` files**

**Step 2: Update `generate-visuals.ts`**

```ts
import { loadPrompt } from './loader.js';

export const STYLE_GUIDELINES: Record<string, string> = {
  'studio-dark': loadPrompt('generate-visuals/style-studio-dark'),
  'studio-light': loadPrompt('generate-visuals/style-studio-light'),
};

const AUTOAE_SCENE_PATTERNS = loadPrompt('generate-visuals/scene-patterns');
```

The `buildGenerateVisualsPrompt()` function, `formatTranscript()`, `formatTime()`, `PromptOptions` interface, and `TranscriptWord` interface stay as code.

**Step 3: Commit**

```bash
git add packages/worker/src/prompts/generate-visuals/ packages/worker/src/prompts/generate-visuals.ts
git commit -m "refactor(prompts): extract style guidelines and scene patterns to markdown files"
```

---

### Task 9: Extract Word Analysis Prompt from Transcribe Processor

**Files:**
- Source: `packages/worker/src/processors/transcribe.ts` (line 78)
- Create: `packages/worker/src/prompts/transcribe/word-analysis.md`
- Modify: `packages/worker/src/processors/transcribe.ts`

**Step 1: Extract `WORD_ANALYSIS_SYSTEM_PROMPT` to `.md` file**

**Step 2: Update `transcribe.ts`**

```ts
import { loadPrompt } from '../prompts/loader.js';

const WORD_ANALYSIS_SYSTEM_PROMPT = loadPrompt('transcribe/word-analysis');
```

Remove the old inline constant.

**Step 3: Commit**

```bash
git add packages/worker/src/prompts/transcribe/ packages/worker/src/processors/transcribe.ts
git commit -m "refactor(prompts): extract word analysis prompt to markdown file"
```

---

### Task 10: Update Python sys.path for Prompts Loader

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py` (lines 28-30)

**Step 1: Verify the prompts loader path resolution**

The Python `agents/prompts/` package currently imports work because `_agents_dir` is added to `sys.path` (line 28-30). The new `loader.py` lives in `packages/worker/src/prompts/`, which is a sibling of `agents/`. Since `agents/prompts/*.py` files import `from prompts.loader import ...`, and the `prompts` package they reference is `agents/prompts/`, the loader needs to be importable from that context.

Add the `src/prompts/` directory to the Python import path in `agents/prompts/__init__.py` or update `loader.py` to live inside `agents/prompts/` and have it read from `../../prompts/`.

Simplest approach: put a thin `agents/prompts/_loader.py` wrapper that calls the shared loader with the correct base path:

```python
# agents/prompts/_loader.py
from pathlib import Path

# Point to the shared prompts directory (packages/worker/src/prompts/)
_SHARED_PROMPTS_DIR = Path(__file__).parent.parent.parent / "prompts"

# Re-export loader functions with correct base path
import sys
sys.path.insert(0, str(_SHARED_PROMPTS_DIR))
from loader import load_prompt, load_template, clear_cache
```

Then in `animator.py`, `director.py`, `assistant_director.py`:
```python
from prompts._loader import load_prompt
```

**Step 2: Commit**

```bash
git add packages/worker/src/agents/prompts/_loader.py
git commit -m "feat(prompts): add Python path bridge for shared prompts loader"
```

---

### Task 11: Smoke Test Full Pipeline

**Step 1: Verify TypeScript imports compile**

```bash
cd packages/worker && npx tsc --noEmit 2>&1 | head -20
```

Expected: No new errors related to prompts.

**Step 2: Verify Python imports work**

```bash
cd packages/worker/src/agents && python -c "
from prompts import DIRECTOR_SYSTEM_PROMPT, ANIMATOR_SYSTEM_PROMPT
from prompts.animator import VISUAL_VERIFY_PROMPT, VISUAL_FIX_PROMPT_TEMPLATE
from prompts.assistant_director import ASSISTANT_DIRECTOR_SYSTEM_PROMPT
print('All Python prompts loaded successfully')
print(f'Director: {len(DIRECTOR_SYSTEM_PROMPT)} chars')
print(f'Animator: {len(ANIMATOR_SYSTEM_PROMPT)} chars')
print(f'Verify: {len(VISUAL_VERIFY_PROMPT)} chars')
"
```

**Step 3: Verify prompt content is unchanged**

Spot-check that extracted `.md` files match the original inline strings by comparing first/last lines.

**Step 4: Final commit**

```bash
git add -A
git commit -m "refactor(prompts): complete prompt extraction to markdown files"
```
