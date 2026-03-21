# Template Playground Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the template playground from `packages/worker/workspace/` into `packages/templates/` and upgrade it with a gallery view, template detail view with props editor, and theme browser for testing visual cohesion.

**Architecture:** Vite dev app in `packages/templates/playground/` using `import.meta.glob` to auto-discover templates from `../src/templates/*/` and themes from `../themes/*.json`. Three views managed by React state (no router). Ported Zod schema introspection from the old playground drives the props editor.

**Tech Stack:** Vite 8, React 19, @remotion/player 4.0.422, Zod 3, TypeScript

---

## File Structure

```
packages/templates/playground/
├── index.html              # Vite HTML entry
├── main.tsx                # React mount, createRoot
├── App.tsx                 # Layout shell, view state, tab navigation
├── vite.config.ts          # Vite config (root: __dirname, port 3200)
├── tsconfig.json           # TS config for playground (extends parent or standalone)
├── components/
│   ├── TemplateGallery.tsx  # Grid of template cards with filters
│   ├── TemplateDetail.tsx   # Player + props sidebar for single template
│   ├── ThemeBrowser.tsx     # Theme list + detail + themed template grid
│   ├── PropsEditor.tsx      # Schema-driven controls (ported from old playground)
│   ├── PaletteSwatches.tsx  # Renders theme color palette as swatches
│   ├── PlayerWrapper.tsx    # Remotion Player with error boundary
│   └── ui.tsx               # Shared primitives (Section, Label, ButtonGroup, Toggle, etc.)
└── lib/
    ├── discover.ts          # discoverTemplates(), discoverThemes()
    ├── schema-introspect.ts # unwrapZod(), introspectSchema(), FieldInfo types
    └── types.ts             # ThemeDefinition, TemplateEntry, View types
```

**Files modified:**
- `packages/templates/package.json` — add `playground` script, add 3 devDependencies

**Files deleted (cleanup):**
- `packages/worker/workspace/src/playground.tsx`
- `packages/worker/workspace/index.html`
- `packages/worker/workspace/vite.config.ts`
- `packages/worker/workspace/postcss.config.mjs`

**Files modified (cleanup):**
- `packages/worker/workspace/package.json` — remove `playground` script, remove `vite` and `@vitejs/plugin-react` devDeps

---

### Task 1: Add dependencies and Vite scaffold

**Files:**
- Modify: `packages/templates/package.json`
- Create: `packages/templates/playground/vite.config.ts`
- Create: `packages/templates/playground/tsconfig.json`
- Create: `packages/templates/playground/index.html`
- Create: `packages/templates/playground/main.tsx`

- [ ] **Step 1: Add devDependencies to packages/templates**

Run from repo root:
```bash
pnpm --filter @viona/templates add -D vite@^8.0.1 @vitejs/plugin-react@^6.0.1 @remotion/player@4.0.422
```

- [ ] **Step 2: Add playground script to package.json**

In `packages/templates/package.json`, add to `"scripts"`:
```json
"playground": "vite --config playground/vite.config.ts"
```

- [ ] **Step 3: Create vite.config.ts**

Create `packages/templates/playground/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  server: { port: 3200 },
});
```

- [ ] **Step 4: Create tsconfig.json for playground**

Create `packages/templates/playground/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "jsx": "react-jsx",
    "noEmit": true
  },
  "include": ["./**/*.ts", "./**/*.tsx", "../src/**/*.ts", "../src/**/*.tsx", "../themes/**/*.json"]
}
```

- [ ] **Step 5: Create index.html**

Create `packages/templates/playground/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Viona Template Playground</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #0a0a0f; color: #e0e0e0; font-family: system-ui, -apple-system, sans-serif; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create main.tsx with minimal mount**

Create `packages/templates/playground/main.tsx`:
```typescript
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);
```

- [ ] **Step 7: Create placeholder App.tsx**

Create `packages/templates/playground/App.tsx`:
```typescript
import React from 'react';

export function App() {
  return <div style={{ padding: 40, color: '#888' }}>Playground loading...</div>;
}
```

- [ ] **Step 8: Verify Vite starts**

Run:
```bash
cd packages/templates && pnpm playground
```
Expected: Vite dev server starts on port 3200, browser shows "Playground loading..."

- [ ] **Step 9: Commit**

```bash
git add packages/templates/playground/ packages/templates/package.json pnpm-lock.yaml
git commit -m "feat(templates): scaffold playground Vite app"
```

---

### Task 2: Types and discovery logic

**Files:**
- Create: `packages/templates/playground/lib/types.ts`
- Create: `packages/templates/playground/lib/discover.ts`

- [ ] **Step 1: Create types.ts**

Create `packages/templates/playground/lib/types.ts`:
```typescript
import type { z } from 'zod';

export interface ThemeDefinition {
  slug: string;
  name: string;
  description: string;
  colorPalette: Record<string, string>;
  fontRecommendations: Record<string, string>;
  styleGuidance: string;
}

export interface TemplateEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  themes: string[];
  loader: () => Promise<{ default: React.FC<any> }>;
  schema: z.ZodObject<any>;
  defaultProps: Record<string, any>;
  meta: Record<string, any>;
}

export type View =
  | { type: 'gallery' }
  | { type: 'detail'; templateId: string }
  | { type: 'themes'; themeSlug?: string };
```

- [ ] **Step 2: Create discover.ts**

Create `packages/templates/playground/lib/discover.ts`:
```typescript
import type { z } from 'zod';
import type { TemplateEntry, ThemeDefinition } from './types';

// ── Template discovery ──────────────────────────────────────────────────────

const templateImports = import.meta.glob(
  '../../src/templates/*/index.tsx',
) as Record<string, () => Promise<{ default: React.FC<any> }>>;

const schemaModules = import.meta.glob(
  '../../src/templates/*/schema.ts',
  { eager: true },
) as Record<string, { schema: z.ZodObject<any>; defaultProps: any }>;

const metaModules = import.meta.glob(
  '../../src/templates/*/meta.json',
  { eager: true },
) as Record<string, { default: Record<string, any> }>;

export function discoverTemplates(): TemplateEntry[] {
  const templates: TemplateEntry[] = [];

  for (const [path, loader] of Object.entries(templateImports)) {
    const slug = path.match(/templates\/([^/]+)\//)?.[1];
    if (!slug) continue;

    const schemaMod = schemaModules[`../../src/templates/${slug}/schema.ts`];
    const metaMod = metaModules[`../../src/templates/${slug}/meta.json`];
    if (!schemaMod?.schema) continue;

    const meta = metaMod?.default ?? {};
    templates.push({
      id: slug,
      name: meta.name ?? slug,
      description: meta.description ?? '',
      category: meta.category ?? 'uncategorized',
      tags: meta.tags ?? [],
      themes: meta.themes ?? [],
      loader,
      schema: schemaMod.schema,
      defaultProps: schemaMod.defaultProps ?? schemaMod.schema.parse({}),
      meta,
    });
  }

  return templates.sort((a, b) => a.name.localeCompare(b.name));
}

// ── Theme discovery ─────────────────────────────────────────────────────────

const themeModules = import.meta.glob(
  '../../themes/*.json',
  { eager: true },
) as Record<string, { default: ThemeDefinition }>;

export function discoverThemes(): ThemeDefinition[] {
  const themes: ThemeDefinition[] = [];

  for (const [, mod] of Object.entries(themeModules)) {
    if (mod?.default?.slug) {
      themes.push(mod.default);
    }
  }

  return themes.sort((a, b) => a.name.localeCompare(b.name));
}
```

Note: `import.meta.glob` paths resolve relative to the file they appear in. Since `discover.ts` is at `playground/lib/discover.ts`, paths need `../../` to reach `packages/templates/src/templates/` and `packages/templates/themes/`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd packages/templates/playground && npx tsc --noEmit --pretty false
```

- [ ] **Step 4: Commit**

```bash
git add packages/templates/playground/lib/
git commit -m "feat(templates): add types and template/theme discovery"
```

---

### Task 3: Schema introspection and UI primitives

**Files:**
- Create: `packages/templates/playground/lib/schema-introspect.ts`
- Create: `packages/templates/playground/components/ui.tsx`

- [ ] **Step 1: Create schema-introspect.ts**

Port from `packages/worker/workspace/src/playground.tsx` lines 78-213. This is the Zod schema introspection logic — extract it into its own module.

Create `packages/templates/playground/lib/schema-introspect.ts`:
```typescript
import { z } from 'zod';

export type FieldType =
  | 'string' | 'number' | 'boolean' | 'enum' | 'color'
  | 'object' | 'coord' | 'country' | 'array' | 'unknown';

export interface FieldInfo {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  children?: FieldInfo[];
}

export function unwrapZod(schema: z.ZodTypeAny): { inner: z.ZodTypeAny; defaultValue?: any } {
  const def = (schema as any)._def;
  if (def.typeName === 'ZodDefault') {
    const unwrapped = unwrapZod(def.innerType);
    return { inner: unwrapped.inner, defaultValue: def.defaultValue() };
  }
  if (def.typeName === 'ZodOptional') {
    return unwrapZod(def.innerType);
  }
  return { inner: schema };
}

function isColorField(key: string, schema: z.ZodTypeAny): boolean {
  const { inner } = unwrapZod(schema);
  const def = (inner as any)._def;
  if (def.typeName !== 'ZodString') return false;
  const colorKeys = ['color', 'background', 'fill', 'stroke', 'highlight', 'tint', 'accent', 'primary', 'secondary', 'text'];
  return colorKeys.some((k) => key.toLowerCase().includes(k));
}

function extractNumberBounds(schema: z.ZodTypeAny): { min?: number; max?: number } {
  const { inner } = unwrapZod(schema);
  const checks = (inner as any)._def.checks as Array<{ kind: string; value: number }> | undefined;
  let min: number | undefined;
  let max: number | undefined;
  for (const check of checks ?? []) {
    if (check.kind === 'min') min = check.value;
    if (check.kind === 'max') max = check.value;
  }
  return { min, max };
}

function isCoordObject(schema: z.ZodTypeAny): boolean {
  const { inner } = unwrapZod(schema);
  const def = (inner as any)._def;
  if (def.typeName !== 'ZodObject') return false;
  const shape = (inner as z.ZodObject<any>).shape;
  return 'lat' in shape && 'lng' in shape;
}

function inferNumberBounds(key: string, schemaBounds: { min?: number; max?: number }): { min: number; max: number; step: number } {
  if (schemaBounds.min !== undefined && schemaBounds.max !== undefined) {
    const isFloat = schemaBounds.max <= 1 && schemaBounds.min >= 0;
    return { min: schemaBounds.min, max: schemaBounds.max, step: isFloat ? 0.01 : 1 };
  }
  const k = key.toLowerCase();
  if (k.includes('lat')) return { min: -90, max: 90, step: 0.1 };
  if (k.includes('lng') || k.includes('lon')) return { min: -180, max: 180, step: 0.1 };
  if (k.includes('opacity') || k.includes('alpha') || k.includes('intensity')) return { min: 0, max: 1, step: 0.01 };
  if (k.includes('size') || k.includes('fontsize') || k.includes('font_size')) return { min: 1, max: 200, step: 1 };
  if (k.includes('width') && !k.includes('viewport')) return { min: 1, max: 20, step: 1 };
  if (k.includes('radius')) return { min: 0, max: 100, step: 1 };
  if (k.includes('padding') || k.includes('margin')) return { min: 0, max: 400, step: 1 };
  if (k.includes('altitude')) return { min: 0.5, max: 5, step: 0.1 };
  if (k.includes('rotation') || k.includes('angle')) return { min: 0, max: 360, step: 1 };
  if (k.includes('zoom')) return { min: 1, max: 20, step: 0.5 };
  if (k.includes('speed')) return { min: 0.1, max: 10, step: 0.1 };
  if (k.includes('count') || k.includes('number')) return { min: 0, max: 100, step: 1 };
  return { min: schemaBounds.min ?? 0, max: schemaBounds.max ?? 100, step: 1 };
}

function isCountryField(key: string): boolean {
  const k = key.toLowerCase();
  return k === 'countryname' || k === 'country_name' || k === 'country';
}

function toLabel(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (s) => s.toUpperCase());
}

export function introspectSchema(schema: z.ZodObject<any>): FieldInfo[] {
  const shape = schema.shape;
  const fields: FieldInfo[] = [];

  for (const [key, rawField] of Object.entries(shape)) {
    const { inner } = unwrapZod(rawField as z.ZodTypeAny);
    const def = (inner as any)._def;

    if (isCoordObject(rawField as z.ZodTypeAny)) {
      fields.push({ key, label: toLabel(key), type: 'coord' });
      continue;
    }
    if (def.typeName === 'ZodObject') {
      fields.push({ key, label: toLabel(key), type: 'object', children: introspectSchema(inner as z.ZodObject<any>) });
    } else if (def.typeName === 'ZodEnum') {
      fields.push({ key, label: toLabel(key), type: 'enum', options: def.values });
    } else if (def.typeName === 'ZodBoolean') {
      fields.push({ key, label: toLabel(key), type: 'boolean' });
    } else if (def.typeName === 'ZodNumber') {
      const schemaBounds = extractNumberBounds(rawField as z.ZodTypeAny);
      const { min, max, step } = inferNumberBounds(key, schemaBounds);
      fields.push({ key, label: toLabel(key), type: 'number', min, max, step });
    } else if (def.typeName === 'ZodString') {
      if (isColorField(key, rawField as z.ZodTypeAny)) {
        fields.push({ key, label: toLabel(key), type: 'color' });
      } else if (isCountryField(key)) {
        fields.push({ key, label: toLabel(key), type: 'country' });
      } else {
        fields.push({ key, label: toLabel(key), type: 'string' });
      }
    } else if (def.typeName === 'ZodArray') {
      fields.push({ key, label: toLabel(key), type: 'array' });
    } else {
      fields.push({ key, label: toLabel(key), type: 'unknown' });
    }
  }
  return fields;
}
```

- [ ] **Step 2: Create ui.tsx — shared UI primitives**

Port the UI primitives from `packages/worker/workspace/src/playground.tsx` lines 519-698. These are pure presentational components: `Section`, `Label`, `ButtonGroup`, `TextInput`, `NumberInput`, `SliderInput`, `SelectInput`, `ColorInput`, `Toggle`, `CountrySelect`.

Create `packages/templates/playground/components/ui.tsx` with all the primitives listed above. Keep the same inline-styles approach from the old playground.

**Country data**: The raw `countries.ts` module is 184K+ (includes polygon geometry). Do NOT import it directly — it would bloat the playground. Instead, copy `packages/worker/workspace/public/data/countries.json` (lightweight: just name/iso/centroid) to `packages/templates/playground/public/data/countries.json` and keep the async fetch pattern from the old playground:

```typescript
export interface CountryOption {
  name: string;
  iso_a3: string;
  iso_a2: string;
  centroid: [number, number];
}

let cachedCountries: CountryOption[] | null = null;

export function useCountryList(): CountryOption[] {
  const [countries, setCountries] = useState<CountryOption[]>(cachedCountries ?? []);
  useEffect(() => {
    if (cachedCountries) return;
    fetch('/data/countries.json')
      .then((r) => r.json())
      .then((data: any[]) => {
        const list = data
          .map((c) => ({ name: c.name, iso_a3: c.iso_a3, iso_a2: c.iso_a2, centroid: c.centroid }))
          .sort((a, b) => a.name.localeCompare(b.name));
        cachedCountries = list;
        setCountries(list);
      })
      .catch(() => {});
  }, []);
  return countries;
}
```

Vite serves files from `playground/public/` automatically since `root` is `playground/`.

The full UI primitives to port (each is a named export): `Section`, `Label`, `ButtonGroup`, `TextInput`, `NumberInput`, `SliderInput`, `SelectInput`, `ColorInput`, `Toggle`, `CountrySelect`. Port their implementations verbatim from the old playground (`packages/worker/workspace/src/playground.tsx` lines 519-698). These are all pure inline-styled React components — no changes needed beyond moving them into this file.

- [ ] **Step 3: Copy lightweight country data for playground**

```bash
mkdir -p packages/templates/playground/public/data
cp packages/worker/workspace/public/data/countries.json packages/templates/playground/public/data/countries.json
```

This is the lightweight JSON (~name, iso codes, centroid only) — NOT the 184K polygon module.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd packages/templates/playground && npx tsc --noEmit --pretty false
```

- [ ] **Step 5: Commit**

```bash
git add packages/templates/playground/lib/schema-introspect.ts packages/templates/playground/components/ui.tsx packages/templates/playground/public/
git commit -m "feat(templates): add schema introspection and UI primitives"
```

---

### Task 4: PlayerWrapper and PropsEditor components

**Files:**
- Create: `packages/templates/playground/components/PlayerWrapper.tsx`
- Create: `packages/templates/playground/components/PropsEditor.tsx`

- [ ] **Step 1: Create PlayerWrapper.tsx**

This wraps Remotion `<Player>` with an error boundary. Port `TemplateBoundary` from the old playground (lines 217-237) and wrap the Player component.

Create `packages/templates/playground/components/PlayerWrapper.tsx`:
```typescript
import React, { useEffect, useState } from 'react';
import { Player } from '@remotion/player';
import type { TemplateEntry } from '../lib/types';

const ASPECTS = {
  '1:1': { width: 1080, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
} as const;

export type AspectKey = keyof typeof ASPECTS;
export { ASPECTS };

// Error boundary for broken templates
class TemplateBoundary extends React.Component<
  { templateId: string; children: React.ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };
  static getDerivedStateFromError(err: Error) { return { error: err.message }; }
  componentDidUpdate(prev: { templateId: string }) {
    if (prev.templateId !== this.props.templateId) this.setState({ error: null });
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ color: '#ef4444', fontSize: 13, textAlign: 'center', maxWidth: 400, lineHeight: 1.6, padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Template render error</div>
          <code style={{ color: '#f87171', fontSize: 12, wordBreak: 'break-word' }}>{this.state.error}</code>
        </div>
      );
    }
    return this.props.children;
  }
}

interface PlayerWrapperProps {
  template: TemplateEntry;
  props: Record<string, any>;
  aspect: AspectKey;
  duration: number;
  /** Max width for the player container in px */
  maxWidth?: number;
}

export function PlayerWrapper({ template, props, aspect, duration, maxWidth }: PlayerWrapperProps) {
  const [Component, setComponent] = useState<React.FC<any> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoadError(null);
    template.loader()
      .then((mod) => setComponent(() => mod.default))
      .catch((err) => setLoadError(`Failed to load "${template.name}": ${err.message}`));
  }, [template.id]);

  const dims = ASPECTS[aspect];
  const fps = 30;
  const autoMaxWidth = aspect === '16:9' ? 900 : aspect === '1:1' ? 600 : 400;

  if (loadError) {
    return <div style={{ color: '#ef4444', fontSize: 14, textAlign: 'center', maxWidth: 400, lineHeight: 1.5 }}>{loadError}</div>;
  }
  if (!Component) {
    return <div style={{ color: '#888', fontSize: 14 }}>Loading template...</div>;
  }

  return (
    <TemplateBoundary templateId={template.id}>
      <Player
        key={`${template.id}-${aspect}`}
        component={Component}
        inputProps={props}
        durationInFrames={duration * fps}
        compositionWidth={dims.width}
        compositionHeight={dims.height}
        fps={fps}
        style={{
          width: '100%',
          maxWidth: maxWidth ?? autoMaxWidth,
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 4px 40px rgba(0,0,0,0.6)',
        }}
        controls
        autoPlay
        loop
      />
    </TemplateBoundary>
  );
}
```

- [ ] **Step 2: Create PropsEditor.tsx**

Port the `FieldControl` component from the old playground (lines 422-517) into its own file. This renders the correct control for each field type based on the introspected schema.

Create `packages/templates/playground/components/PropsEditor.tsx`:
```typescript
import React, { useMemo, useCallback } from 'react';
import type { TemplateEntry } from '../lib/types';
import { introspectSchema, type FieldInfo } from '../lib/schema-introspect';
import {
  Section, TextInput, NumberInput, SliderInput, SelectInput,
  ColorInput, Toggle, ButtonGroup, Label, CountrySelect,
  useCountryList, type CountryOption,
} from './ui';

interface PropsEditorProps {
  template: TemplateEntry;
  props: Record<string, any>;
  onUpdateProp: (path: string[], value: any) => void;
  onReset: () => void;
}

export function PropsEditor({ template, props, onUpdateProp, onReset }: PropsEditorProps) {
  const fields = useMemo(() => introspectSchema(template.schema), [template]);
  const countries = useCountryList();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {fields.map((field) => (
        <FieldControl
          key={field.key}
          field={field}
          value={props[field.key]}
          onChange={(v) => onUpdateProp([field.key], v)}
          onPathChange={(path, v) => onUpdateProp([field.key, ...path], v)}
          countries={countries}
          allProps={props}
          onUpdateProp={onUpdateProp}
        />
      ))}
      <button
        onClick={onReset}
        style={{
          marginTop: 16, width: '100%', padding: '7px 0',
          background: 'transparent', border: '1px solid #333',
          borderRadius: 6, color: '#888', fontSize: 12, cursor: 'pointer',
        }}
      >
        Reset to defaults
      </button>
    </div>
  );
}
```

Then implement `FieldControl` in the same file (below `PropsEditor`). This is the schema-driven field renderer — it reads `field.type` and renders the appropriate UI primitive:

```typescript
function FieldControl({
  field, value, onChange, onPathChange, countries, allProps, onUpdateProp,
}: {
  field: FieldInfo;
  value: any;
  onChange: (v: any) => void;
  onPathChange: (path: string[], v: any) => void;
  countries: CountryOption[];
  allProps: Record<string, any>;
  onUpdateProp: (path: string[], v: any) => void;
}) {
  if (field.type === 'coord') {
    const coord = value ?? { lat: 0, lng: 0 };
    return (
      <Section title={field.label}>
        {coord.label !== undefined && (
          <TextInput label="Label" value={coord.label ?? ''} onChange={(v) => onChange({ ...coord, label: v })} />
        )}
        <NumberInput label="Latitude" value={coord.lat ?? 0} min={-90} max={90} step={0.01} onChange={(v) => onChange({ ...coord, lat: v })} />
        <NumberInput label="Longitude" value={coord.lng ?? 0} min={-180} max={180} step={0.01} onChange={(v) => onChange({ ...coord, lng: v })} />
      </Section>
    );
  }
  if (field.type === 'country') {
    return (
      <CountrySelect
        label={field.label} value={value ?? ''} countries={countries}
        onChange={(name, country) => {
          onChange(name);
          if (country && 'countryCode' in allProps) onUpdateProp(['countryCode'], country.iso_a3);
        }}
      />
    );
  }
  if (field.type === 'object' && field.children) {
    return (
      <Section title={field.label}>
        {field.children.map((child) => (
          <FieldControl key={child.key} field={child} value={value?.[child.key]}
            onChange={(v) => onPathChange([child.key], v)}
            onPathChange={(path, v) => onPathChange([child.key, ...path], v)}
            countries={countries} allProps={allProps} onUpdateProp={onUpdateProp} />
        ))}
      </Section>
    );
  }
  if (field.type === 'boolean') return <Toggle label={field.label} value={!!value} onChange={onChange} />;
  if (field.type === 'enum' && field.options) {
    if (field.options.length <= 4) {
      return (<div><Label>{field.label}</Label><ButtonGroup options={field.options} value={value ?? ''} onChange={onChange} /></div>);
    }
    return <SelectInput label={field.label} value={value ?? ''} options={field.options} onChange={onChange} />;
  }
  if (field.type === 'color') return <ColorInput label={field.label} value={value ?? '#000000'} onChange={onChange} />;
  if (field.type === 'number') {
    return <SliderInput label={field.label} value={value ?? 0} min={field.min ?? 0} max={field.max ?? 100} step={field.step ?? 1} onChange={onChange} />;
  }
  if (field.type === 'string') return <TextInput label={field.label} value={value ?? ''} onChange={onChange} />;
  if (field.type === 'array') {
    return (
      <div style={{ marginBottom: 8 }}>
        <Label>{field.label} (array)</Label>
        <textarea value={JSON.stringify(value ?? [], null, 2)}
          onChange={(e) => { try { onChange(JSON.parse(e.target.value)); } catch {} }}
          style={{ width: '100%', minHeight: 60, background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 6, padding: '6px 10px', color: '#e0e0e0', fontSize: 12, fontFamily: 'monospace', resize: 'vertical' }} />
      </div>
    );
  }
  return null;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd packages/templates/playground && npx tsc --noEmit --pretty false
```

- [ ] **Step 4: Commit**

```bash
git add packages/templates/playground/components/PlayerWrapper.tsx packages/templates/playground/components/PropsEditor.tsx
git commit -m "feat(templates): add PlayerWrapper and PropsEditor components"
```

---

### Task 5: Template Gallery view

**Files:**
- Create: `packages/templates/playground/components/TemplateGallery.tsx`

- [ ] **Step 1: Create TemplateGallery.tsx**

Create `packages/templates/playground/components/TemplateGallery.tsx`:

This component renders:
1. **Filter bar** at top: text search input, category dropdown (`<select>` with "All" + unique categories from templates), theme dropdown ("All" + "Unthemed" + theme names)
2. **Grid** of template cards below filters

Each card shows:
- Template name (bold)
- Description (truncated, muted color)
- Category badge
- Theme badges (if any)
- A small Remotion `<Player>` (paused at frame 0, ~240px wide, no controls) as a thumbnail
- Click handler calls `onSelectTemplate(templateId)`

Props interface:
```typescript
interface TemplateGalleryProps {
  templates: TemplateEntry[];
  themes: ThemeDefinition[];
  onSelectTemplate: (id: string) => void;
  onSelectTheme: (slug: string) => void;
}
```

Filter logic: all three filters (search, category, theme) are AND-combined. The theme filter checks `template.themes.includes(selectedThemeSlug)`. "Unthemed" matches templates where `template.themes.length === 0`.

Grid layout: use CSS grid with `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))` and `gap: 16px`.

For the thumbnail `<Player>`: use the `PlayerWrapper` component's underlying logic but simplified — just a `<Player>` with `controls={false}`, `autoPlay={false}`, small `compositionWidth/Height` (still 1080x1080 but render at 240px via CSS `width`), and `durationInFrames={30 * 12}`. Lazy-load the component on mount.

- [ ] **Step 2: Verify Vite renders the gallery**

Temporarily wire `TemplateGallery` into `App.tsx`, run the playground, and verify templates appear as cards with filters.

- [ ] **Step 3: Commit**

```bash
git add packages/templates/playground/components/TemplateGallery.tsx
git commit -m "feat(templates): add TemplateGallery view with filters"
```

---

### Task 6: Template Detail view

**Files:**
- Create: `packages/templates/playground/components/TemplateDetail.tsx`

- [ ] **Step 1: Create TemplateDetail.tsx**

Create `packages/templates/playground/components/TemplateDetail.tsx`:

Layout: flex row, center + right sidebar.

```typescript
interface TemplateDetailProps {
  template: TemplateEntry;
  themes: ThemeDefinition[];
  onBack: () => void;
  onSelectTheme: (slug: string) => void;
}
```

**Left/center area:**
- Back button ("← Back to gallery") calling `onBack()`
- Template name as heading
- Aspect ratio `<ButtonGroup>` (1:1, 9:16, 16:9) — state managed locally
- Duration `<ButtonGroup>` (6s, 12s, 20s, 30s) — state managed locally
- Theme badges: for each slug in `template.themes`, render a clickable badge with the theme name (look up in `themes` array). Clicking calls `onSelectTheme(slug)`.
- `<PlayerWrapper>` with the template, current props, selected aspect, selected duration

**Right sidebar (380px):**
- `<PropsEditor>` with the template, current props, `onUpdateProp`, `onReset`

Props state: managed locally with `useState<Record<string, any>>(() => ({ ...template.defaultProps }))`. Reset restores from `template.defaultProps`.

The `onUpdateProp` callback handles 1-3 level deep path updates (same logic as old playground lines 284-299).

- [ ] **Step 2: Verify detail view works end-to-end**

Wire into `App.tsx`, navigate from gallery → detail, verify:
- Player renders and plays
- Props editor controls change the template in real-time
- Aspect and duration toggles work
- Back button returns to gallery

- [ ] **Step 3: Commit**

```bash
git add packages/templates/playground/components/TemplateDetail.tsx
git commit -m "feat(templates): add TemplateDetail view with props editor"
```

---

### Task 7: PaletteSwatches and Theme Browser view

**Files:**
- Create: `packages/templates/playground/components/PaletteSwatches.tsx`
- Create: `packages/templates/playground/components/ThemeBrowser.tsx`

- [ ] **Step 1: Create PaletteSwatches.tsx**

Create `packages/templates/playground/components/PaletteSwatches.tsx`:

Simple component that renders a theme's `colorPalette` as a row of color swatches.

```typescript
interface PaletteSwatchesProps {
  palette: Record<string, string>;
}

export function PaletteSwatches({ palette }: PaletteSwatchesProps) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {Object.entries(palette).map(([name, color]) => (
        <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 8,
            background: color, border: '1px solid rgba(255,255,255,0.1)',
          }} />
          <span style={{ fontSize: 10, color: '#888' }}>{name}</span>
          <span style={{ fontSize: 9, color: '#555', fontFamily: 'monospace' }}>{color}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create ThemeBrowser.tsx**

Create `packages/templates/playground/components/ThemeBrowser.tsx`:

Layout: flex row, left sidebar (280px) + center panel.

```typescript
interface ThemeBrowserProps {
  themes: ThemeDefinition[];
  templates: TemplateEntry[];
  initialThemeSlug?: string;
  onSelectTemplate: (id: string) => void;
}
```

**Left sidebar:**
- List of themes. Each is a button showing theme name and description snippet. Clicking sets `selectedSlug` state.
- Active theme is highlighted with accent color.

**Center panel (selected theme):**
- Theme name as heading
- Description paragraph
- Style guidance in a bordered box (like a blockquote)
- `<PaletteSwatches>` with the theme's `colorPalette`
- Font recommendations: render each entry (heading, body, accent) with the font name displayed in a styled row
- **Themed templates grid**: filter `templates` where `t.themes.includes(selectedSlug)`. Render each as a small `<Player>` poster frame (same thumbnail approach as gallery). If no templates belong to the theme yet, show "No templates assigned to this theme yet" message. Each thumbnail clickable → calls `onSelectTemplate`.

Initialize `selectedSlug` from `initialThemeSlug` prop (for deep-linking from theme badges in detail view), or first theme in list.

- [ ] **Step 3: Verify theme browser works**

Wire into `App.tsx`, verify:
- Theme list loads from `themes/*.json`
- Selecting a theme shows its metadata and color swatches
- Templates belonging to the theme appear in the grid
- Clicking a template thumbnail navigates to detail view

- [ ] **Step 4: Commit**

```bash
git add packages/templates/playground/components/PaletteSwatches.tsx packages/templates/playground/components/ThemeBrowser.tsx
git commit -m "feat(templates): add ThemeBrowser view with palette swatches"
```

---

### Task 8: Wire up App.tsx with tab navigation

**Files:**
- Modify: `packages/templates/playground/App.tsx`

- [ ] **Step 1: Implement App.tsx with full view routing**

Replace the placeholder `App.tsx` with the full implementation:

```typescript
import React, { useState, useMemo } from 'react';
import { discoverTemplates, discoverThemes } from './lib/discover';
import type { View } from './lib/types';
import { TemplateGallery } from './components/TemplateGallery';
import { TemplateDetail } from './components/TemplateDetail';
import { ThemeBrowser } from './components/ThemeBrowser';

const TABS = [
  { key: 'gallery', label: 'Templates' },
  { key: 'themes', label: 'Themes' },
] as const;

export function App() {
  const templates = useMemo(discoverTemplates, []);
  const themes = useMemo(discoverThemes, []);
  const [view, setView] = useState<View>({ type: 'gallery' });

  const activeTab = view.type === 'themes' ? 'themes' : 'gallery';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        borderBottom: '1px solid #1e1e2e', padding: '0 16px',
        background: '#0c0c14', flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#8B5CF6', marginRight: 24, padding: '12px 0' }}>
          Viona Templates
        </span>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key === 'gallery' ? { type: 'gallery' } : { type: 'themes' })}
            style={{
              padding: '12px 16px', border: 'none', cursor: 'pointer',
              background: 'transparent', fontSize: 13, fontWeight: 500,
              color: activeTab === tab.key ? '#c4b5fd' : '#666',
              borderBottom: activeTab === tab.key ? '2px solid #8B5CF6' : '2px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: '#444' }}>
          {templates.length} templates · {themes.length} themes
        </span>
      </div>

      {/* View content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {view.type === 'gallery' && (
          <TemplateGallery
            templates={templates}
            themes={themes}
            onSelectTemplate={(id) => setView({ type: 'detail', templateId: id })}
            onSelectTheme={(slug) => setView({ type: 'themes', themeSlug: slug })}
          />
        )}
        {view.type === 'detail' && (
          <TemplateDetail
            template={templates.find((t) => t.id === view.templateId)!}
            themes={themes}
            onBack={() => setView({ type: 'gallery' })}
            onSelectTheme={(slug) => setView({ type: 'themes', themeSlug: slug })}
          />
        )}
        {view.type === 'themes' && (
          <ThemeBrowser
            themes={themes}
            templates={templates}
            initialThemeSlug={view.themeSlug}
            onSelectTemplate={(id) => setView({ type: 'detail', templateId: id })}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Full end-to-end test**

Run `pnpm --filter @viona/templates playground` and verify:
1. Tab bar shows "Templates" and "Themes" tabs with counts
2. Gallery view shows template cards with filters
3. Clicking a card navigates to detail view with working player and props editor
4. Back button returns to gallery
5. Themes tab shows theme list, selecting a theme shows metadata + palette + themed templates
6. Theme badges in detail view navigate to theme browser
7. Template thumbnails in theme browser navigate to detail view

- [ ] **Step 3: Commit**

```bash
git add packages/templates/playground/App.tsx
git commit -m "feat(templates): wire up App with tab navigation and all views"
```

---

### Task 9: Clean up old playground from workspace

**Files:**
- Delete: `packages/worker/workspace/src/playground.tsx`
- Delete: `packages/worker/workspace/index.html`
- Delete: `packages/worker/workspace/vite.config.ts`
- Delete: `packages/worker/workspace/postcss.config.mjs`
- Modify: `packages/worker/workspace/package.json`

- [ ] **Step 1: Delete old playground files**

```bash
cd packages/worker/workspace
rm src/playground.tsx index.html vite.config.ts postcss.config.mjs
```

- [ ] **Step 2: Clean up workspace package.json**

In `packages/worker/workspace/package.json`:
- Remove the `"playground": "vite"` line from `"scripts"`
- Remove `"@vitejs/plugin-react": "^6.0.1"` from `"devDependencies"`
- Remove `"vite": "^8.0.1"` from `"devDependencies"`

- [ ] **Step 3: Verify workspace Remotion commands still work**

```bash
cd packages/worker/workspace
pnpm dev:templates
```
Expected: Remotion Studio opens with templates. The studio uses `remotion` CLI, not Vite — should be unaffected.

- [ ] **Step 4: Verify new playground still works**

```bash
pnpm --filter @viona/templates playground
```
Expected: Playground opens on port 3200 with all views functional.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/workspace/
git commit -m "chore: remove old Vite playground from workspace"
```
