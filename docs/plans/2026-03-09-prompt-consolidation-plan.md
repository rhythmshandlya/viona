# Prompt Consolidation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all inline prompt string constants in `animator.py` and TS prompt files with `load_prompt()`/`loadPrompt()` calls loading from `.md` files.

**Architecture:** All prompt content lives in `.md` files under `packages/worker/src/prompts/`. Python loads via `load_prompt()` from `prompts._loader`. TypeScript loads via `loadPrompt()`/`loadTemplate()` from `./loader.js`. Builder functions (which have conditional logic) stay as code but load text from `.md` files.

**Tech Stack:** Python (loader.py), TypeScript (loader.ts), `.md` prompt files

---

### Task 1: Sync overlay-rules.md from Python inline constant

The Python `OVERLAY_RULES` constant in `animator.py` is the source of truth for overlay rules. The `.md` file is stale. Overwrite the `.md` file with the Python constant content.

**Files:**
- Modify: `packages/worker/src/prompts/animator/overlay-rules.md`
- Reference: `packages/worker/src/agents/prompts/animator.py:5083-5205`

**Step 1: Copy Python OVERLAY_RULES content to overlay-rules.md**

Overwrite `packages/worker/src/prompts/animator/overlay-rules.md` with the exact content of the `OVERLAY_RULES` variable from `animator.py` lines 5083-5205 (the text between the triple quotes, not including the quotes themselves).

Note: The content uses `{ew}` and `{eh}` as Python `.format()` placeholders. These must stay as `{ew}` and `{eh}` — the caller will use `load_prompt()` then `.format(ew=..., eh=...)`.

**Step 2: Verify the .md file matches**

Run: `python -c "from pathlib import Path; content = Path('packages/worker/src/prompts/animator/overlay-rules.md').read_text(); print('OK' if '{ew}' in content and 'SPEAKER GRID' in content and 'ZERO TOLERANCE' in content else 'MISMATCH')"`
Expected: `OK`

---

### Task 2: Replace animator.py inline constants with load_prompt() calls

This is the main task. Replace each inline string constant in `animator.py` with a `load_prompt()` call. The constants are loaded at module level (cached by the loader). For constants that use Python `.format()` template vars, the caller function continues to call `.format()` on the loaded string.

**Files:**
- Modify: `packages/worker/src/agents/prompts/animator.py`

**Step 1: Add loader import at the top of animator.py**

After existing imports, add:
```python
from prompts._loader import load_prompt
```

If already imported, skip.

**Step 2: Replace each inline constant**

Replace these inline string constants (the large triple-quoted strings) with `load_prompt()` calls. Keep the variable names the same so all downstream code continues to work.

| Line | Old | New |
|------|-----|-----|
| ~41 | `_STUDIO_DESIGN_SYSTEM_TEMPLATE = """..."""` | `_STUDIO_DESIGN_SYSTEM_TEMPLATE = load_prompt('animator/studio-design-system')` |
| ~330 | `VIDEO_OVERLAY_SECTION = """..."""` | `VIDEO_OVERLAY_SECTION = load_prompt('animator/video-overlay-section')` |
| ~415 | `YOUTUBE_CLIP_SCENE_SECTION = """..."""` | `YOUTUBE_CLIP_SCENE_SECTION = load_prompt('animator/youtube-clip-section')` |
| ~541 | `ANIMATOR_SYSTEM_PROMPT = """..."""` | `ANIMATOR_SYSTEM_PROMPT = load_prompt('animator/system')` |
| ~3063 | `ANIMATOR_BASE_PROMPT = """..."""` | `ANIMATOR_BASE_PROMPT = load_prompt('animator/base')` |
| ~4866 | `ANIMATOR_SETUP_PROMPT = """..."""` | `ANIMATOR_SETUP_PROMPT = load_prompt('animator/setup')` |
| ~4981 | `ANIMATOR_SCENE_PROMPT_TEMPLATE = """..."""` | `ANIMATOR_SCENE_PROMPT_TEMPLATE = load_prompt('animator/scene-template')` |
| ~5083 | `OVERLAY_RULES = """..."""` | `OVERLAY_RULES = load_prompt('animator/overlay-rules')` |
| ~5208 | `FULLSCREEN_RULES = """..."""` | `FULLSCREEN_RULES = load_prompt('animator/fullscreen-rules')` |
| ~5337 | `SCENE_VERIFY_PROMPT = """..."""` | `SCENE_VERIFY_PROMPT = load_prompt('animator/scene-verify')` |
| ~5381 | `COMPOSITION_VERIFY_PROMPT = """..."""` | `COMPOSITION_VERIFY_PROMPT = load_prompt('animator/composition-verify')` |
| ~5419 | `VISUAL_VERIFY_PROMPT = """..."""` | `VISUAL_VERIFY_PROMPT = load_prompt('animator/verify')` |
| ~5490 | `VISUAL_FIX_PROMPT_TEMPLATE = """..."""` | `VISUAL_FIX_PROMPT_TEMPLATE = load_prompt('animator/fix-template')` |

**IMPORTANT:** Keep `STUDIO_THEMES` dict (line ~14-38) as code — it's a Python dict, not a prompt string.

**IMPORTANT:** Keep ALL functions (`get_studio_section()`, `build_animator_user_message()`, `get_display_mode_rules()`, etc.) as code — they contain logic. Only replace the string constants.

**IMPORTANT:** For constants that use `.format()` (like `_STUDIO_DESIGN_SYSTEM_TEMPLATE`, `ANIMATOR_SCENE_PROMPT_TEMPLATE`, `OVERLAY_RULES`, `VISUAL_FIX_PROMPT_TEMPLATE`), the `.md` files must use `{variable}` syntax and the calling function continues to call `.format()` on the loaded string. Do NOT change the calling code.

**Step 3: Verify the module loads without errors**

Run: `cd packages/worker && python -c "from src.agents.prompts.animator import ANIMATOR_SYSTEM_PROMPT, OVERLAY_RULES, get_studio_section; print(f'System prompt: {len(ANIMATOR_SYSTEM_PROMPT)} chars'); print(f'Overlay rules: {len(OVERLAY_RULES)} chars'); result = get_studio_section('studio-dark'); print(f'Studio section: {len(result)} chars'); print('OK')"`
Expected: Three char counts printed, then `OK`. No ImportError or FileNotFoundError.

**Step 4: Verify format() calls still work**

Run: `cd packages/worker && python -c "from src.agents.prompts.animator import get_display_mode_rules; rules = get_display_mode_rules('overlay', 1080, 1920); print('OK' if '1080' in rules and '1920' in rules else 'FAIL')"`
Expected: `OK`

---

### Task 3: Migrate TS prompt constants to .md file loading

Replace inline string constants in TypeScript prompt files with `loadPrompt()`/`loadTemplate()` calls.

**Files:**
- Modify: `packages/worker/src/prompts/generate-visuals.ts`
- Modify: `packages/worker/src/prompts/visual-references.ts`
- Modify: `packages/worker/src/prompts/motion-utilities.ts`

**Step 1: Update generate-visuals.ts**

Replace the `STYLE_GUIDELINES` inline strings with `loadPrompt()` calls:

```typescript
import { loadPrompt } from './loader.js';
import { buildReferenceExamplesSection } from './visual-references.js';

export const STYLE_GUIDELINES: Record<string, string> = {
  'studio-dark': loadPrompt('generate-visuals/style-studio-dark'),
  'studio-light': loadPrompt('generate-visuals/style-studio-light'),
};
```

Replace the `AUTOAE_SCENE_PATTERNS` inline string with a `loadPrompt()` call:

```typescript
const AUTOAE_SCENE_PATTERNS = loadPrompt('generate-visuals/scene-patterns');
```

Remove the `AD_MOTION_UTILITIES` import (line 2) since apple/google styles are removed. The `adMotionSection` variable is already set to `''` on line 227 — leave that.

Keep the `buildGenerateVisualsPrompt()` function, `formatTranscript()`, and `formatTime()` as code.

**Step 2: Update visual-references.ts**

Replace inline constants with `loadPrompt()`/`loadTemplate()` calls:

```typescript
import { loadPrompt, loadTemplate } from './loader.js';

const COMMON_PATTERNS = loadPrompt('references/common-patterns');

export function buildReferenceExamplesSection(projectId: string): string {
  const searchRace = loadTemplate('references/search-race', { projectId });
  const stackOverflow = loadTemplate('references/stack-overflow', { projectId });
  const hashCollisions = loadTemplate('references/hash-collisions', { projectId });

  return `${COMMON_PATTERNS}\n\n${searchRace}\n\n${stackOverflow}\n\n${hashCollisions}`;
}
```

Remove the four inline string constant exports (`COMMON_PATTERNS`, `REFERENCE_SEARCH_RACE`, `REFERENCE_STACK_OVERFLOW`, `REFERENCE_HASH_COLLISIONS`).

**Step 3: Update motion-utilities.ts**

Replace with:

```typescript
import { loadPrompt } from './loader.js';

export const AD_MOTION_UTILITIES = loadPrompt('motion/ad-utilities');
```

**Step 4: Verify the .md files use `{{variable}}` syntax for TS templates**

Check `references/search-race.md`, `references/stack-overflow.md`, `references/hash-collisions.md` — they should use `{{projectId}}` (double braces) for the TS `loadTemplate()` function.

Run: `grep -c "{{projectId}}" packages/worker/src/prompts/references/*.md`
Expected: Each file shows count > 0.

**Step 5: Verify TypeScript compiles**

Run: `cd packages/worker && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors in the modified files.

---

### Task 4: Delete deprecated physics-helpers.ts

This file is already deprecated (header says "patterns are now included in COMMON_PATTERNS in visual-references.ts").

**Files:**
- Delete: `packages/worker/src/prompts/physics-helpers.ts`

**Step 1: Verify no imports remain**

Run: `grep -r "physics-helpers" packages/worker/src/ --include="*.ts" | grep -v "node_modules"`
Expected: No results (or only the file itself).

**Step 2: Delete the file**

```bash
rm packages/worker/src/prompts/physics-helpers.ts
```

**Step 3: Verify TypeScript still compiles**

Run: `cd packages/worker && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors.

---

### Task 5: Verify end-to-end

**Step 1: Python prompt loading**

Run: `cd packages/worker && python -c "
from src.agents.prompts.animator import (
    ANIMATOR_SYSTEM_PROMPT, ANIMATOR_BASE_PROMPT, ANIMATOR_SETUP_PROMPT,
    ANIMATOR_SCENE_PROMPT_TEMPLATE, OVERLAY_RULES, FULLSCREEN_RULES,
    SCENE_VERIFY_PROMPT, COMPOSITION_VERIFY_PROMPT,
    VISUAL_VERIFY_PROMPT, VISUAL_FIX_PROMPT_TEMPLATE,
    VIDEO_OVERLAY_SECTION, YOUTUBE_CLIP_SCENE_SECTION,
    get_studio_section, get_display_mode_rules, build_animator_user_message
)
print(f'System: {len(ANIMATOR_SYSTEM_PROMPT)} chars')
print(f'Base: {len(ANIMATOR_BASE_PROMPT)} chars')
print(f'Overlay: {len(OVERLAY_RULES)} chars')
print(f'Studio dark: {len(get_studio_section(\"studio-dark\"))} chars')
rules = get_display_mode_rules('overlay', 1080, 1920)
assert '1080' in rules, 'format() substitution failed'
print('ALL OK')
"`
Expected: Char counts printed, then `ALL OK`.

**Step 2: TypeScript compilation**

Run: `cd packages/worker && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to prompt files.

**Step 3: Verify animator.py file size decreased**

The file should shrink dramatically since ~3000+ lines of string constants were removed.

Run: `wc -l packages/worker/src/agents/prompts/animator.py`
Expected: Significantly fewer lines than the original ~5700.
