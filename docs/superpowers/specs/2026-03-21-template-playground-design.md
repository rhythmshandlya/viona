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
│   ├── index.html           # Vite HTML entry
│   ├── main.tsx             # React mount point
│   ├── App.tsx              # Top-level layout, view routing
│   ├── components/          # UI components
│   │   ├── TemplateGallery.tsx
│   │   ├── TemplateDetail.tsx
│   │   ├── ThemeBrowser.tsx
│   │   ├── PropsEditor.tsx
│   │   ├── PaletteSwatches.tsx
│   │   └── PlayerWrapper.tsx
│   ├── lib/
│   │   ├── discover.ts      # Template + theme auto-discovery
│   │   └── schema-introspect.ts  # Zod → field info extraction
│   └── vite.config.ts
├── scripts/                 # existing build/upload/seed scripts
└── package.json             # add "playground" script
```

### Entry Point

New script in `packages/templates/package.json`:
```json
"playground": "vite --config playground/vite.config.ts"
```

Run with: `pnpm --filter @viona/templates playground`

### Dependencies

Vite, React, `@remotion/player`, and `zod` are needed. The package already has `zod` and Remotion deps for the build system. Add `vite`, `@vitejs/plugin-react`, `react`, `react-dom`, and `@remotion/player` as devDependencies.

## Views

### View 1: Template Gallery (default)

- Grid of all templates, each rendered as a small Remotion `<Thumbnail>` or `<Player>` poster frame
- Filterable by: category, tags, theme membership
- Click a template card to navigate to Template Detail view
- Templates with no theme association appear under an "Unthemed" filter option

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
  - Grid of all templates belonging to this theme, rendered as thumbnails for side-by-side cohesion check
  - Each template thumbnail is clickable, navigates to Template Detail
- **Comparison**: Seeing all themed templates together verifies they share consistent visual identity

## Data Flow

### Template Discovery

```typescript
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
const themeModules = import.meta.glob(
  '../../themes/*.json', { eager: true }
) as Record<string, { default: ThemeDefinition }>;
```

### Theme-Template Association

- Each template's `meta.json` has a `themes` array of theme slugs
- Theme Browser filters templates by matching `meta.json.themes` against the selected theme's slug
- Gallery view filters by theme when a theme filter is selected

## Ported from Current Playground

These modules are extracted and adapted from `packages/worker/workspace/src/playground.tsx`:

- **Zod schema introspection** → `lib/schema-introspect.ts` — `unwrapZod()`, `introspectSchema()`, field type detection (color, coord, country, enum, etc.)
- **Props editor** → `components/PropsEditor.tsx` — renders controls from introspected schema fields
- **Country data loader** → reuse `useCountryList()` hook with country JSON fetch
- **Error boundary** → `TemplateBoundary` component for broken template isolation
- **Player wrapper** → `components/PlayerWrapper.tsx` — Remotion Player with aspect/duration controls

## What This Does NOT Do

- No theme editing UI — edit `themes/*.json` files directly in editor
- No template authoring — write component code in editor
- No DB or API calls — pure filesystem via Vite import.meta.glob
- No export or render — use Remotion CLI or the build pipeline
- No drag-drop or editor integration
- No creation of new template scaffolds

## Cleanup

- Delete `packages/worker/workspace/src/playground.tsx` — replaced by the new playground
- Delete `packages/worker/workspace/index.html` — was only used as the Vite playground entry
- The workspace retains its Remotion studio entry points (`template-studio.ts`, `test-studio.ts`) and `pnpm dev` / `pnpm dev:templates` scripts
