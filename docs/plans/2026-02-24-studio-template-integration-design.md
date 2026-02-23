# Studio Template Integration Design

**Date:** 2026-02-24
**Status:** Approved
**Problem:** The 60 studio templates in `packages/templates/` are never used during visual generation despite being referenced in prompts.

## Context

Viona has 60 pre-built studio-theme templates (`packages/templates/src/templates/`). Each is a self-contained Remotion composition with `index.tsx`, `schema.ts`, `constants.ts`, `components/`, and `meta.json`. They cover stat counters, VS screens, timelines, charts, quote cards, and more.

Currently, they are never used because:
1. Template source files are not in the Remotion workspace (`workspace/src/.templates/` doesn't exist)
2. The Animator agent doesn't receive `style_preset`, so it never knows it's a "studio" run
3. No mechanism to inject the catalog into the Animator's context
4. Templates are designed as React components with props — mismatches the "copy and customize" workflow

## Design Philosophy

**Templates are a style reference library, not a component library.**

They serve as concrete examples of the studio theme — showing the agent the color palette, card styles, DotGrid pattern, spring configs, typography, and animation patterns. The agent:
- Browses templates to **absorb the theme aesthetic**
- Uses a template as a starting point when it fits naturally
- Creates fully custom scenes that still feel consistent with the theme
- Is **never forced** to use templates — they inform, not constrain

This follows the **shadcn model**: templates are source code you own. Copy, customize, combine, or ignore.

## Architecture

### Template Copy Pipeline

```
style_preset == "studio"?
    YES → Read packages/templates/src/templates/*/meta.json
        → Filter: keep templates where tags includes "studio-theme"
        → Copy those template dirs to workspace/src/.templates/{slug}/
        → STUDIO_TEMPLATES.md already exists in workspace/src/
    NO  → Skip template copy entirely (fully custom workflow)
```

**When:** At the start of `generate()`, before any agent runs.

**What gets copied per template:**
```
.templates/{slug}/
├── index.tsx       # Main component (the primary reference)
├── constants.ts    # Colors, timing tokens
├── schema.ts       # Zod props schema (shows what's configurable)
├── meta.json       # Metadata, tags, description
├── components/     # Sub-components (CardShell, TrendBadge, etc.)
└── lib/            # Utilities (formatCompact, etc.)
```

### Enriched Template Catalog

Each template gets 15-25 descriptive tags covering synonyms, use cases, and visual patterns. This makes templates easily discoverable by the LLM without needing a separate search system.

```markdown
### stat-counter (`stat-counter`)
Big animated number counting up with trend badge
Tags: stats, counter, number, growth, metrics, dashboard, revenue, MRR, ARR,
      users, subscribers, downloads, milestone, KPI, headline-number, big-reveal,
      counting-animation, single-metric, wow-moment, studio-theme
```

### Director Changes

The Director already receives `STUDIO_TEMPLATES.md` when `style_preset == "studio"` (line 3929 in visual generator). Add:

- New prompt instruction: suggest template slugs per scene in a `"suggestedTemplates"` field
- These are **advisory only** — the Animator can use different templates or go custom
- Director reads template source via Read tool to validate feasibility before suggesting

**scenes.json addition:**
```json
{
  "id": 3,
  "name": "Revenue Growth",
  "suggestedTemplates": ["stat-counter", "bar-chart-race"],
  "visual": "...",
  ...
}
```

### Animator Changes

**3 changes:**

1. **Pass `style_preset`** to `_run_animator()` and `build_animator_user_message()`. When "studio", include template usage instructions in the user message.

2. **Inject catalog** — include `STUDIO_TEMPLATES.md` content in the Animator's user message (~80 lines). The agent sees the full menu without needing to discover it.

3. **Update `<studio_templates>` prompt section** — clarify the shadcn model:
   - Templates are style references and optional starting points
   - Agent reads source to absorb the theme, then creates scenes that feel consistent
   - Use a template when it naturally fits, go custom when it doesn't
   - Never force a template that requires heavy modification to fit

**Agent workflow when using a template:**
```
1. Read scenes.json → see suggestedTemplates for the scene
2. Read .templates/{slug}/index.tsx → understand the component
3. Read .templates/{slug}/schema.ts → see props/data model
4. Read relevant .templates/{slug}/components/*.tsx
5. Write Scene{N}.tsx, adapting the template code:
   - Replace data with scene-specific content
   - Adjust frame ranges to scene boundaries
   - Map sync points to animation triggers
   - Customize colors to project palette
```

## Files to Modify

| File | Change |
|------|--------|
| `packages/worker/src/agents/claude_visual_generator.py` | Copy .templates/ at generation start, pass style_preset to animator, inject catalog |
| `packages/worker/src/agents/prompts/director.py` | Add suggestedTemplates instruction for studio preset |
| `packages/worker/src/agents/prompts/animator.py` | Update studio_templates section, add template workflow instructions (both copies) |
| `packages/templates/src/templates/*/meta.json` | Enrich tags (15-25 per template) |
| `packages/worker/workspace/src/STUDIO_TEMPLATES.md` | Regenerate with enriched descriptions and tags |

## Verification

1. Run a studio-preset generation and verify:
   - `.templates/` directory exists in workspace with all 60 templates
   - Director suggests templates in scenes.json
   - Animator reads and uses at least one template as starting point
   - Scenes that don't use templates still follow studio design system
2. Run a non-studio generation and verify templates are NOT copied
3. Check that fully custom scenes still look consistent with template-based scenes
