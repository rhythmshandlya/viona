# @viona/templates

Viona's template library. Each template is a standalone Remotion composition compiled into its own ESM bundle and served from S3 at runtime — consumers (web editor, sandbox, worker) never statically import template source.

## Architecture

```
┌──────────────────────────┐       ┌──────────────────────┐       ┌──────────────────────┐
│ src/templates/{slug}/    │──┬──▶ │ scripts/             │──────▶│ S3 bundle +          │
│  (TSX source + schema)   │  │    │  build-templates.ts  │       │ templates DB row     │
│                          │  │    │  upload-templates.ts │       │                      │
└──────────────────────────┘  │    └──────────────────────┘       └──────────┬───────────┘
                              │                                              │
                              ▼                                              ▼
               per-template ESM bundle                api exposes /templates + /templates/:slug/bundle
               with externals replaced by                                    │
               window.* globals                                              ▼
                                                   runtime-registry client (loadTemplate) in web,
                                                   sandbox, worker, render-service
                                                                             │
                                                                             ▼
                                                   loadTemplate(slug) → { meta, Component }
```

**Key invariant:** `src/templates/*` is *never* re-exported from `src/index.ts`. It's build input only. Consumers get template *metadata* from the api and template *code* from S3 bundles they fetch + eval at runtime.

## Runtime usage (in a React app)

```typescript
import { loadTemplate } from '@viona/templates';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as Remotion from 'remotion';

// Before loading a bundle, expose the externals the bundle will reach for.
// Template bundles replace `import ... from 'react'|'remotion'|...` with
// `window.React`/`window.Remotion` references at build time (see
// scripts/esbuild-globals-plugin.ts), so these must be set first.
(window as any).React = React;
(window as any).ReactDOM = ReactDOM;
(window as any).Remotion = Remotion;

const { Component, meta } = await loadTemplate('magazine-chart');
// <Component {...meta.defaultProps} />
```

Node consumers (sandbox, worker) pass `apiBase` explicitly:

```typescript
const { Component } = await loadTemplate('magazine-chart', {
  apiBase: `${process.env.API_CALLBACK_URL}/api`,
  resolveExternal: (mod) => ({
    'react': require('react'),
    'remotion': require('remotion'),
  })[mod] ?? (() => { throw new Error(`external ${mod} not provided`); })(),
});
```

## Authoring a new template

1. **Scaffold** `src/templates/{slug}/`:
   - `index.tsx` — default-exports a React component that accepts your props
   - `schema.ts` — exports a Zod schema for props (used to emit a JSON schema at build time)
   - `register.ts` — imports from `../../registry` and calls `registerTemplate({ meta, schema, defaultProps, getComponent, getFiles })`. Only `scripts/build-templates.ts` reads this.
   - Optional: `meta.ts`, `defaultProps.ts`, `assets/`, per-template helpers

2. **Declare any new npm deps** in `packages/templates/package.json` under `dependencies`. These never leak to consumers — they only exist so `scripts/build-templates.ts`'s esbuild can resolve them while bundling.

3. **Verify locally** with the playground Vite app:
   ```bash
   pnpm --filter @viona/templates playground
   ```

4. **Build + upload + screenshots** to prod:
   ```bash
   pnpm templates:publish:prod
   ```
   This runs `templates:build` (esbuild per-template ESM bundles with `scripts/esbuild-globals-plugin.ts` replacing `react`/`remotion`/etc. with `window.*`), uploads bundles + source to MinIO under `templates/{slug}/…`, upserts the DB `templates` row, and generates screenshots (headless Remotion render).

5. **Verify in prod**:
   ```bash
   curl -s https://api-production-18ab.up.railway.app/api/templates/{slug} | python -c "import json,sys; print(json.load(sys.stdin).keys())"
   curl -sI https://api-production-18ab.up.railway.app/api/templates/{slug}/bundle
   ```
   The detail endpoint returns the row; the bundle endpoint 302s to a presigned S3 URL.

## What NOT to do

- **Don't** `import Component from '@viona/templates/templates/my-template'` — that bypasses the registry and drags template transitive deps into the consumer's bundle. Use `loadTemplate(slug)` instead.
- **Don't** add a new dep required by one template to web's, api's, or worker's `package.json`. It belongs only in `packages/templates/package.json` and gets bundled into that template's S3 artifact.
- **Don't** import `registerTemplate`, `getTemplate` (sync), or `getTemplateFiles` from `@viona/templates` in runtime code. Those are retained for `scripts/build-templates.ts`'s own module graph only.

## Related scripts

| Script | Purpose |
|---|---|
| `pnpm --filter @viona/templates build` | Builds `dist/index.js` (tsup) + `dist/registry.json` (the thin public surface: types, runtime-registry client, shared hooks like `useScale`). |
| `pnpm --filter @viona/templates templates:build` | Builds per-template ESM bundles into `dist/bundles/`. esbuild + globalsPlugin. |
| `pnpm --filter @viona/templates templates:upload` | Reads `dist/bundles/manifest.json`, uploads bundles + source + assets to MinIO, upserts DB rows. |
| `pnpm --filter @viona/templates templates:screenshots` | Headless Remotion render → PNG → S3 `templates/{slug}/screenshot.png`. |
| `pnpm templates:publish:prod` | Root alias: builds + uploads + screenshots (runs against prod via Railway env). |
