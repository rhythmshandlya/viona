# Template System Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundation for a Shadcn-style template system with theme support and AI template tools (browse + fork).

**Architecture:** New `themes` and `template_themes` DB tables + `type` column on `templates`. Two new MCP tools (`browse_templates`, `fork_template`) in a `templates` MCP server registered in the sandbox. Cleanup of deprecated blueprint catalog (STUDIO_TEMPLATES.md). Theme-first: themes carry creative direction (style guidance, colors, fonts) that the AI reads.

**Tech Stack:** Drizzle ORM, Fastify, MinIO S3, Claude Agent SDK MCP servers, Zod

**Spec:** `docs/superpowers/specs/2026-03-21-template-system-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `packages/api/drizzle/0025_add_themes.sql` | DB migration: themes table, template_themes join table, type column |
| `packages/sandbox/src/tools/template-tools.ts` | `browse_templates` and `fork_template` MCP tool implementations |
| `packages/templates/scripts/seed-themes.ts` | Theme seeding script |
| `packages/templates/themes/magazine.json` | Initial theme definition (example) |

### Modified Files

| File | Change |
|------|--------|
| `packages/api/src/db/schema.ts` | Add `themes`, `templateThemes` tables + `type` column |
| `packages/api/src/routes/templates.ts` | Add theme sub-routes (before /:slug), `theme`/`type`/`includeThemeContext` query params, `propsSchema`/`defaultProps` in list |
| `packages/sandbox/src/mcp-servers.ts` | Register `templates` MCP server |
| `packages/sandbox/src/orchestrator.ts` | Add `TEMPLATE_*` constants, wire to agents |
| `packages/templates/scripts/upload-templates.ts` | Read `type`/`themes`, populate join table |
| `packages/templates/src/templates/*/meta.json` (3 files) | Add `type` and `themes` fields |
| `packages/sandbox/src/prompts/planner/system.md` | Add template browsing instructions |
| `packages/sandbox/src/prompts/setup-agent/system.md` | Add template forking instructions |
| `packages/sandbox/src/prompts/animator/system.md` | Add element template instructions |

### Deleted Files

| File | Reason |
|------|--------|
| `packages/worker/workspace/src/STUDIO_TEMPLATES.md` | Deprecated blueprint catalog |
| `packages/worker/src/prompts/studio-templates.ts` | Deprecated catalog builder |

---

### Task 1: DB Migration — Create themes table, join table, and type column

**Files:**
- Create: `packages/api/drizzle/0025_add_themes.sql`

- [ ] **Step 1: Check latest migration number**

Run: `ls packages/api/drizzle/*.sql | tail -5`

Verify the latest migration number so ours is the next one. Adjust the filename if needed (should be one higher than the last existing migration).

- [ ] **Step 2: Write the migration SQL**

Create `packages/api/drizzle/0025_add_themes.sql`:

```sql
-- Add template type column (varchar for consistency with existing schema)
ALTER TABLE templates ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'scene';

-- Create themes table
CREATE TABLE IF NOT EXISTS themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color_palette JSONB,
  font_recommendations JSONB,
  style_guidance TEXT,
  preview_url VARCHAR(1024),
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_themes_slug ON themes(slug);
CREATE INDEX IF NOT EXISTS idx_themes_is_published ON themes(is_published);

-- Create template_themes join table (many-to-many)
CREATE TABLE IF NOT EXISTS template_themes (
  theme_id UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  PRIMARY KEY (theme_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_template_themes_template ON template_themes(template_id);
```

- [ ] **Step 3: Run the migration**

Run: `cd packages/api && npx drizzle-kit push` (or the project's migration runner — check `package.json` scripts for the migration command).

Expected: Migration applies cleanly. Verify with: `psql -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'themes'"`

- [ ] **Step 4: Commit**

```bash
git add packages/api/drizzle/0025_add_themes.sql
git commit -m "feat(db): add themes table, template_themes join table, and type column on templates"
```

---

### Task 2: Update Drizzle Schema — Add themes and templateThemes tables

**Files:**
- Modify: `packages/api/src/db/schema.ts` (after line 212, and add type column to templates)

- [ ] **Step 1: Add type column to templates table**

In `packages/api/src/db/schema.ts`, add the `type` column to the `templates` table definition (after `tags` at line 197):

```typescript
type: varchar('type', { length: 20 }).default('scene'),
```

- [ ] **Step 2: Add `primaryKey` to imports**

At the top of `schema.ts`, find the import from `drizzle-orm/pg-core` and add `primaryKey` to it:

```typescript
import { pgTable, uuid, varchar, integer, boolean, timestamp, jsonb, text, primaryKey } from 'drizzle-orm/pg-core';
```

- [ ] **Step 3: Add themes table definition**

After the `templateExports` table (after line 224), add:

```typescript
// Themes — creative direction collections for templates
export const themes = pgTable('themes', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  colorPalette: jsonb('color_palette').$type<Record<string, string>>(),
  fontRecommendations: jsonb('font_recommendations').$type<Record<string, string>>(),
  styleGuidance: text('style_guidance'),
  previewUrl: varchar('preview_url', { length: 1024 }),
  isPublished: boolean('is_published').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Template-Theme join table (many-to-many)
export const templateThemes = pgTable('template_themes', {
  themeId: uuid('theme_id').notNull().references(() => themes.id, { onDelete: 'cascade' }),
  templateId: uuid('template_id').notNull().references(() => templates.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.themeId, table.templateId] }),
}));
```

- [ ] **Step 4: Add type exports**

Add after the existing template type exports (around line 261):

```typescript
export type Theme = typeof themes.$inferSelect;
export type NewTheme = typeof themes.$inferInsert;
```

- [ ] **Step 5: Verify the schema compiles**

Run: `cd packages/api && npx tsc --noEmit`

Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/db/schema.ts
git commit -m "feat(db): add themes and templateThemes Drizzle schema definitions"
```

---

### Task 3: Theme API Routes (inside templates.ts)

**IMPORTANT:** Theme routes MUST be defined inside `templates.ts`, NOT in a separate file. Fastify matches `GET /templates/themes` against the existing `GET /templates/:slug` route — if defined in a separate plugin, "themes" would be treated as a `:slug` value. The existing `/templates/categories` route already demonstrates this pattern: it's defined BEFORE `/:slug` within the same plugin.

**Files:**
- Modify: `packages/api/src/routes/templates.ts`

- [ ] **Step 1: Add theme-related imports**

In `packages/api/src/routes/templates.ts`, add to existing imports:

```typescript
import { themes, templateThemes } from '../db/index.js';
import { and, sql } from 'drizzle-orm';
```

(Add `and` and `sql` to existing drizzle-orm imports if not already present.)

- [ ] **Step 2: Add theme list route BEFORE the /:slug route**

Inside the `templateRoutes` function, add these routes BEFORE the existing `GET /templates/:slug` route (same pattern as `/templates/categories`):

```typescript
  // GET /templates/themes — list all published themes with template counts
  // MUST be defined BEFORE /:slug to avoid param collision
  fastify.get('/templates/themes', async (request, reply) => {
    const rows = await db
      .select({
        id: themes.id,
        slug: themes.slug,
        name: themes.name,
        description: themes.description,
        previewUrl: themes.previewUrl,
        templateCount: sql<number>`(
          SELECT COUNT(*) FROM template_themes
          WHERE template_themes.theme_id = ${themes.id}
        )`.as('template_count'),
      })
      .from(themes)
      .where(eq(themes.isPublished, true))
      .orderBy(themes.name);

    const items = await Promise.all(
      rows.map(async (row) => ({
        slug: row.slug,
        name: row.name,
        description: row.description,
        previewUrl: row.previewUrl
          ? await getPresignedDownloadUrl('templates', row.previewUrl, 3600)
          : null,
        templateCount: Number(row.templateCount),
      })),
    );

    return { themes: items };
  });

  // GET /templates/themes/:slug — full theme detail with its templates
  fastify.get('/templates/themes/:slug', async (request, reply) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);

    const theme = await db.query.themes.findFirst({
      where: eq(themes.slug, slug),
    });

    if (!theme) {
      return reply.code(404).send({ error: 'Theme not found' });
    }

    const themeTemplates = await db
      .select({
        id: templates.id,
        slug: templates.slug,
        name: templates.name,
        description: templates.description,
        type: templates.type,
        category: templates.category,
        tags: templates.tags,
        aspectRatio: templates.aspectRatio,
        durationFrames: templates.durationFrames,
        fps: templates.fps,
        width: templates.width,
        height: templates.height,
        propsSchema: templates.propsSchema,
        defaultProps: templates.defaultProps,
        screenshotUrl: templates.screenshotUrl,
      })
      .from(templates)
      .innerJoin(templateThemes, eq(templates.id, templateThemes.templateId))
      .where(and(
        eq(templateThemes.themeId, theme.id),
        eq(templates.isPublished, true),
      ));

    return {
      slug: theme.slug,
      name: theme.name,
      description: theme.description,
      colorPalette: theme.colorPalette,
      fontRecommendations: theme.fontRecommendations,
      styleGuidance: theme.styleGuidance,
      previewUrl: theme.previewUrl,
      templates: themeTemplates,
    };
  });
```

- [ ] **Step 3: Verify it compiles**

Run: `cd packages/api && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/routes/templates.ts
git commit -m "feat(api): add theme list and detail routes inside templates plugin"
```

---

### Task 4: Extend Templates API — Add theme/type filters and propsSchema

**Files:**
- Modify: `packages/api/src/routes/templates.ts`

- [ ] **Step 1: Extend the query schema**

In `packages/api/src/routes/templates.ts`, update `listQuerySchema` (around line 11) to add the new params:

```typescript
const listQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  aspectRatio: z.string().optional(),
  tags: z.string().optional(),
  theme: z.string().optional(),                    // NEW
  type: z.enum(['scene', 'element']).optional(),   // NEW
  includeThemeContext: z.coerce.boolean().optional(), // NEW
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
```

- [ ] **Step 2: Add theme/type filtering to the query**

In the GET `/templates` handler, add filtering logic. After the existing `where` clause construction, add:

```typescript
// Add type filter
if (query.type) {
  conditions.push(eq(templates.type, query.type));
}

// Add theme filter (join through template_themes)
if (query.theme) {
  const themeRow = await db.query.themes.findFirst({
    where: eq(themes.slug, query.theme),
  });
  if (themeRow) {
    // Get template IDs for this theme
    const themeTemplateIds = await db
      .select({ templateId: templateThemes.templateId })
      .from(templateThemes)
      .where(eq(templateThemes.themeId, themeRow.id));
    const ids = themeTemplateIds.map(r => r.templateId);
    if (ids.length > 0) {
      conditions.push(inArray(templates.id, ids));
    } else {
      // No templates in this theme — return empty
      return { items: [], pagination: { page: query.page, limit: query.limit, total: 0, totalPages: 0 } };
    }
  }
}
```

Import `inArray` from `drizzle-orm` and import `themes`, `templateThemes` from the schema.

- [ ] **Step 3: Add propsSchema and defaultProps to list response**

Update the `select` call to include `propsSchema` and `defaultProps`:

```typescript
propsSchema: templates.propsSchema,
defaultProps: templates.defaultProps,
type: templates.type,
```

Also add theme slugs to each template in the response. After fetching templates, batch-fetch their theme associations:

```typescript
// Fetch theme slugs for all returned templates
const templateIds = items.map(t => t.id);
const themeAssociations = templateIds.length > 0
  ? await db
      .select({ templateId: templateThemes.templateId, slug: themes.slug })
      .from(templateThemes)
      .innerJoin(themes, eq(templateThemes.themeId, themes.id))
      .where(inArray(templateThemes.templateId, templateIds))
  : [];

const themesByTemplate = new Map<string, string[]>();
for (const row of themeAssociations) {
  const arr = themesByTemplate.get(row.templateId) || [];
  arr.push(row.slug);
  themesByTemplate.set(row.templateId, arr);
}

// Add themes to each item
const itemsWithThemes = items.map(item => ({
  ...item,
  themes: themesByTemplate.get(item.id) || [],
}));
```

- [ ] **Step 4: Add themeContext to response**

If `includeThemeContext` is true and `theme` is set, include the theme metadata in the response:

```typescript
let themeContext = undefined;
if (query.includeThemeContext && query.theme) {
  const themeRow = await db.query.themes.findFirst({
    where: eq(themes.slug, query.theme),
  });
  if (themeRow) {
    themeContext = {
      slug: themeRow.slug,
      name: themeRow.name,
      description: themeRow.description,
      styleGuidance: themeRow.styleGuidance,
      colorPalette: themeRow.colorPalette,
      fontRecommendations: themeRow.fontRecommendations,
    };
  }
}

return {
  items: itemsWithThemes,
  themeContext,
  pagination: { ... },
};
```

- [ ] **Step 5: Verify it compiles**

Run: `cd packages/api && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/templates.ts
git commit -m "feat(api): add theme/type filters and propsSchema to templates list endpoint"
```

---

### Task 5: Update Template meta.json Files

**Files:**
- Modify: `packages/templates/src/templates/country-highlight/meta.json`
- Modify: `packages/templates/src/templates/globe-spin/meta.json`
- Modify: `packages/templates/src/templates/watercolor-map/meta.json`

- [ ] **Step 1: Add type and themes to all 3 meta.json files**

Add these two fields to each file (after the existing `thumbnail` field):

```json
"type": "scene",
"themes": []
```

All 3 are scene-type templates with no theme association (generic).

- [ ] **Step 2: Verify JSON is valid**

Run: `for f in packages/templates/src/templates/*/meta.json; do echo "$f:"; node -e "JSON.parse(require('fs').readFileSync('$f','utf8')); console.log('OK')"; done`

- [ ] **Step 3: Commit**

```bash
git add packages/templates/src/templates/*/meta.json
git commit -m "feat(templates): add type and themes fields to template meta.json files"
```

---

### Task 6: Extend Upload Script — Handle type and themes

**Files:**
- Modify: `packages/templates/scripts/upload-templates.ts`

- [ ] **Step 1: Read type and themes from manifest entry meta**

In the `upsertTemplate` function, the `meta` field from `ManifestEntry` already contains all fields from `meta.json`. Add `type` to the SQL INSERT and UPDATE:

Add `type` to the INSERT column list and values:

```sql
INSERT INTO templates (
  slug, name, description, category, tags, aspect_ratio,
  duration_frames, fps, width, height, props_schema, default_props,
  screenshot_url, bundle_key, source_key, type, version, is_published
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 1, true)
ON CONFLICT (slug) DO UPDATE SET
  ...
  type = EXCLUDED.type,
  ...
```

Add `entry.meta.type || 'scene'` to the values array.

- [ ] **Step 2: Add theme association logic**

After the upsert, add theme association. Read `entry.meta.themes` (array of slug strings) and populate the join table:

```typescript
// Handle theme associations
const themeSlugs: string[] = (entry.meta as any).themes || [];
if (themeSlugs.length > 0) {
  // Get template ID
  const templateRow = await dbClient.query(
    'SELECT id FROM templates WHERE slug = $1',
    [entry.slug],
  );
  const templateId = templateRow.rows[0]?.id;
  if (templateId) {
    // Clear existing associations
    await dbClient.query(
      'DELETE FROM template_themes WHERE template_id = $1',
      [templateId],
    );
    // Insert new associations
    for (const themeSlug of themeSlugs) {
      const themeRow = await dbClient.query(
        'SELECT id FROM themes WHERE slug = $1',
        [themeSlug],
      );
      if (themeRow.rows[0]) {
        await dbClient.query(
          'INSERT INTO template_themes (theme_id, template_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [themeRow.rows[0].id, templateId],
        );
      } else {
        console.warn(`Warning: Theme "${themeSlug}" not found in DB, skipping association for template "${entry.slug}"`);
      }
    }
  }
} else {
  // Clear any existing associations if themes is now empty
  const templateRow = await dbClient.query(
    'SELECT id FROM templates WHERE slug = $1',
    [entry.slug],
  );
  if (templateRow.rows[0]) {
    await dbClient.query(
      'DELETE FROM template_themes WHERE template_id = $1',
      [templateRow.rows[0].id],
    );
  }
}
```

- [ ] **Step 3: Update ManifestEntry interface**

The `meta` field should reflect that it now contains `type` and `themes`. The manifest is built from `meta.json`, so the build script already copies these fields. No build script changes needed — just make sure the `meta` field in the manifest entry carries them through.

- [ ] **Step 4: Verify it compiles**

Run: `cd packages/templates && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add packages/templates/scripts/upload-templates.ts
git commit -m "feat(templates): extend upload script to handle type and theme associations"
```

---

### Task 7: Theme Seeding Script

**Files:**
- Create: `packages/templates/themes/magazine.json`
- Create: `packages/templates/scripts/seed-themes.ts`

- [ ] **Step 1: Create initial theme JSON file**

Create `packages/templates/themes/magazine.json`:

```json
{
  "slug": "magazine",
  "name": "Magazine",
  "description": "Editorial magazine style with serif typography, warm earth tones, and cinematic parallax motion",
  "colorPalette": {
    "primary": "#2D1B0E",
    "secondary": "#8B6914",
    "accent": "#C4A265",
    "background": "#F5F0E8",
    "text": "#1A1A1A"
  },
  "fontRecommendations": {
    "heading": "Playfair Display",
    "body": "Source Serif Pro",
    "accent": "Cormorant Garamond"
  },
  "styleGuidance": "Magazine theme uses serif headlines with editorial grid layouts. Warm earth tones dominate with gold accents. Motion should be subtle and cinematic — parallax scrolling, gentle zoom, smooth reveals. Text should feel typeset, not animated. Prefer clean negative space over busy compositions. Photography-forward with minimal overlay text."
}
```

- [ ] **Step 2: Create seed script**

Create `packages/templates/scripts/seed-themes.ts`:

```typescript
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import pg from 'pg';

const THEMES_DIR = join(import.meta.dirname, '..', 'themes');

interface ThemeDefinition {
  slug: string;
  name: string;
  description: string;
  colorPalette: Record<string, string>;
  fontRecommendations: Record<string, string>;
  styleGuidance: string;
}

async function seedThemes() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL required');

  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();

  const files = readdirSync(THEMES_DIR).filter(f => f.endsWith('.json'));
  console.log(`Found ${files.length} theme definitions`);

  for (const file of files) {
    const theme: ThemeDefinition = JSON.parse(
      readFileSync(join(THEMES_DIR, file), 'utf-8'),
    );

    const sql = `
      INSERT INTO themes (slug, name, description, color_palette, font_recommendations, style_guidance, is_published)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        color_palette = EXCLUDED.color_palette,
        font_recommendations = EXCLUDED.font_recommendations,
        style_guidance = EXCLUDED.style_guidance,
        updated_at = NOW()
    `;

    await client.query(sql, [
      theme.slug,
      theme.name,
      theme.description,
      JSON.stringify(theme.colorPalette),
      JSON.stringify(theme.fontRecommendations),
      theme.styleGuidance,
    ]);

    console.log(`Upserted theme: ${theme.slug}`);
  }

  await client.end();
  console.log('Done seeding themes');
}

seedThemes().catch(err => {
  console.error('Failed to seed themes:', err);
  process.exit(1);
});
```

- [ ] **Step 3: Add seed script to package.json**

In `packages/templates/package.json`, add to scripts:

```json
"themes:seed": "tsx scripts/seed-themes.ts"
```

- [ ] **Step 4: Commit**

```bash
git add packages/templates/themes/ packages/templates/scripts/seed-themes.ts packages/templates/package.json
git commit -m "feat(templates): add theme seeding script with initial magazine theme"
```

---

### Task 8: AI Template Tools — browse_templates and fork_template

**Files:**
- Create: `packages/sandbox/src/tools/template-tools.ts`

- [ ] **Step 1: Create the template tools file**

Create `packages/sandbox/src/tools/template-tools.ts`. Follow the same pattern as `manifest-ops.ts` — tools with `{ name, description, input_schema, execute }`:

```typescript
import * as Minio from 'minio';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const WORKSPACE = process.env.WORKSPACE_DIR || '/workspace';
const API_CALLBACK_URL = process.env.API_CALLBACK_URL;

function getMinioClient(): Minio.Client {
  return new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || '',
    secretKey: process.env.MINIO_SECRET_KEY || '',
  });
}

const TEMPLATES_BUCKET = process.env.MINIO_BUCKET || 'viona';

// ── browse_templates ──────────────────────────────────────────

export const browseTemplatesTool = {
  name: 'browse_templates',
  description:
    'Browse the template registry. Returns metadata, prop schemas, and theme context. ' +
    'Use to discover available templates before building from scratch.',
  input_schema: {
    type: 'object' as const,
    properties: {
      theme: { type: 'string', description: 'Filter by theme slug' },
      type: { type: 'string', enum: ['scene', 'element'], description: 'Filter by template type' },
      category: { type: 'string', description: 'Filter by category' },
      search: { type: 'string', description: 'Fuzzy search name/description/tags' },
    },
  },
  execute: async (input: {
    theme?: string;
    type?: string;
    category?: string;
    search?: string;
  }): Promise<string> => {
    if (!API_CALLBACK_URL) {
      return JSON.stringify({ error: 'API_CALLBACK_URL not configured, template registry unavailable' });
    }

    const params = new URLSearchParams();
    if (input.theme) params.set('theme', input.theme);
    if (input.type) params.set('type', input.type);
    if (input.category) params.set('category', input.category);
    if (input.search) params.set('search', input.search);
    if (input.theme) params.set('includeThemeContext', 'true');
    params.set('limit', '50');

    try {
      const url = `${API_CALLBACK_URL}/templates?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) {
        return JSON.stringify({ error: `API returned ${res.status}: ${await res.text()}` });
      }
      const data = await res.json();
      return JSON.stringify(data, null, 2);
    } catch (err: any) {
      return JSON.stringify({
        error: `Template registry unavailable: ${err.message}. Proceed without templates.`,
      });
    }
  },
};

// ── fork_template ─────────────────────────────────────────────

export const forkTemplateTool = {
  name: 'fork_template',
  description:
    'Fork a template into the workspace. Copies source files from S3 so you can read, ' +
    'modify, and use the code. The forked code is yours — adapt it freely.',
  input_schema: {
    type: 'object' as const,
    properties: {
      slug: { type: 'string', description: 'Template slug to fork' },
      targetDir: {
        type: 'string',
        description: 'Where to copy files (default: src/components/templates/{slug}/)',
      },
    },
    required: ['slug'],
  },
  execute: async (input: { slug: string; targetDir?: string }): Promise<string> => {
    const { slug } = input;

    // 1. Get template metadata from API
    if (!API_CALLBACK_URL) {
      return JSON.stringify({ error: 'API_CALLBACK_URL not configured' });
    }

    let templateData: any;
    try {
      const res = await fetch(`${API_CALLBACK_URL}/templates/${slug}`);
      if (!res.ok) {
        if (res.status === 404) {
          return JSON.stringify({ error: `Template "${slug}" not found in registry.` });
        }
        return JSON.stringify({ error: `API returned ${res.status}` });
      }
      templateData = await res.json();
    } catch (err: any) {
      return JSON.stringify({ error: `Failed to fetch template metadata: ${err.message}` });
    }

    const sourceKey = templateData.sourceKey;
    if (!sourceKey) {
      return JSON.stringify({ error: `Template "${slug}" has no source files in S3.` });
    }

    // 2. Download source files from S3
    const targetDir = input.targetDir || `src/components/templates/${slug}`;
    const targetPath = join(WORKSPACE, targetDir);
    mkdirSync(targetPath, { recursive: true });

    const minio = getMinioClient();
    const prefix = `templates/${sourceKey}`;
    const files: Array<{ path: string; description: string }> = [];
    let entryPoint = '';

    try {
      const objects: Minio.BucketItem[] = [];
      const stream = minio.listObjects(TEMPLATES_BUCKET, prefix, true);
      for await (const obj of stream) {
        if (obj.name) objects.push(obj);
      }

      if (objects.length === 0) {
        return JSON.stringify({ error: `No source files found at S3 prefix "${prefix}".` });
      }

      for (const obj of objects) {
        // Strip the prefix to get relative path
        const relativePath = obj.name!.replace(prefix, '');
        if (!relativePath || relativePath === '/') continue;

        const localPath = join(targetPath, relativePath);
        mkdirSync(dirname(localPath), { recursive: true });

        // Download file
        const dataStream = await minio.getObject(TEMPLATES_BUCKET, obj.name!);
        const chunks: Buffer[] = [];
        for await (const chunk of dataStream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const rawBuffer = Buffer.concat(chunks);

        // Check if file is a text file (skip binary assets like images)
        const textExts = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.svg'];
        const isTextFile = textExts.some(ext => relativePath.endsWith(ext));

        if (isTextFile) {
          const content = rawBuffer.toString('utf-8');
          // Rewrite ../../ imports to local paths
          const rewritten = content
            .replace(/from\s+['"]\.\.\/\.\.\/([^'"]+)['"]/g, `from './$1'`)
            .replace(/import\s+['"]\.\.\/\.\.\/([^'"]+)['"]/g, `import './$1'`);
          writeFileSync(localPath, rewritten, 'utf-8');
        } else {
          // Write binary files as-is
          writeFileSync(localPath, rawBuffer);
        }

        const desc = relativePath.endsWith('index.tsx')
          ? 'Main component (entry point)'
          : relativePath.endsWith('schema.ts')
            ? 'Props schema (Zod)'
            : relativePath.endsWith('meta.json')
              ? 'Template metadata'
              : relativePath.endsWith('constants.ts')
                ? 'Style constants'
                : 'Component file';

        if (relativePath.endsWith('index.tsx') || relativePath.endsWith('index.ts')) {
          entryPoint = `${targetDir}${relativePath}`;
        }

        files.push({
          path: `${targetDir}${relativePath}`,
          description: desc,
        });
      }
    } catch (err: any) {
      return JSON.stringify({
        error: `Failed to download source files from S3: ${err.message}. Build from scratch instead.`,
      });
    }

    return JSON.stringify({
      files,
      entryPoint: entryPoint || files[0]?.path || '',
      propsSchema: templateData.propsSchema || {},
      message: `Forked "${slug}" to ${targetDir}/. Read the files and modify as needed.`,
    }, null, 2);
  },
};

export const allTemplateTools = [browseTemplatesTool, forkTemplateTool];
export const templateBrowseTools = [browseTemplatesTool];
```

- [ ] **Step 2: Verify it compiles**

Run: `cd packages/sandbox && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/tools/template-tools.ts
git commit -m "feat(sandbox): add browse_templates and fork_template MCP tools"
```

---

### Task 9: Register Templates MCP Server

**Files:**
- Modify: `packages/sandbox/src/mcp-servers.ts`

- [ ] **Step 1: Import template tools**

At the top of `mcp-servers.ts`, add:

```typescript
import { allTemplateTools } from './tools/template-tools.js';
```

- [ ] **Step 2: Create templates MCP server**

Inside the `createMcpServers` function, add after the last server definition:

```typescript
const templatesServer = createSdkMcpServer({
  name: 'templates',
  tools: allTemplateTools.map(wrapTool),
});
```

- [ ] **Step 3: Add to return object**

Add `templates: templatesServer` to the return object.

- [ ] **Step 4: Verify it compiles**

Run: `cd packages/sandbox && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/mcp-servers.ts
git commit -m "feat(sandbox): register templates MCP server"
```

---

### Task 10: Orchestrator Integration — Wire template tools to agents

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts`

- [ ] **Step 1: Import template tools**

At the top of `orchestrator.ts`, add:

```typescript
import { allTemplateTools, templateBrowseTools } from './tools/template-tools.js';
```

- [ ] **Step 2: Add template tool name constants**

After the existing tool name constants (around line 129), add:

```typescript
const TEMPLATE_BROWSE_TOOL_NAMES = templateBrowseTools.map(t => `mcp__templates__${t.name}`);
const TEMPLATE_TOOL_NAMES = allTemplateTools.map(t => `mcp__templates__${t.name}`);
```

- [ ] **Step 3: Add display names**

Find `TOOL_DISPLAY_NAMES` (around line 157) and add:

```typescript
'browse_templates': 'Browsing templates',
'fork_template': 'Forking template',
```

Find `MCP_SERVER_LABELS` (around line 144) and add:

```typescript
'templates': 'Template Registry',
```

- [ ] **Step 4: Add to agent tool allowlists**

Find the agent definitions and add template tools:

- **Orchestrator** tools array: add `...TEMPLATE_BROWSE_TOOL_NAMES`
- **Planner** tools array: add `...TEMPLATE_BROWSE_TOOL_NAMES`
- **Setup Agent** tools array: add `...TEMPLATE_TOOL_NAMES`
- **Animator** tools array: add `...TEMPLATE_TOOL_NAMES`

Look for the `agents:` object in the orchestrator config (around line 264+). Each agent has a `tools:` array — append the constants to those arrays.

- [ ] **Step 5: Verify it compiles**

Run: `cd packages/sandbox && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add packages/sandbox/src/orchestrator.ts
git commit -m "feat(sandbox): wire template tools to planner, setup, and animator agents"
```

---

### Task 11: Prompt Updates — Add template instructions

**Files:**
- Modify: `packages/sandbox/src/prompts/planner/system.md`
- Modify: `packages/sandbox/src/prompts/setup-agent/system.md`
- Modify: `packages/sandbox/src/prompts/animator/system.md`

First, verify exact prompt file paths exist. Run: `ls packages/sandbox/src/prompts/*/system.md` to find the right filenames. They may be `system.md`, `base.md`, or similar.

- [ ] **Step 1: Add to Planner prompt**

Append to the planner's system prompt:

```markdown
## Template Registry

You have access to a template registry via the `browse_templates` tool. Before planning scenes:
1. Browse available templates to see what's already built
2. If a theme is specified, browse with the theme filter to get themed templates + style guidance
3. Prefer using existing templates over building from scratch when a template is close to what's needed
4. Note template slugs and fork-reasons in SCENE_PLAN.md for the setup agent

Example in SCENE_PLAN.md:
```
## Scene 3: Travel Route (frames 210-450)
- template: watercolor-map
- fork-reason: need animated route, modify for 3 stops
- modifications: change color palette to match theme
```
```

- [ ] **Step 2: Add to Setup Agent prompt**

Append to the setup agent's system prompt:

```markdown
## Template Forking

When the scene plan references a template:
1. Use `fork_template` to copy its source into the workspace
2. The forked code is yours to modify — adapt colors, content, animations to match the project
3. Forked templates land in `src/components/templates/{slug}/` by default
4. Import and use the forked component in your scene files
5. Read the forked code before modifying — understand its structure first
```

- [ ] **Step 3: Add to Animator prompt**

Append to the animator's system prompt:

```markdown
## Element Templates

If you need a reusable element (lower-third, title card, progress bar, etc.):
1. Check `browse_templates` with `type: "element"` before building from scratch
2. Fork and modify when an existing template is close to what you need
3. You can fork element templates into your scene directory if they're only used once
```

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/prompts/
git commit -m "feat(sandbox): add template browsing/forking instructions to agent prompts"
```

---

### Task 12: Cleanup — Remove deprecated blueprint catalog

**Files:**
- Delete: `packages/worker/workspace/src/STUDIO_TEMPLATES.md`
- Delete: `packages/worker/src/prompts/studio-templates.ts`
- Modify: `packages/worker/src/prompts/index.ts` (line 3)
- Modify: `packages/worker/src/agents/visual_generator/_director.py` (lines ~69-77)
- Modify: `packages/worker/src/prompts/director/director.py` (line ~459)
- Modify: `packages/worker/src/prompts/themes/studio/director-style.md` (line ~41)
- Modify: `packages/worker/README.md` (line ~92)
- Modify: `packages/worker/src/prompts/README.md` (lines ~17, ~342)

- [ ] **Step 1: Delete the blueprint files**

```bash
rm packages/worker/workspace/src/STUDIO_TEMPLATES.md
rm packages/worker/src/prompts/studio-templates.ts
```

- [ ] **Step 2: Remove re-export from index.ts**

In `packages/worker/src/prompts/index.ts`, remove the line:

```typescript
export * from './studio-templates.js';
```

- [ ] **Step 3: Clean up _director.py**

In `packages/worker/src/agents/visual_generator/_director.py`, find and remove the block around lines 69-77 that loads STUDIO_TEMPLATES.md:

```python
# Remove this block:
catalog_path = self.workspace / "src" / "STUDIO_TEMPLATES.md"
# ... (and surrounding try/catch or conditional)
```

- [ ] **Step 4: Clean up director.py prompt**

In `packages/worker/src/prompts/director/director.py`, remove the reference to STUDIO_TEMPLATES.md catalog around line 459 (the line referencing template slugs from the catalog).

- [ ] **Step 5: Clean up director-style.md**

In `packages/worker/src/prompts/themes/studio/director-style.md`, remove the line around 41 that says "If a STUDIO_TEMPLATES.md file exists in the workspace src/ directory, READ IT FIRST."

- [ ] **Step 6: Update README files**

In `packages/worker/README.md`, remove the `studio-templates.ts` line from the directory tree listing.

In `packages/worker/src/prompts/README.md`, remove the two references to `studio-templates.ts` (around lines 17 and 342).

- [ ] **Step 7: Verify no broken imports**

Run: `cd packages/worker && npx tsc --noEmit` (or the project's build command for the worker package).

Grep for any remaining references: `grep -r "studio-templates\|STUDIO_TEMPLATES\|buildTemplateCatalog" packages/worker/src/ --include='*.ts' --include='*.py' --include='*.md'`

Expected: No matches in source code (only old plan docs in `docs/` which are historical).

- [ ] **Step 8: Commit**

```bash
git add -A packages/worker/
git commit -m "chore: remove deprecated STUDIO_TEMPLATES.md blueprint catalog and buildTemplateCatalog"
```

---

### Task 13: Integration Verification

- [ ] **Step 1: Verify API starts cleanly**

Run: `cd packages/api && npm run dev` (or equivalent)

Expected: Server starts without errors. Check logs for schema/migration issues.

- [ ] **Step 2: Test theme endpoints**

```bash
# List themes (should be empty or contain seeded themes)
curl http://localhost:4000/api/templates/themes | jq

# If magazine theme was seeded:
curl http://localhost:4000/api/templates/themes/magazine | jq
```

- [ ] **Step 3: Test templates with new filters**

```bash
# Filter by type
curl 'http://localhost:4000/api/templates?type=scene' | jq '.items | length'

# Filter by theme (if seeded)
curl 'http://localhost:4000/api/templates?theme=magazine&includeThemeContext=true' | jq '.themeContext'

# Verify propsSchema is in response
curl 'http://localhost:4000/api/templates?limit=1' | jq '.items[0].propsSchema'
```

- [ ] **Step 4: Verify sandbox compiles**

Run: `cd packages/sandbox && npx tsc --noEmit`

Expected: No type errors. The template tools, MCP server, and orchestrator changes all compile cleanly.

- [ ] **Step 5: Commit any fixes**

If anything needed fixing during verification, commit those fixes now.

```bash
git add -A
git commit -m "fix: address integration issues from template system verification"
```
