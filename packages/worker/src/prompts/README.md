# Prompts Directory

All LLM prompt templates for the Viona video generation pipeline. Each prompt is stored as a `.md` file and loaded programmatically via `loader.ts` (TypeScript) or `loader.py` (Python).

## How It Works

```
prompts/
├── loader.ts                    # TS: loadPrompt(), loadTemplate()
├── loader.py                    # Python: load_prompt(), load_template()
├── animator/                    # Phase 2: Remotion code generation
├── director/                    # Phase 1: Scene planning
├── generate-visuals/            # TS visual generation pipeline
├── references/                  # Few-shot code examples
├── motion/                      # Animation utility snippets
├── transcribe/                  # Caption word classification
└── generate-visuals.ts          # Visual prompt builder (code, not .md)
```

### Loading Prompts

**TypeScript:**
```ts
import { loadPrompt, loadTemplate } from './loader.js';

const system = loadPrompt('animator/system');
const msg = loadTemplate('references/search-race', { projectId: 'abc123' });
```

**Python:**
```python
from prompts._loader import load_prompt, load_template

system = load_prompt('animator/system')
msg = load_template('director/user-template', transcript='...', fps=30)
```

Both loaders cache files in memory. Use `{{variable}}` syntax for template placeholders.

> **Python note:** Python prompt builders (`animator.py`, `director.py`) live alongside their `.md` files in this directory. They import via `prompts._loader` which re-exports from `loader.py`. Some prompts use Python `.format()` with `{var}` syntax — those are loaded with `load_prompt()` and formatted by the caller, not by `load_template()`.

---

## Pipeline Overview

The video generation pipeline runs through 5 phases, each using different prompts. Here's the full flow:

```mermaid
graph TB
    subgraph "Phase 1: Director"
        DIR_SYS["director/system.md"]
        DIR_USER["build_director_user_message()"]
        DIR_STYLE["get_theme(style_preset)"]
        DIR_DISPLAY["director/display-mode-table.md"]
        DIR_STYLE --> DIR_USER
        DIR_DISPLAY --> DIR_USER
        DIR_SYS --> DIR_CALL["Opus LLM Call"]
        DIR_USER --> DIR_CALL
        DIR_CALL --> PLAN["SCENE_PLAN.md + scenes.json"]
    end

    subgraph "Phase 2: Animator"
        ANIM_SYS["animator/system.md"]
        THEME["get_theme(style_preset)<br/>design system from themes.json"]
        YT_CLIP["animator/youtube-clip-section.md"]
        ANIM_USER["build_animator_user_message()"]
        PLAN --> ANIM_USER
        ANIM_SYS --> ANIM_PROMPT["Assembled System Prompt"]
        THEME -.->|"if themed"| ANIM_PROMPT
        YT_CLIP -.->|"if youtube-clip scenes"| ANIM_PROMPT
        ANIM_PROMPT --> ANIM_CALL["Opus LLM Call"]
        ANIM_USER --> ANIM_CALL
        ANIM_CALL --> CODE["Remotion Components"]
    end

    subgraph "Phase 2e: Visual Verification"
        CODE --> STILL["remotion still (screenshots)"]
        STILL --> VERIFY_SYS["animator/verify.md"]
        VERIFY_SYS --> VERIFY_CALL["Opus Review"]
        VERIFY_CALL -->|"issues found"| FIX_SYS["animator/fix-template.md"]
        FIX_SYS --> FIX_CALL["Opus Fix Agent"]
        FIX_CALL -->|"max 2 retries"| STILL
        VERIFY_CALL -->|"pass"| DONE["Final Output"]
    end

    style PLAN fill:#e0f2fe,stroke:#0284c7
    style CODE fill:#dcfce7,stroke:#16a34a
    style DONE fill:#fef9c3,stroke:#ca8a04
```

---

## Phase 1: Director (Scene Planning)

**Purpose:** Analyze transcript with timestamps and create a frame-accurate scene plan.

| Component | Source |
|-----------|--------|
| System prompt | `director/system.md` |
| User message | `build_director_user_message()` in `director.py` |
| Model | Opus |
| Tools | `Read`, `Write`, `Grep`, `Glob`, `WebSearch`, `TodoWrite` |
| Output | `SCENE_PLAN.md` + `scenes.json` |

### How the Director User Message Assembles

```mermaid
graph LR
    subgraph "build_director_user_message()"
        CANVAS["Canvas specs<br/>(width, height, fps, duration)"]
        LAYOUT["get_layout_context()"]
        STYLE["get_style_description()"]
        TRANSCRIPT["Formatted transcript<br/>(word-level timestamps)"]
        GUIDE["User style guide<br/>(if provided)"]
        TEMPLATES["Templates catalog<br/>(if theme preset)"]
    end

    DM["director/display-mode-table.md"] --> LAYOUT
    SST["get_theme(style_preset)<br/>from themes.json"] --> STYLE
    THEMES["themes.json registry"] --> STYLE

    CANVAS --> MSG["Final User Message"]
    LAYOUT --> MSG
    STYLE --> MSG
    TRANSCRIPT --> MSG
    GUIDE --> MSG
    TEMPLATES -.-> MSG
```

**Conditional injections:**
- `get_theme(style_preset)` — only if theme exists for the given preset
- `director/display-mode-table.md` — always included (defines overlay/fullscreen/default modes)
- Coverage tier guidance — only if source video dimensions are known

---

## Phase 2: Animator (Code Generation)

**Purpose:** Implement the Director's scene plan as Remotion TypeScript components.

The Animator has **two execution paths**:

### Path A: Monolithic (Single Agent)

Used for smaller projects. One agent implements all scenes.

```mermaid
graph TB
    subgraph "System Prompt Assembly"
        BASE["animator/system.md<br/>(core Remotion rules)"]
        THEME_SEC["get_theme(style_preset)<br/>(theme colors, design system)"]
        YT_SEC["animator/youtube-clip-section.md<br/>(clip-specific rules)"]
        LIBS["Remotion libraries guide<br/>(in-code)"]
        SKILLS["Condensed animation skills<br/>(in-code)"]
        ASSETS["User assets<br/>(from user_assets.json)"]
    end

    BASE --> COMBINED["Combined System Prompt"]
    THEME_SEC -.->|"if themed"| COMBINED
    YT_SEC -.->|"if youtube-clip scenes"| COMBINED
    LIBS --> COMBINED
    SKILLS --> COMBINED
    ASSETS -.->|"if assets exist"| COMBINED

    subgraph "User Message"
        ANIM_USER["build_animator_user_message()"]
        TMPL_CAT["Templates catalog"]
    end

    ANIM_USER --> USER_MSG["Final User Message"]
    TMPL_CAT -.->|"if theme preset"| USER_MSG

    COMBINED --> LLM["Opus LLM Call"]
    USER_MSG --> LLM
```

### Path B: Modular (Coordinator + Per-Scene Subagents)

Used for larger projects. A coordinator dispatches per-scene agents.

```mermaid
graph TB
    subgraph "Coordinator"
        SETUP["animator/setup.md"]
        SETUP --> COORD["Coordinator Agent"]
    end

    subgraph "Per-Scene Subagent"
        SCENE_TPL["animator/scene-template.md"]
        MODE_RULES{"Display Mode?"}
        OVERLAY["animator/overlay-rules.md"]
        FULLSCREEN["animator/fullscreen-rules.md"]
        DEFAULT["_build_default_rules()<br/>(dynamic)"]

        MODE_RULES -->|"overlay"| OVERLAY
        MODE_RULES -->|"fullscreen"| FULLSCREEN
        MODE_RULES -->|"default"| DEFAULT

        SCENE_TPL --> SCENE_PROMPT["Scene Task Prompt"]
        OVERLAY --> SCENE_PROMPT
        FULLSCREEN --> SCENE_PROMPT
        DEFAULT --> SCENE_PROMPT
    end

    COORD -->|"dispatches"| SCENE_PROMPT
    SCENE_PROMPT --> SCENE_LLM["Opus LLM Call"]
    SCENE_LLM --> SCENE_CODE["Scene{N}.tsx"]
```

**Display mode rules** control how much canvas space the scene visual occupies:

| Mode | Rules Source | Use Case |
|------|-------------|----------|
| `overlay` | `animator/overlay-rules.md` | Visual overlaid on video |
| `fullscreen` | `animator/fullscreen-rules.md` | Full-screen visual, no video |
| `default` | `_build_default_rules(ew, eh)` (dynamic) | Standard layout with computed dimensions |

---

## Phase 2 Verification (Quality Gates)

After the Animator produces code, multiple verification steps run:

```mermaid
graph TB
    CODE["Generated Scene Code"] --> SCENE_V

    subgraph "Per-Scene Code Review"
        SCENE_V["animator/scene-verify.md<br/>Code quality check"]
        SCENE_V -->|"pass"| COMP_V
        SCENE_V -->|"fail"| SCENE_FIX["Animator fixes issues"]
        SCENE_FIX --> SCENE_V
    end

    subgraph "Composition Review"
        COMP_V["animator/composition-verify.md<br/>Cross-scene consistency"]
        COMP_V -->|"pass"| RENDER
        COMP_V -->|"fail"| COMP_FIX["Animator fixes issues"]
        COMP_FIX --> COMP_V
    end

    subgraph "Visual Verification (Phase 2e)"
        RENDER["remotion still<br/>(render screenshots)"]
        RENDER --> VIS_V["animator/verify.md<br/>Screenshot review"]
        VIS_V -->|"pass"| FINAL["Final Output"]
        VIS_V -->|"fail + issues"| VIS_FIX["animator/fix-template.md<br/>Fix agent (edit-only)"]
        VIS_FIX --> RENDER
    end

    style FINAL fill:#dcfce7,stroke:#16a34a
```

| Verification Step | Prompt | Model | Tools | Max Retries |
|-------------------|--------|-------|-------|-------------|
| Scene code review | `animator/scene-verify.md` | Opus | `Read`, `Bash` | Per scene |
| Composition review | `animator/composition-verify.md` | Opus | `Read`, `Bash`, `Edit`, `Glob` | 1 |
| Visual screenshot review | `animator/verify.md` | Opus | `Read` (screenshots) | Per scene |
| Visual fix agent | `animator/fix-template.md` | Opus | `Edit` only | 2 per scene |

---

## TypeScript Pipeline (Alternative Path)

The TS pipeline in `generate-visuals.ts` and `visual-generator.ts` uses a different prompt assembly path:

```mermaid
graph TB
    subgraph "buildGenerateVisualsPrompt()"
        STYLE_G["get_theme(style_preset)<br/>from themes.json"]
        SCENE_P["generate-visuals/scene-patterns.md<br/>(AutoAE composition patterns)"]
        REFS["buildReferenceExamplesSection()"]
        COMMON["references/common-patterns.md"]
        SEARCH["references/search-race.md"]
        STACK["references/stack-overflow.md"]
        HASH["references/hash-collisions.md"]
        MOTION["motion/ad-utilities.md"]

        COMMON --> REFS
        SEARCH --> REFS
        STACK --> REFS
        HASH --> REFS
    end

    STYLE_G --> PROMPT["Final Visual Generation Prompt"]
    SCENE_P --> PROMPT
    REFS --> PROMPT
    MOTION -.->|"if apple/google style"| PROMPT

    PROMPT --> SDK["Claude Agent SDK Call"]
```

**`STYLE_GUIDELINES`** map (loaded via theme loader):
- `magazine` → `getTheme('magazine')` — light mode, editorial styling

**`buildReferenceExamplesSection(projectId)`** composes few-shot examples:
1. `references/common-patterns.md` — shared responsive sizing, spring configs, physics helpers
2. `references/search-race.md` — algorithm race visualization example
3. `references/stack-overflow.md` — memory pressure visualization example
4. `references/hash-collisions.md` — physics collision visualization example

Each reference file uses `{{projectId}}` template variable, substituted via `loadTemplate()`.

---

## Caption Pipeline

**Purpose:** Classify words as "power" (emphasized) or "filler" (de-emphasized) for subtitle styling.

| Component | Source |
|-----------|--------|
| System prompt | `transcribe/word-analysis.md` |
| Consumer | `processors/transcribe.ts` |
| Model | OpenAI-compatible API |
| Usage | One-shot classification, batched (200 words per call) |

---

## Conditional Section Injection Summary

| Section | Condition | Injected Into |
|---------|-----------|---------------|
| Theme design system | `get_theme(style_preset)` | Animator system prompt |
| YouTube clip rules | Any scene has `type=="youtube-clip"` | Animator system prompt |
| Display mode table | Always | Director user message |
| Theme style template | `get_theme(style_preset)` | Director user message |
| Overlay rules | `displayMode=="overlay"` | Per-scene subagent prompt |
| Fullscreen rules | `displayMode=="fullscreen"` | Per-scene subagent prompt |
| User assets | `user_assets.json` exists | Animator system prompt |
| Template catalog | Theme preset + catalog file exists | Director & Animator user messages |
| Ad motion utilities | Apple/Google style preset | TS visual prompt |

---

## Files That Stay as Code

These files contain runtime logic (not just static text) and remain as `.ts`/`.py`:

| File | Reason |
|------|--------|
| `generate-visuals.ts` | `buildGenerateVisualsPrompt()` has conditional logic, transcript formatting |
| Builder functions in `animator.py` | `get_theme_section()`, `build_animator_user_message()`, etc. |
| Builder functions in `director.py` | `build_director_user_message()`, `get_layout_context()`, etc. |
| `__init__.py` | Re-exports for backward compatibility |
| `_loader.py` | Re-exports from `loader.py` for consistent import path |

---

## Adding a New Prompt

1. Create a `.md` file in the appropriate subdirectory
2. Use `{{variable}}` syntax for dynamic placeholders
3. Load with `loadPrompt('subdir/name')` or `loadTemplate('subdir/name', { var: value })`
4. For Python prompt builders, import from `prompts._loader`
