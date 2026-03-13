# Prompt Extraction Design

## Problem

Animation prompts are embedded as massive inline strings across Python and TypeScript files. `animator.py` alone is 5,800+ lines of inline strings. This makes prompts hard to edit, review, and maintain. Prompt changes are buried in code diffs.

## Solution

Extract all prompts into `.md` files in a unified `packages/worker/src/prompts/` folder, loaded programmatically via thin loader utilities in both TypeScript and Python.

## Folder Structure

```
packages/worker/src/prompts/
├── loader.ts                          # TS loader: loadPrompt(), loadTemplate()
├── loader.py                          # Python loader: load_prompt(), load_template()
│
├── assistant-director/
│   ├── system.md                      # ASSISTANT_DIRECTOR_SYSTEM_PROMPT
│   └── user-template.md               # Template for build_assistant_director_message()
│
├── director/
│   ├── system.md                      # DIRECTOR_SYSTEM_PROMPT
│   └── user-template.md               # Template for build_director_user_message()
│
├── animator/
│   ├── system.md                      # ANIMATOR_SYSTEM_PROMPT (monolithic)
│   ├── base.md                        # ANIMATOR_BASE_PROMPT (modular)
│   ├── scene-template.md              # ANIMATOR_SCENE_PROMPT_TEMPLATE
│   ├── verify.md                      # VISUAL_VERIFY_PROMPT
│   ├── fix-template.md                # VISUAL_FIX_PROMPT_TEMPLATE
│   ├── studio-design-system.md        # _STUDIO_DESIGN_SYSTEM_TEMPLATE
│   └── youtube-clip-section.md        # YOUTUBE_CLIP_SCENE_SECTION
│
├── generate-visuals/
│   ├── system.md                      # Main prompt (static parts of buildGenerateVisualsPrompt)
│   ├── style-studio-dark.md           # STYLE_GUIDELINES['studio-dark']
│   ├── style-studio-light.md          # STYLE_GUIDELINES['studio-light']
│   └── scene-patterns.md              # AUTOAE_SCENE_PATTERNS
│
├── references/
│   ├── common-patterns.md             # COMMON_PATTERNS
│   ├── search-race.md                 # REFERENCE_SEARCH_RACE
│   ├── stack-overflow.md              # REFERENCE_STACK_OVERFLOW
│   └── hash-collisions.md             # REFERENCE_HASH_COLLISIONS
│
├── motion/
│   ├── ad-utilities.md                # AD_MOTION_UTILITIES
│   ├── ball-physics.md                # BALL_PHYSICS_SIMULATION
│   ├── squash-stretch.md              # SQUASH_STRETCH
│   ├── shake-effect.md                # SHAKE_EFFECT
│   └── explosion-particles.md         # EXPLOSION_PARTICLES
│
├── transcribe/
│   └── word-analysis.md               # WORD_ANALYSIS_SYSTEM_PROMPT
│
├── studio-templates.ts                # KEPT AS CODE (dynamic, calls listTemplates())
└── generate-visuals.ts                # KEPT AS CODE (builder function with logic)
```

## Template Variables

Markdown files use `{{variable}}` syntax for dynamic content, replaced at load time:

```md
## TRANSCRIPT
{{transcript}}

## DURATION
{{duration_frames}} frames at {{fps}} FPS
```

## Loader API

### TypeScript (`loader.ts`)

```ts
import { loadPrompt, loadTemplate } from './loader.js';

// Load raw prompt (no substitution)
const system = loadPrompt('animator/system');

// Load template with variable substitution
const userMsg = loadTemplate('director/user-template', {
  transcript: '...',
  duration_frames: 300,
  fps: 30,
});
```

### Python (`loader.py`)

```python
from prompts.loader import load_prompt, load_template

# Same API
system = load_prompt('animator/system')
user_msg = load_template('director/user-template', transcript='...', duration_frames=300)
```

Both loaders:
- Resolve paths relative to the `prompts/` directory
- Read `.md` files synchronously
- Replace `{{var}}` placeholders with provided values
- Cache file contents (prompts are static, no need to re-read)

## What Stays as Code

- `studio-templates.ts` — calls `listTemplates()` at runtime to build dynamic catalog
- `generate-visuals.ts` — `buildGenerateVisualsPrompt()` has conditional logic, transcript formatting, computed values. Static prompt text extracted to `.md`, but builder function stays.
- Python builder functions (`build_director_user_message`, etc.) — stay as thin wrappers that call `load_template()`.

## What Gets Replaced

- `agents/prompts/director.py` — prompt constants → `.md` files, builder → calls `load_template()`
- `agents/prompts/animator.py` — all 6 prompt constants → `.md` files, builders stay as wrappers
- `agents/prompts/assistant_director.py` — prompt constant → `.md`, builder → calls `load_template()`
- `visual-references.ts` — 3 reference examples + common patterns → `.md` files, `buildReferenceExamplesSection()` stays but loads from `.md`
- `motion-utilities.ts` — `AD_MOTION_UTILITIES` → `.md` file, re-exported from loader
- `physics-helpers.ts` — 4 constants → `.md` files, re-exported from loader
- `transcribe.ts` inline `WORD_ANALYSIS_SYSTEM_PROMPT` → `.md` file, imported from loader

## Migration Strategy

1. Create loader utilities (TS + Python)
2. Extract `.md` files from existing inline strings (content-identical)
3. Update consumers to use loaders
4. Keep `agents/prompts/__init__.py` exports unchanged — backward-compatible
5. Delete old inline string constants

## Backward Compatibility

The `__init__.py` re-exports remain the same. Consumers import from `agents/prompts/` as before and get the same strings. The only difference is the strings now come from `.md` files.
