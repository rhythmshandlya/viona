# Template System Overhaul — Design Spec

**Date:** 2026-03-21
**Status:** Draft
**Scope:** Data model + AI template tools (Phase 1 foundation)

## Overview

Overhaul the template system to be a registry of pre-built, parameterized Remotion components that follow the Shadcn model: source code is copied into the workspace, owned by the consumer, and freely modifiable. The AI agent can browse templates, fork their source code, and modify the actual Remotion code — not just tweak props.

This phase builds the **foundation**: data model (themes, template types), AI tools (browse + fork), and cleanup of the deprecated blueprint catalog. Future phases will add editor drag-and-drop, remix UI, and publish-from-sandbox flows.

## Principles

- **Shadcn model**: Templates are copied, not installed. Source code is fetched from S3 on demand, never bundled as runtime dependencies.
- **Two levels of usage**: Parameter tweaking (Zod props) AND code forking (AI reads/modifies source).
- **Themes = creative direction**: Not just tags. Themes carry style guidance, color palettes, and font recommendations that the AI reads before working.
- **Dev-only authoring**: Templates are authored by developers in `packages/templates/`, built and uploaded via CLI scripts. No publish-from-sandbox in this phase.

## Data Model

### New: `themes` Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| slug | VARCHAR UNIQUE | URL-safe identifier (e.g., "magazine") |
| name | VARCHAR | Display name (e.g., "Magazine") |
| description | TEXT | Brief description of the theme |
| color_palette | JSONB | Structured color definitions (primary, secondary, accent, background, text) |
| font_recommendations | JSONB | Recommended font pairings (heading, body, accent) |
| style_guidance | TEXT | Free-form prose the AI reads for creative direction. E.g., "Magazine theme uses serif headlines, editorial grid layouts, warm earth tones, subtle parallax motion." |
| preview_url | VARCHAR | S3 key for theme preview image |
| is_published | BOOLEAN | Only published themes are browseable |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### New: `template_themes` Join Table

| Column | Type | Description |
|--------|------|-------------|
| theme_id | UUID FK → themes.id | ON DELETE CASCADE |
| template_id | UUID FK → templates.id | ON DELETE CASCADE |

Composite primary key on (theme_id, template_id). Many-to-many: a template can belong to multiple themes, a theme contains many templates. Generic templates have no rows in this table.

### Modified: `templates` Table

Add one column:

| Column | Type | Description |
|--------|------|-------------|
| type | VARCHAR(20) | Default 'scene'. **Scene** = full animation (watercolor-map, globe). Dropped onto timeline as a complete segment. **Element** = reusable piece (lower-third, title card). Composed into scenes or layered as overlays. Values: 'scene' or 'element'. |

Uses VARCHAR (not Postgres enum) for consistency with the existing schema — all other enum-like columns (`status`, `role`, `projectType`) use VARCHAR. This avoids requiring `ALTER TYPE` migrations when adding future template types.

All 3 existing templates (country-highlight, globe-spin, watercolor-map) get `type = 'scene'` via the migration default.

### No Changes

- `template_exports` table — unchanged
- S3 storage layout (`templates/{slug}/bundle.{hash}.js`, `templates/{slug}/source/*`) — unchanged

### Migration

```sql
-- 1. Add type column to templates (varchar for consistency with existing schema)
ALTER TABLE templates ADD COLUMN type VARCHAR(20) DEFAULT 'scene';

-- 2. Create themes table
CREATE TABLE themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  description TEXT,
  color_palette JSONB,
  font_recommendations JSONB,
  style_guidance TEXT,
  preview_url VARCHAR,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create join table
CREATE TABLE template_themes (
  theme_id UUID REFERENCES themes(id) ON DELETE CASCADE,
  template_id UUID REFERENCES templates(id) ON DELETE CASCADE,
  PRIMARY KEY (theme_id, template_id)
);
```

### Theme Seeding

For the AI tools to be useful, at least one theme must exist. The initial migration includes no seed data — themes are created via the upload pipeline or a seed script. A `scripts/seed-themes.ts` script will be added to `packages/templates/` that inserts initial themes from a `themes/` directory in the package (each theme is a JSON file with slug, name, description, colorPalette, fontRecommendations, styleGuidance). This runs as part of `templates:publish`.

## Template Package Changes

### meta.json Extension

Each template's `meta.json` gets two new fields (`type` and `themes`). The existing format is preserved:

```json
{
  "slug": "watercolor-map",
  "name": "Watercolor Map",
  "description": "Animated travel route between two locations on a watercolor-style map",
  "category": "geographic",
  "tags": ["travel", "map", "route", "watercolor"],
  "stylePreset": "elegantEditorial",
  "aspectRatio": "1:1",
  "sceneCount": 1,
  "estimatedDuration": "12s",
  "thumbnail": "thumbnail.png",
  "type": "scene",
  "themes": []
}
```

- `type`: `"scene"` or `"element"`
- `themes`: Array of theme slugs. Empty array for generic templates.

All 3 existing templates (country-highlight, globe-spin, watercolor-map) get `"type": "scene"` and `"themes": []`.

### upload-templates.ts Extension

The upload script reads `type` and `themes` from `meta.json` and:
1. Sets `type` column on the `templates` row
2. Looks up theme IDs by slug from the `themes` table
3. Populates `template_themes` join table (delete existing rows for this template, insert new ones)

### build-templates.ts

No changes. The bundling process stays the same — new fields are metadata only.

## API Route Extensions

### Modified: `GET /templates`

New query parameters:

| Param | Type | Description |
|-------|------|-------------|
| theme | string | Filter by theme slug (joins through template_themes) |
| type | string | Filter by "scene" or "element" |
| include_theme_context | boolean | When true and `theme` is set, includes theme metadata in response |

The existing list endpoint must also be extended to include `propsSchema` and `defaultProps` in the response. Currently the list query selects only display fields (slug, name, description, category, etc.) and omits these. Add them to the select so the `browse_templates` tool gets schema information without a per-template detail call.

Response shape extended:

```typescript
interface TemplateListResponse {
  templates: TemplateListItem[];  // existing fields, plus new: type, themes, propsSchema, defaultProps
  themeContext?: {                // only when include_theme_context=true
    slug: string;
    name: string;
    description: string;
    styleGuidance: string;
    colorPalette: Record<string, string>;
    fontRecommendations: Record<string, string>;
  };
  total: number;
  page: number;
  pageSize: number;
}
```

### New: `GET /templates/themes`

Lists all published themes with template counts.

```typescript
interface ThemeListResponse {
  themes: {
    slug: string;
    name: string;
    description: string;
    previewUrl: string | null;
    templateCount: number;
  }[];
}
```

### New: `GET /templates/themes/:slug`

Full theme detail with all templates belonging to this theme.

```typescript
interface ThemeDetailResponse {
  slug: string;
  name: string;
  description: string;
  colorPalette: Record<string, string>;
  fontRecommendations: Record<string, string>;
  styleGuidance: string;
  previewUrl: string | null;
  templates: TemplateListItem[];
}
```

## AI Template Tools

### New MCP Server: `templates`

Registered in `packages/sandbox/src/mcp-servers.ts` using the existing `createSdkMcpServer` + `wrapTool` pattern (same as manifest, scenes, render, etc.). The tools in `template-tools.ts` follow the same raw-JSON-schema pattern as `manifest-ops.ts` and `scene-tools.ts`, then get wrapped by `wrapTool` before registration. The `createMcpServers` return type is extended to include the new `templates` server.

### Tool: `browse_templates`

**Purpose:** Let the AI agent discover available templates, filtered by theme/type/category.

```typescript
{
  name: 'browse_templates',
  description: 'Browse the template registry. Returns metadata, prop schemas, and theme context.',
  input: {
    theme: z.string().optional(),       // filter by theme slug
    type: z.enum(['scene', 'element']).optional(),
    category: z.string().optional(),
    search: z.string().optional(),      // fuzzy search name/description/tags
  },
  output: {
    templates: Array<{
      slug: string;
      name: string;
      description: string;
      type: 'scene' | 'element';
      category: string;
      tags: string[];
      aspectRatio: string;
      durationFrames: number;
      fps: number;
      width: number;
      height: number;
      propsSchema: JSONSchema;          // so AI knows what's tweakable
      defaultProps: Record<string, unknown>;
      themes: string[];                 // theme slugs this template belongs to
    }>;
    themeContext?: {                     // included when theme filter is used
      name: string;
      description: string;
      styleGuidance: string;
      colorPalette: Record<string, string>;
      fontRecommendations: Record<string, string>;
    };
  }
}
```

**Implementation:** HTTP GET to the API's `/templates` endpoint. The sandbox has `API_CALLBACK_URL` env var which is the API base URL (e.g., `http://host.docker.internal:4000/api` for Docker, or equivalent for Railway). The tool calls `${API_CALLBACK_URL}/templates?theme=X&type=Y&include_theme_context=true` directly — no path manipulation needed. The `/templates` endpoint is public (no auth required), so no credentials are needed. `API_CALLBACK_URL` is read from `process.env` directly in `template-tools.ts` (same pattern as `asset-sync.ts` reads MINIO vars).

**Error handling:** If the API is unreachable, returns an error message telling the agent that the template registry is unavailable and to proceed without templates. If no templates match the filters, returns an empty array.

### Tool: `fork_template`

**Purpose:** Copy a template's source files into the sandbox workspace for the AI to read and modify.

```typescript
{
  name: 'fork_template',
  description: 'Fork a template into the workspace. Copies source files from S3 so you can read, modify, and use the code.',
  input: {
    slug: z.string(),                   // template to fork
    targetDir: z.string().optional(),   // default: src/components/templates/{slug}/
  },
  output: {
    files: Array<{
      path: string;                     // workspace-relative path
      description: string;             // brief purpose
    }>;
    entryPoint: string;                // main component file path
    propsSchema: JSONSchema;           // for reference
  }
}
```

**Implementation:**
1. Calls API `GET /templates/:slug` to get `sourceKey` and `propsSchema`. The existing detail endpoint already returns `sourceKey` (it spreads the full template DB row into the response).
2. Uses MinIO client (`listObjects` + `getObject`) to download all files under the `templates` bucket with prefix `{sourceKey}`. Note: `sourceKey` is already a full prefix path (e.g., `watercolor-map/source/`), so the MinIO call is `listObjects('templates', sourceKey)` — no additional nesting.
3. Writes files to `{targetDir}` in the sandbox workspace. Default is `src/components/templates/{slug}/`. This is intentionally at workspace root level (not inside `src/scenes/`) because forked templates are shared components that may be imported by multiple scenes.
4. Rewrites `../../` imports to be workspace-relative. Template source files use imports like `../../fonts` or `../../lib/geo-utils` to reference shared code in the template package. These get rewritten to point to the local copies (e.g., `./fonts`, `./lib/geo-utils`). Same flattening pattern used by `build-templates.ts`'s `_resolved_source` step — shared deps are copied alongside the template.
5. Returns file listing with the entry point identified (the file containing the default export React component, typically `index.tsx`).

**MinIO access:** Sandbox already has `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` env vars. Uses the same MinIO client pattern as `asset-sync.ts`.

**Error handling:**
- Slug not found: returns error message "Template '{slug}' not found in registry."
- S3 unreachable: returns error with details, agent should fall back to building from scratch.
- Target directory already has files (re-fork): overwrites existing files. Agent should be aware the directory may contain previously modified code.

### Agent Tool Access

| Agent | browse_templates | fork_template | Rationale |
|-------|:---:|:---:|-----------|
| Orchestrator | ✓ | ✗ | Can overview available templates, read-only |
| Planner | ✓ | ✗ | Browses to inform scene planning. Notes template slugs in SCENE_PLAN.md |
| Setup Agent | ✓ | ✓ | Forks templates into workspace based on plan |
| Animator | ✓ | ✓ | Can fork element templates mid-animation if needed |
| Trim Editor | ✗ | ✗ | No template work |
| Layout Editor | ✗ | ✗ | No template work |
| Final Editor | ✗ | ✗ | No template work |

Tool access is controlled via the existing `allowedTools` arrays per agent in `orchestrator.ts`. Create a `TEMPLATE_BROWSE_TOOL_NAMES` constant (containing `browse_templates`) and a `TEMPLATE_TOOL_NAMES` constant (containing both `browse_templates` and `fork_template`), following the existing pattern of `MANIFEST_READ_TOOL_NAMES`, `RENDER_TOOL_NAMES`, etc. Add `TEMPLATE_BROWSE_TOOL_NAMES` to orchestrator/planner, `TEMPLATE_TOOL_NAMES` to setup/animator.

### SCENE_PLAN.md Convention

The planner notes template usage in scene plans:

```markdown
## Scene 3: Travel Route (frames 210-450)
- template: watercolor-map
- fork-reason: need animated route, modify for 3 stops instead of 2
- props: { route: [...], style: "vintage" }
- modifications: add compass rose, change color palette to earth tones

## Scene 5: Stats Overlay (frames 600-720)
- template: none (custom build)
- animated counter with bar chart

## Element: Lower Third (used in scenes 1, 3, 5)
- template: lower-third-slide
- fork-reason: exact match, just change fonts + colors
```

The setup agent reads these annotations and forks accordingly.

## Prompt Changes

### Remove

- `buildTemplateCatalog()` in `packages/worker/src/prompts/studio-templates.ts` — no longer called
- Static template catalog injection from any prompt assembly code
- `STUDIO_TEMPLATES.md` in `packages/worker/workspace/src/` — deleted

### Add to Planner Prompt

```
You have access to a template registry via the `browse_templates` tool. Before planning scenes:
1. Browse available templates to see what's available
2. If a theme is specified, browse with the theme filter to get themed templates + style guidance
3. Prefer using existing templates over building from scratch when a template is close to what's needed
4. Note template slugs and fork-reasons in SCENE_PLAN.md for the setup agent
```

### Add to Setup Agent Prompt

```
When the scene plan references a template:
1. Use `fork_template` to copy its source into the workspace
2. The forked code is yours to modify — adapt colors, content, animations to match the project
3. Forked templates land in src/components/templates/{slug}/ by default
4. Import and use the forked component in your scene files
```

### Add to Animator Prompt

```
If you need a reusable element (lower-third, title card, progress bar, etc.):
1. Check `browse_templates` for existing element templates before building from scratch
2. Fork and modify when an existing template is close to what you need
3. You can fork element templates into your scene directory if they're only used once
```

### Theme Context Injection

When a theme is specified (via user brief, widget selection, or orchestrator decision), the orchestrator includes theme metadata in the system prompt context injected to all sub-agents:

```
THEME: Magazine
STYLE GUIDANCE: Magazine theme uses serif headlines, editorial grid layouts, warm earth tones, subtle parallax motion.
COLOR PALETTE: { primary: "#2D1B0E", secondary: "#8B6914", accent: "#C4A265", background: "#F5F0E8", text: "#1A1A1A" }
FONTS: { heading: "Playfair Display", body: "Source Serif Pro", accent: "Cormorant Garamond" }
```

## Cleanup

### Files to Delete

| File | Reason |
|------|--------|
| `packages/worker/workspace/src/STUDIO_TEMPLATES.md` | Deprecated blueprint catalog (70+ descriptions). Replaced by actual template registry. |
| `packages/worker/src/prompts/studio-templates.ts` | `buildTemplateCatalog()` function that reads registry.json and injects blueprint descriptions into prompts. Replaced by `browse_templates` MCP tool. |

### References to Update

All references to the deleted files must be cleaned up:

| File | Reference | Action |
|------|-----------|--------|
| `packages/worker/src/prompts/index.ts:3` | `export * from './studio-templates.js'` | Remove this re-export line |
| `packages/worker/src/agents/visual_generator/_director.py:71` | Reads `STUDIO_TEMPLATES.md` from disk | Remove catalog loading block (lines ~69-77). This is in the deprecated worker pipeline. |
| `packages/worker/src/prompts/director/director.py:459` | References STUDIO_TEMPLATES.md catalog | Remove reference to catalog in prompt text |
| `packages/worker/src/prompts/themes/studio/director-style.md:41` | "If a STUDIO_TEMPLATES.md file exists..." | Remove this instruction |
| `packages/worker/README.md:92` | Lists `studio-templates.ts` in directory tree | Update the directory tree listing |
| `packages/worker/src/prompts/README.md:17,342` | Documents `studio-templates.ts` | Remove from docs |

Note: The worker pipeline (`packages/worker/src/agents/visual_generator/`) is deprecated (replaced by the sandbox), so these references are dead code. Cleaning them up prevents confusion.

## What This Phase Does NOT Include

- **Editor drag-and-drop**: The `templateId`/`templateProps` fields on `VisualItemData` exist but no UI for dropping templates onto the timeline yet.
- **Remix page UI**: No "Remix" button on the template gallery page. That's a future phase.
- **Publish from sandbox**: AI-remixed templates stay in the project. No mechanism to save back to the registry.
- **Manifest provenance tracking**: No `sourceTemplateId` on manifest items. Can be added when editor integration happens.
- **Template versioning**: No version tracking or "update to latest" flows.

## File Locations

### New Files

| File | Purpose |
|------|---------|
| `packages/sandbox/src/tools/template-tools.ts` | `browse_templates` and `fork_template` tool implementations |
| `packages/api/src/routes/themes.ts` | Theme API routes (list, detail) |
| `packages/api/drizzle/XXXX_add_themes.sql` | DB migration |
| `packages/templates/scripts/seed-themes.ts` | Theme seeding script (inserts themes from `themes/*.json`) |
| `packages/templates/themes/` | Theme definition JSON files for seeding |

### Modified Files

| File | Change |
|------|--------|
| `packages/api/src/db/schema.ts` | Add `themes`, `templateThemes` tables + `type` varchar column on templates |
| `packages/api/src/routes/templates.ts` | Add `theme`, `type`, `include_theme_context` query params + include `propsSchema`/`defaultProps` in list response |
| `packages/sandbox/src/mcp-servers.ts` | Register `templates` MCP server via `createSdkMcpServer` + `wrapTool` |
| `packages/sandbox/src/orchestrator.ts` | Add template tool names to `allowedTools` arrays for planner/setup/animator |
| `packages/templates/scripts/upload-templates.ts` | Read `type`/`themes` from meta.json, populate join table |
| Planner/Setup/Animator prompt files | Add template browsing/forking instructions |
| Template `meta.json` files (3) | Add `"type": "scene"` and `"themes": []` |
| `packages/worker/src/prompts/index.ts` | Remove `studio-templates` re-export |
| `packages/worker/src/agents/visual_generator/_director.py` | Remove STUDIO_TEMPLATES.md loading |
| `packages/worker/src/prompts/director/director.py` | Remove catalog reference |
| `packages/worker/src/prompts/themes/studio/director-style.md` | Remove STUDIO_TEMPLATES.md instruction |
| `packages/worker/README.md` | Update directory tree |
| `packages/worker/src/prompts/README.md` | Remove studio-templates docs |

### Deleted Files

| File | Reason |
|------|--------|
| `packages/worker/workspace/src/STUDIO_TEMPLATES.md` | Deprecated blueprint catalog |
| `packages/worker/src/prompts/studio-templates.ts` | Deprecated catalog builder |
