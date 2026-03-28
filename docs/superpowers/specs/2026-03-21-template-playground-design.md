# Template Playground Upgrade — Design Spec

## Goal

Move the template playground from `packages/worker/workspace/` into `packages/templates/` and upgrade it from a basic preview tool into a theme-aware testing environment. The playground provides observability for templates and themes — developers write code and JSON in their editor, the playground renders and organizes everything for visual verification.

## Context

- **Themes** are aesthetic groupings (JSON files in `themes/`), not runtime overrides. Templates within a theme share a visual identity (colors, fonts, style).
- **Templates** are self-contained Remotion components in `src/templates/*/`. Each has `index.tsx`, `schema.ts`, and `meta.json`.
- **Association**: `meta.json` contains a `themes` array (e.g. `["magazine"]`) linking the template to theme slugs.
- The playground is purely for observability and testing — no authoring, no DB, no API.

## Architecture

### Location

The playground moves to `packages/templates/playground/` — co-located with both template source and theme JSON.

### File Structure

```
packages/templates/
├── src/templates/           # template source (exists)
│   ├── country-highlight/
│   ├── watercolor-map/
│   └── globe-spin/
├── themes/                  # theme JSON (exists)
│   └── magazine.json
├── playground/              # NEW
│   ├── index.html           # Vite HTML entry (<script type="module" src="./main.tsx">)
│   ├── main.tsx             # React mount point
│   ├── App.tsx              # Top-level layout, tab state routing
│   ├── components/          # UI components
│   │   ├── TemplateGallery.tsx
│   │   ├── TemplateDetail.tsx
│   │   ├── ThemeBrowser.tsx
│   │   ├── PropsEditor.tsx
│   │   ├── PaletteSwatches.tsx
│   │   └── PlayerWrapper.tsx
│   ├── lib/
│   │   ├── discover.ts      # Template + theme auto-discovery via import.meta.glob
│   │   └── schema-introspect.ts  # Zod → field info extraction
│   └── vite.config.ts
├── scripts/                 # existing build/upload/seed scripts
└── package.json             # add "playground" script
```

### Vite Configuration

`playground/vite.config.ts`:
- `root: __dirname` — Vite root is the `playground/` directory itself (so `index.html` resolves correctly)
- `server.port: 3200` — same port as old playground, avoids conflict with Next.js (3000) and API (4000)
- `plugins: [react()]`
- `resolve.alias` if needed for template imports that reference shared deps

Since `root` is `playground/`, all `import.meta.glob` paths in playground source files are relative to `playground/`.

### Entry Point

New script in `packages/templates/package.json`:
```json
"playground": "vite --config playground/vite.config.ts"
```

Run with: `pnpm --filter @viona/templates playground`

### Dependencies

Add to `packages/templates/package.json` devDependencies:
- `vite` `^8.0.1` (matches workspace version)
- `@vitejs/plugin-react` `^6.0.1` (matches workspace version)
- `@remotion/player` `4.0.422` (matches other Remotion deps)

Already present: `react`, `react-dom`, `zod`, `remotion` (as devDeps/peerDeps).

### View Routing

Simple React state — no router library. `App.tsx` manages a `view` state:

```typescript
type View =
  | { type: 'gallery' }
  | { type: 'detail'; templateId: string }
  | { type: 'themes'; themeSlug?: string };
```

Navigation is function calls (`setView(...)`) passed as props. No URL-based routing needed for a dev tool.

## Types

### ThemeDefinition

```typescript
interface ThemeDefinition {
  slug: string;
  name: string;
  description: string;
  colorPalette: Record<string, string>;  // e.g. { primary, secondary, accent, background, text }
  fontRecommendations: Record<string, string>;  // e.g. { heading, body, accent }
  styleGuidance: string;
}
```

This matches the JSON structure in `themes/*.json` and the interface in `scripts/seed-themes.ts`.

The theme's canonical identifier is the `slug` field inside the JSON (not the filename). Templates reference themes by slug in their `meta.json` `themes` array.

### TemplateEntry

```typescript
interface TemplateEntry {
  id: string;            // slug from meta.json
  name: string;
  description: string;
  category: string;
  tags: string[];
  themes: string[];      // theme slugs from meta.json
  loader: () => Promise<{ default: React.FC<any> }>;
  schema: z.ZodObject<any>;
  defaultProps: Record<string, any>;
  meta: Record<string, any>;
}
```

## Views

### View 1: Template Gallery (default)

- Grid of all templates, each rendered as a Remotion `<Player>` paused at frame 0 (poster frame) with small dimensions (~240px wide)
- **Filter bar** at top: dropdown for category, dropdown for theme (populated from discovered themes + "All" + "Unthemed"), text search for name/tags
- Click a template card to navigate to Template Detail view
- Templates with no theme association appear when "Unthemed" filter is selected

### View 2: Template Detail

- **Center**: Remotion `<Player>` with playback controls (play/pause, scrub, loop)
- **Right sidebar**: Schema-driven props editor — Zod introspection generates controls (text inputs, sliders, color pickers, dropdowns, toggles, coordinate editors, country selectors)
- **Top bar**: Aspect ratio toggle (1:1, 9:16, 16:9), duration selector (6s, 12s, 20s, 30s)
- **Theme badges**: Shows which theme(s) this template belongs to, clickable to jump to Theme Browser
- **Back navigation**: Returns to gallery

### View 3: Theme Browser

- **Left panel**: List of all themes loaded from `themes/*.json`
- **Center panel** (selected theme):
  - Name, description, style guidance text
  - Color palette rendered as swatches (primary, secondary, accent, background, text)
  - Font recommendations displayed with actual font names
  - Grid of all templates belonging to this theme, rendered as `<Player>` poster frames for side-by-side cohesion check
  - Each template thumbnail is clickable, navigates to Template Detail
- **Comparison**: Seeing all themed templates together verifies they share consistent visual identity

## Data Flow

All discovery logic lives in `playground/lib/discover.ts`. Paths are relative to `playground/` (the Vite root).

### Template Discovery

```typescript
// In playground/lib/discover.ts

// Lazy-load components
const templateImports = import.meta.glob(
  '../src/templates/*/index.tsx'
) as Record<string, () => Promise<{ default: React.FC<any> }>>;

// Eager-load schemas and metadata
const schemaModules = import.meta.glob(
  '../src/templates/*/schema.ts', { eager: true }
) as Record<string, { schema: z.ZodObject<any>; defaultProps: any }>;

const metaModules = import.meta.glob(
  '../src/templates/*/meta.json', { eager: true }
) as Record<string, { default: Record<string, any> }>;
```

### Theme Discovery

```typescript
// In playground/lib/discover.ts

const themeModules = import.meta.glob(
  '../themes/*.json', { eager: true }
) as Record<string, { default: ThemeDefinition }>;
```

### Theme-Template Association

- Each template's `meta.json` has a `themes` array of theme slugs
- Theme Browser filters templates by matching `meta.json.themes` against the selected theme's slug
- Gallery view filters by theme when a theme filter is selected

### Country Data

The template package has country data as a TypeScript module at `src/templates/country-highlight/data/countries.ts`. The playground imports this directly — no JSON file fetch needed, no `public/` directory. If a template's schema has country fields, the props editor imports from the same TS module.

## Ported from Current Playground

These modules are extracted and adapted from `packages/worker/workspace/src/playground.tsx`:

- **Zod schema introspection** → `playground/lib/schema-introspect.ts` — `unwrapZod()`, `introspectSchema()`, field type detection (color, coord, country, enum, etc.)
- **Props editor** → `playground/components/PropsEditor.tsx` — renders controls from introspected schema fields
- **Country data** → direct TS import from `src/templates/country-highlight/data/countries.ts` (replaces JSON fetch)
- **Error boundary** → `TemplateBoundary` component for broken template isolation
- **Player wrapper** → `playground/components/PlayerWrapper.tsx` — Remotion Player with aspect/duration controls

## What This Does NOT Do

- No theme editing UI — edit `themes/*.json` files directly in editor
- No template authoring — write component code in editor
- No DB or API calls — pure filesystem via Vite import.meta.glob
- No export or render — use Remotion CLI or the build pipeline
- No drag-drop or editor integration
- No creation of new template scaffolds

## Cleanup

Delete from `packages/worker/workspace/`:
- `src/playground.tsx` — replaced by the new playground
- `index.html` — was only the Vite playground entry point
- `vite.config.ts` — existed solely for the Vite playground
- `postcss.config.mjs` — referenced by the Vite config, no longer needed

Modify `packages/worker/workspace/package.json`:
- Remove the `"playground": "vite"` script
- Remove `vite` and `@vitejs/plugin-react` from devDependencies (only used by the playground)

The workspace retains its Remotion studio entry points (`template-studio.ts`, `test-studio.ts`) and `pnpm dev` / `pnpm dev:templates` scripts — those use Remotion CLI, not Vite.
