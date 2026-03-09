# Template Registry + On-Demand Resolution Design

**Date:** 2026-03-09
**Status:** Approved
**Scope:** `packages/templates`, `packages/worker`

## Problem

The current template system copies all 60 studio-theme templates into the workspace for every visual generation job — twice (once in TypeScript `generate-visuals/index.ts:257-288`, once in Python `_copy_studio_templates()`). The full catalog is injected into 4 separate prompts (Director, Animator, Setup, per-scene). In practice, a job uses 1-3 templates.

This causes:
- Wasted I/O: 60 `copytree` operations per job when only 1-3 are needed
- Context pollution: ~4KB catalog injected into prompts that don't need it
- No structure: flat list of 60 templates with 20+ tags each — hard for the LLM to navigate
- Duplicate logic: template copy happens in both TypeScript and Python

## Design: v0/shadcn Registry Pattern

Modeled after how v0 handles shadcn components: metadata in prompt, source injected on-demand after selection, no bulk copy.

## Architecture

### 1. Build-Time Registry

A `build-registry` script in `packages/templates` reads all template `meta.json` + source files and produces:

```
packages/templates/
├── src/templates/{slug}/        # Source (unchanged)
├── registry.json                # Built: metadata-only index
└── r/
    ├── {slug}.json              # Built: metadata + inlined file contents
    ├── use-scale.json           # Built: shared dependency
    └── fonts.json               # Built: shared dependency
```

**`registry.json`** — metadata only, used for the catalog prompt:

```json
{
  "name": "viona-templates",
  "items": [
    {
      "name": "stat-counter",
      "type": "registry:component",
      "description": "Animated counting number with label",
      "categories": ["data-visualization"],
      "meta": { "stylePreset": "cleanMinimal", "aspectRatio": "1:1" }
    }
  ]
}
```

**`r/{slug}.json`** — full item with inlined source:

```json
{
  "name": "stat-counter",
  "type": "registry:component",
  "description": "Animated counting number with label",
  "categories": ["data-visualization"],
  "registryDependencies": ["use-scale", "fonts"],
  "files": [
    { "path": "index.tsx", "content": "...(full source)...", "type": "registry:component" },
    { "path": "constants.ts", "content": "...(full source)...", "type": "registry:lib" }
  ],
  "meta": { "stylePreset": "cleanMinimal", "aspectRatio": "1:1" }
}
```

Shared dependencies (`use-scale`, `fonts`) are also registry items so dependency resolution is uniform.

The build script runs at package build time (not per-job). Added to `packages/templates/package.json` as `"build:registry"`.

### 2. Template Categories

Templates grouped by purpose for LLM navigation:

| Category | Examples |
|----------|----------|
| `data-visualization` | stat-counter, bar-chart-race, stat-donut, stat-line-chart |
| `text-typography` | kinetic-caption, headline-storm, keyword-pop |
| `comparison` | versus-screen, comparison-split |
| `social-engagement` | subscribe-nudge, poll-battle, comment-highlight |
| `geographic` | globe-spin, road-trip, coverage-map |
| `intro-outro` | warm-intro, postcard-reveal, countdown-reveal |
| `timeline-process` | territory-timeline, multi-stop-journey |
| `media` | youtube-clip, satellite-flyover |

Categories are derived from existing `meta.json` tags. Each template gets one primary category added to its `meta.json`.

### 3. Director Prompt — Categorized Catalog

**Before:** 60-template flat list with all tags (~4KB), injected into 4 prompts.

**After:** Categorized metadata-only catalog (~2KB), injected into Director prompt only:

```markdown
## Available Templates by Category

### Data Visualization (12)
- `stat-counter`: Animated counting number with label
- `bar-chart-race`: Ranked horizontal bars that reorder over time
...

### Text & Typography (8)
- `kinetic-caption`: Motion-driven text reveal
...
```

Director prompt instruction:

```
When planning scenes, select templates from the catalog above where they fit.
In scenes.json, add a "templates" field listing slugs per scene:

{
  "scenes": [
    { "id": 1, "templates": ["stat-counter"], ... },
    { "id": 2, "templates": [], ... }
  ]
}

If no template fits a scene, use an empty array.
```

### 4. Resolution Step (Between Director → Animator)

New function in the generate-visuals processor replaces both the TypeScript bulk copy and Python `_copy_studio_templates()`:

```typescript
async function resolveSelectedTemplates(
  scenesJson: ScenesJson,
  registryDir: string,
  workspaceSrc: string
): Promise<ResolvedTemplates> {
  // 1. Collect unique slugs from all scenes
  const slugs = new Set(scenesJson.scenes.flatMap(s => s.templates ?? []));

  // 2. For each slug, read r/{slug}.json
  // 3. Resolve registryDependencies (use-scale, fonts)
  // 4. Write only those template files to workspace/src/.templates/{slug}/
  // 5. Write shared deps to workspace/src/
  // 6. Return resolved source content for Animator prompt injection
}
```

This runs once, in TypeScript only. The Python `_copy_studio_templates()` is deleted.

### 5. Animator Prompt — Selected Template Source

**Before:** Same catalog as Director + full catalog in Setup and per-scene prompts.

**After:** Only selected template source code, injected once into Animator prompt:

```markdown
## Selected Templates

The Director chose these templates. Source is at src/.templates/{slug}/.

### stat-counter
**Files:** index.tsx, constants.ts
**Import:** `import StatCounter from '../../.templates/stat-counter'`

\`\`\`tsx
// index.tsx
import React from 'react';
import { useScale } from '../../use-scale';
...(full source)
\`\`\`
```

The Animator can also read files from `src/.templates/` during generation if it needs to re-examine the code.

### 6. Prompt Injection Points

| Phase | Current | Proposed |
|-------|---------|----------|
| Director | Full catalog (60 templates, all tags) | Categorized catalog (metadata only) |
| Animator | Full catalog (duplicate) | Selected template source code |
| Setup agent | Full catalog (duplicate) | Nothing — reads from workspace if needed |
| Per-scene | Full catalog (duplicate) | Nothing — already in Animator context |

4 injection points → 2.

### 7. Fallback

- If Director outputs empty `"templates"` arrays: Animator creates custom visuals using the studio design system (as today).
- If resolution fails for a slug: log warning, skip that template, Animator creates custom code for that scene.
- No fallback to bulk copy. The design system prompts (studio-design-system.md, style-studio-dark/light.md) remain unchanged — they provide the design tokens the Animator needs for custom visuals.

## Changes Summary

| Component | Current | Proposed |
|-----------|---------|----------|
| **Build step** | None | `build-registry` script → `registry.json` + `r/{slug}.json` |
| **Director prompt** | 60-template flat list, all tags | Categorized metadata catalog (~2KB) |
| **Template selection** | None (copy all) | Director outputs `"templates"` per scene |
| **Template copy** | 60 dirs copied twice (TS + Python) | 1-3 dirs copied once (TS only) |
| **Animator prompt** | Same catalog as Director | Selected template source code |
| **Injection points** | 4 (Director, Animator, Setup, per-scene) | 2 (Director catalog, Animator source) |
| **Shared deps** | Copied alongside bulk copy | Resolved from registryDependencies |
| **Python `_copy_studio_templates()`** | Copies all 60 templates | Deleted |
| **`buildStudioTemplateCatalog()`** | Runtime scan of registry | Reads pre-built `registry.json` |

## Files Affected

### `packages/templates`
- **New:** `scripts/build-registry.ts` — build script
- **New:** `registry.json` — built output (metadata index)
- **New:** `r/{slug}.json` — built output (per-template with source)
- **Modified:** `package.json` — add `build:registry` script
- **Modified:** `src/templates/*/meta.json` — add `category` field
- **Modified:** `src/types.ts` — add `category` to TemplateMeta type

### `packages/worker`
- **Modified:** `src/prompts/studio-templates.ts` — read `registry.json` instead of runtime scan, generate categorized catalog
- **Modified:** `src/processors/generate-visuals/index.ts` — replace bulk copy (lines 257-288) with `resolveSelectedTemplates()`
- **New:** `src/processors/generate-visuals/template-resolver.ts` — resolution logic
- **Modified:** `src/agents/claude_visual_generator.py` — delete `_copy_studio_templates()`, remove 3 of 4 catalog injection points, inject selected template source into Animator
- **Modified:** `src/prompts/director/director.py` — add `"templates"` field instruction
- **Modified:** `src/processors/generate-visuals/types.ts` — add `templates` to scene type

## Non-Goals

- No MCP server (v0 doesn't use one either — pre-injection is simpler)
- No vector DB for template search (60 templates doesn't need semantic search)
- No template versioning (templates are internal, not distributed)
- No changes to the Remotion bundling/rendering pipeline
- No changes to the studio design system prompts (style-studio-dark.md, etc.)
