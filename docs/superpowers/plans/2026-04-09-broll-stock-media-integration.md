# B-Roll Stock Media Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add stock B-roll footage/images from Pexels as a first-class visual mode alongside generated animations, with theme-aware display components and a new Asset Scout pipeline phase.

**Architecture:** The Planner gains a `visualMode` field per scene (animation/broll/hybrid). A new Asset Scout subagent (Phase 3.5) searches Pexels and downloads assets. 12 pre-built Remotion display components render B-roll with theme-aware treatments (borders, grain, frames). The Layout Editor places broll items on the timeline. Existing phases adapt minimally.

**Tech Stack:** TypeScript, React, Remotion, MCP tools (Zod schemas), Pexels API, Markdown prompts

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `packages/sandbox/template/src/items/broll/BrollItem.tsx` | Router component — reads displayMode, delegates to correct display component |
| `packages/sandbox/template/src/items/broll/BrollFullscreen.tsx` | Full 1080x1920 bleed display |
| `packages/sandbox/template/src/items/broll/BrollLetterboxed.tsx` | 16:9 centered with solid color bars |
| `packages/sandbox/template/src/items/broll/BrollLetterboxedCaptions.tsx` | Letterboxed with caption area in bars |
| `packages/sandbox/template/src/items/broll/BrollRoundedFloat.tsx` | Rounded-corner clip on colored background |
| `packages/sandbox/template/src/items/broll/BrollPolaroid.tsx` | Polaroid-style frame with tilt |
| `packages/sandbox/template/src/items/broll/BrollFilmTreatment.tsx` | Full-screen with grain/VHS/desaturated filters |
| `packages/sandbox/template/src/items/broll/BrollStacked50.tsx` | 50/50 split B-roll top, speaker bottom |
| `packages/sandbox/template/src/items/broll/BrollStacked70.tsx` | 70/30 split B-roll dominant |
| `packages/sandbox/template/src/items/broll/BrollSpeakerPip.tsx` | Full-screen B-roll with speaker PiP corner |
| `packages/sandbox/template/src/items/broll/BrollTripleStack.tsx` | 3 clips stacked vertically |
| `packages/sandbox/template/src/items/broll/BrollGrid.tsx` | 2x2 grid of 4 clips |
| `packages/sandbox/template/src/items/broll/BrollGreenscreen.tsx` | B-roll as speaker background via matte |
| `packages/sandbox/template/src/items/broll/types.ts` | Shared types: BrollDisplayMode, BrollTreatment, BrollItemData |
| `packages/sandbox/template/src/items/broll/filters/GrainOverlay.tsx` | Film grain SVG filter component |
| `packages/sandbox/template/src/items/broll/filters/VhsEffect.tsx` | VHS scanline + tracking effect |
| `packages/sandbox/template/src/items/broll/filters/RoughEdgeMask.tsx` | feTurbulence rough edge mask |
| `packages/sandbox/template/src/items/broll/index.ts` | Barrel export for broll directory |
| `packages/sandbox/src/prompts/asset-scout/system.md` | Asset Scout agent system prompt |
| `packages/worker/src/prompts/themes/vox/broll-dna.md` | Vox theme B-roll DNA |
| `packages/worker/src/prompts/themes/magazine/broll-dna.md` | Magazine theme B-roll DNA |

### Modified Files

| File | What Changes |
|------|-------------|
| `packages/mcp-servers/src/asset-server.ts` | Extend `search_pexels` with `mediaType` param; rename `download_stock_photo` → `download_stock_asset` with video support and broll subdirectory |
| `packages/sandbox/template/src/items/index.tsx` | Add BrollItem export |
| `packages/sandbox/template/src/PlayerComposition.tsx` | Add `case 'broll'` to ItemRenderer switch + premount config |
| `packages/sandbox/src/orchestrator.ts` | Add asset_scout agent definition; update ASSET_TOOL_NAMES for renamed tool; add Phase 3.5 dispatch to orchestrator prompt |
| `packages/sandbox/src/prompts/orchestrator/system.md` | Add Phase 3.5 dispatch instructions between Planning and Setup |
| `packages/sandbox/src/prompts/planner/system.md` | Add `visualMode` field to per-scene schema; add broll schema variant; update self-verification checklist |
| `packages/sandbox/src/prompts/planner/examples/good-plan.md` | Add example broll and hybrid scenes |
| `packages/sandbox/src/prompts/setup-agent/system.md` | Add broll scene handling (add manifest item, no skeleton file) |
| `packages/sandbox/src/prompts/layout-editor/system.md` | Add broll item placement rules, speaker transform for stacked/PiP broll |
| `packages/sandbox/src/workspace-init.ts` | Add `broll-dna.md` to DNA file copy list |
| `apps/web/src/features/editor-v2/store/types.ts` | Extend BrollItemData with displayMode, treatment, attribution fields |

---

## Task 1: Extend Pexels API — Video Search + Asset Download

**Files:**
- Modify: `packages/mcp-servers/src/asset-server.ts:375-546`

- [ ] **Step 1: Add `mediaType` parameter to `search_pexels` tool**

In `packages/mcp-servers/src/asset-server.ts`, find the `search_pexels` registration (line 376). Extend the input schema and handler:

```typescript
// -- search_pexels ----------------------------------------------------------
server.registerTool(
  "search_pexels",
  {
    description:
      "Search Pexels for stock photos or videos. Returns a list of results with download URLs. Requires PEXELS_API_KEY env var.",
    inputSchema: {
      query: z
        .string()
        .describe("Search query (e.g. 'nature landscape sunset')"),
      count: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .default(5)
        .describe("Number of results (default 5, max 10)"),
      mediaType: z
        .enum(["photo", "video"])
        .optional()
        .default("photo")
        .describe("Search for photos or videos (default: photo)"),
    },
  },
  async ({ query, count, mediaType }: { query: string; count: number; mediaType: "photo" | "video" }) => {
    try {
      if (!PEXELS_API_KEY) {
        return {
          content: [
            {
              type: "text" as const,
              text: "PEXELS_API_KEY not configured. Please set the environment variable.",
            },
          ],
          isError: true,
        };
      }

      const params = new URLSearchParams({
        query,
        per_page: String(count || 5),
        orientation: "landscape",
      });

      if (mediaType === "video") {
        // Pexels Video API
        const res = await fetch(`https://api.pexels.com/videos/search?${params}`, {
          headers: { Authorization: PEXELS_API_KEY },
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
        });
        if (!res.ok)
          throw new Error(`Pexels Video API ${res.status}: ${res.statusText}`);
        const data = (await res.json()) as {
          videos?: Array<{
            id: number;
            url?: string;
            user?: { name?: string };
            duration: number;
            width: number;
            height: number;
            video_files?: Array<{
              id: number;
              quality: string;
              file_type: string;
              width: number;
              height: number;
              link: string;
            }>;
          }>;
        };
        const results = (data.videos || []).map((video) => {
          // Pick the best HD mp4 file
          const hdFile = video.video_files
            ?.filter(f => f.file_type === 'video/mp4')
            ?.sort((a, b) => b.width - a.width)
            ?.[0];
          return {
            id: video.id,
            description: `Pexels video #${video.id}`,
            urls: {
              original: hdFile?.link || '',
              hd: hdFile?.link || '',
            },
            photographer: video.user?.name || "Unknown",
            width: hdFile?.width || video.width,
            height: hdFile?.height || video.height,
            duration: video.duration,
            mediaType: 'video' as const,
          };
        });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(results, null, 2) },
          ],
        };
      }

      // Photo search (existing behavior)
      const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
        headers: { Authorization: PEXELS_API_KEY },
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      });
      if (!res.ok)
        throw new Error(`Pexels API ${res.status}: ${res.statusText}`);
      const data = (await res.json()) as {
        photos?: Array<{
          id: number;
          alt?: string;
          src?: { original?: string; large?: string; medium?: string };
          photographer?: string;
          width: number;
          height: number;
        }>;
      };
      const results = (data.photos || []).map((photo) => ({
        id: photo.id,
        description: photo.alt || "No description",
        urls: {
          original: photo.src?.original,
          large: photo.src?.large,
          medium: photo.src?.medium,
        },
        photographer: photo.photographer || "Unknown",
        width: photo.width,
        height: photo.height,
        mediaType: 'photo' as const,
      }));
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(results, null, 2) },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error searching Pexels: ${errorMessage(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);
```

- [ ] **Step 2: Rename `download_stock_photo` to `download_stock_asset` with video support**

Replace the `download_stock_photo` registration (line 464) with:

```typescript
// -- download_stock_asset ---------------------------------------------------
server.registerTool(
  "download_stock_asset",
  {
    description:
      "Download a stock photo or video from Pexels and save to public/assets/broll/. Use after search_pexels to download a chosen asset.",
    inputSchema: {
      url: z
        .string()
        .url()
        .describe("The asset download URL from search results"),
      filename: z
        .string()
        .describe("Target filename (e.g. 'hero-photo.jpg' or 'city-traffic.mp4')"),
      source: z
        .enum(["pexels"])
        .default("pexels")
        .describe("Stock service the URL is from"),
      photographer: z
        .string()
        .optional()
        .describe("Photographer name for attribution"),
    },
  },
  async ({
    url,
    filename,
    source,
    photographer,
  }: {
    url: string;
    filename: string;
    source: "pexels";
    photographer?: string;
  }) => {
    try {
      const validUrl = validateUrl(url);
      const safeName = sanitizeFilename(filename);
      const brollDir = path.join(ASSETS_DIR, 'broll');
      await mkdir(brollDir, { recursive: true });

      const headers: FetchHeaders = {};
      if (source === "pexels" && PEXELS_API_KEY) {
        headers["Authorization"] = PEXELS_API_KEY;
      }

      const buf = await safeFetch(validUrl, headers);
      const dest = path.join(brollDir, safeName);
      await writeFile(dest, buf);

      // Probe dimensions and duration for video files
      const ext = path.extname(safeName).toLowerCase();
      const isVideo = ['.mp4', '.webm', '.mov'].includes(ext);
      let width: number | undefined;
      let height: number | undefined;
      let durationMs: number | undefined;

      try {
        const dims = await probeDimensions(dest);
        width = dims.width;
        height = dims.height;
      } catch {}

      if (isVideo) {
        try {
          durationMs = await probeVideoDurationMs(dest);
        } catch {}
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              path: `public/assets/broll/${safeName}`,
              staticFile: `assets/broll/${safeName}`,
              size: buf.length,
              source,
              mediaType: isVideo ? 'video' : 'image',
              width,
              height,
              durationMs,
              photographer: photographer || 'Unknown',
              attribution: "Photo/Video from Pexels (https://pexels.com)",
            }),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error downloading stock asset: ${errorMessage(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);
```

- [ ] **Step 3: Update ASSET_TOOL_NAMES in orchestrator**

In `packages/sandbox/src/orchestrator.ts`, line 107, rename the tool reference:

```typescript
// OLD:
'mcp__assets__download_stock_photo',
// NEW:
'mcp__assets__download_stock_asset',
```

- [ ] **Step 4: Commit**

```bash
git add packages/mcp-servers/src/asset-server.ts packages/sandbox/src/orchestrator.ts
git commit -m "feat: extend Pexels API with video search + rename download_stock_asset"
```

---

## Task 2: B-Roll Types and Shared Filters

**Files:**
- Create: `packages/sandbox/template/src/items/broll/types.ts`
- Create: `packages/sandbox/template/src/items/broll/filters/GrainOverlay.tsx`
- Create: `packages/sandbox/template/src/items/broll/filters/VhsEffect.tsx`
- Create: `packages/sandbox/template/src/items/broll/filters/RoughEdgeMask.tsx`

- [ ] **Step 1: Create B-roll types**

```typescript
// packages/sandbox/template/src/items/broll/types.ts

export type BrollDisplayMode =
  | 'fullscreen-cutaway'
  | 'letterboxed'
  | 'letterboxed-captions'
  | 'rounded-float'
  | 'polaroid'
  | 'film-treatment'
  | 'stacked-50'
  | 'stacked-70'
  | 'speaker-pip'
  | 'triple-stack'
  | 'grid-2x2'
  | 'greenscreen-bg';

export type BrollFilter = 'none' | 'grain' | 'vhs' | 'desaturated' | 'duotone';

export interface BrollTreatment {
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  tilt?: number;
  filter?: BrollFilter;
  filterIntensity?: number;  // 0-1
  roughEdges?: boolean;
}

export interface BrollAttribution {
  photographer: string;
  source: 'pexels';
  url: string;
}

export interface BrollItemData {
  src: string;
  mediaType: 'image' | 'video';
  displayMode: BrollDisplayMode;
  treatment: BrollTreatment;
  attribution?: BrollAttribution;
  // Multi-clip modes: array of additional sources
  additionalSrcs?: string[];
}

export interface BrollDisplayProps {
  data: BrollItemData;
  assets: Record<string, string>;
}

/** Theme-specific default treatments */
export const THEME_DEFAULTS: Record<string, BrollTreatment> = {
  vox: {
    filter: 'grain',
    filterIntensity: 0.3,
    roughEdges: true,
    borderRadius: 0,
  },
  magazine: {
    filter: 'none',
    roughEdges: false,
    borderRadius: 8,
    borderColor: '#FFFFFF',
  },
};
```

- [ ] **Step 2: Create GrainOverlay filter**

```tsx
// packages/sandbox/template/src/items/broll/filters/GrainOverlay.tsx
import React, { useMemo } from 'react';
import { useCurrentFrame } from 'remotion';

interface GrainOverlayProps {
  intensity?: number; // 0-1, default 0.3
}

export const GrainOverlay: React.FC<GrainOverlayProps> = ({ intensity = 0.3 }) => {
  const frame = useCurrentFrame();
  // Cycle through 3 grain seeds to prevent static grain (Vox DNA: 2-3 textures/sec)
  const seed = useMemo(() => (Math.floor(frame / 10) % 3) + 1, [frame]);

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        mixBlendMode: 'overlay',
        opacity: intensity,
      }}
    >
      <filter id={`grain-${seed}`}>
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.65"
          numOctaves={3}
          seed={seed}
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
    </svg>
  );
};
```

- [ ] **Step 3: Create VhsEffect filter**

```tsx
// packages/sandbox/template/src/items/broll/filters/VhsEffect.tsx
import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

interface VhsEffectProps {
  intensity?: number; // 0-1
}

export const VhsEffect: React.FC<VhsEffectProps> = ({ intensity = 0.5 }) => {
  const frame = useCurrentFrame();
  // Subtle scanline offset that shifts over time
  const scanOffset = interpolate(frame % 120, [0, 120], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity: intensity,
      }}
    >
      {/* Scanlines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,0.15) 2px,
            rgba(0,0,0,0.15) 4px
          )`,
          transform: `translateY(${scanOffset % 4}px)`,
        }}
      />
      {/* Slight chromatic aberration via box-shadow on a transparent overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          boxShadow: 'inset 2px 0 0 rgba(255,0,0,0.08), inset -2px 0 0 rgba(0,0,255,0.08)',
        }}
      />
    </div>
  );
};
```

- [ ] **Step 4: Create RoughEdgeMask filter**

```tsx
// packages/sandbox/template/src/items/broll/filters/RoughEdgeMask.tsx
import React from 'react';

interface RoughEdgeMaskProps {
  /** Unique ID for SVG filter — required when multiple instances render */
  filterId?: string;
}

/**
 * SVG filter that adds rough/torn edges to a container.
 * Apply by wrapping content in a div with `filter: url(#rough-edge-{id})`.
 * Vox DNA: "Rough-edged, hand-crafted lower thirds with jagged texture"
 */
export const RoughEdgeMask: React.FC<RoughEdgeMaskProps> = ({ filterId = 'rough-edge' }) => {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        <filter id={filterId} x="-2%" y="-2%" width="104%" height="104%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.04"
            numOctaves={4}
            seed={42}
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={8}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
};
```

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/template/src/items/broll/
git commit -m "feat: add B-roll types and shared SVG filter components"
```

---

## Task 3: Core Display Components — Single Clip Modes

**Files:**
- Create: `packages/sandbox/template/src/items/broll/BrollFullscreen.tsx`
- Create: `packages/sandbox/template/src/items/broll/BrollLetterboxed.tsx`
- Create: `packages/sandbox/template/src/items/broll/BrollLetterboxedCaptions.tsx`
- Create: `packages/sandbox/template/src/items/broll/BrollRoundedFloat.tsx`
- Create: `packages/sandbox/template/src/items/broll/BrollPolaroid.tsx`
- Create: `packages/sandbox/template/src/items/broll/BrollFilmTreatment.tsx`

- [ ] **Step 1: Create BrollFullscreen**

```tsx
// packages/sandbox/template/src/items/broll/BrollFullscreen.tsx
import React from 'react';
import { Video, Img } from 'remotion';
import { resolveMediaSrc } from '../resolveMediaSrc';
import type { BrollDisplayProps } from './types';
import { GrainOverlay } from './filters/GrainOverlay';

export const BrollFullscreen: React.FC<BrollDisplayProps> = ({ data, assets }) => {
  const src = resolveMediaSrc(data.src, assets);
  const t = data.treatment;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {data.mediaType === 'video' ? (
        <Video
          src={src}
          volume={0}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      {t.filter === 'grain' && <GrainOverlay intensity={t.filterIntensity} />}
    </div>
  );
};
```

- [ ] **Step 2: Create BrollLetterboxed**

```tsx
// packages/sandbox/template/src/items/broll/BrollLetterboxed.tsx
import React from 'react';
import { Video, Img } from 'remotion';
import { resolveMediaSrc } from '../resolveMediaSrc';
import type { BrollDisplayProps } from './types';
import { GrainOverlay } from './filters/GrainOverlay';
import { RoughEdgeMask } from './filters/RoughEdgeMask';

export const BrollLetterboxed: React.FC<BrollDisplayProps> = ({ data, assets }) => {
  const src = resolveMediaSrc(data.src, assets);
  const t = data.treatment;
  const borderColor = t.borderColor || '#FFFFFF';
  // 16:9 clip in 9:16 canvas: clip height = width * 9/16 = ~607px at 1080w
  // Centered vertically in 1920px canvas
  const clipHeight = '31.6%'; // 607/1920
  const barHeight = '34.2%';  // (1920-607)/2/1920

  const filterId = 'broll-letterbox-rough';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: borderColor }}>
      {t.roughEdges && <RoughEdgeMask filterId={filterId} />}
      {/* Top bar */}
      <div style={{ width: '100%', height: barHeight }} />
      {/* Clip area */}
      <div
        style={{
          width: '100%',
          height: clipHeight,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: t.borderRadius || 0,
          ...(t.roughEdges ? { filter: `url(#${filterId})` } : {}),
        }}
      >
        {data.mediaType === 'video' ? (
          <Video src={src} volume={0} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        {t.filter === 'grain' && <GrainOverlay intensity={t.filterIntensity} />}
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Create BrollLetterboxedCaptions**

```tsx
// packages/sandbox/template/src/items/broll/BrollLetterboxedCaptions.tsx
import React from 'react';
import { Video, Img } from 'remotion';
import { resolveMediaSrc } from '../resolveMediaSrc';
import type { BrollDisplayProps } from './types';
import { GrainOverlay } from './filters/GrainOverlay';

/**
 * Letterboxed layout with extra space in bars for captions.
 * Clip sits in the middle ~35%, top and bottom bars are for text/captions.
 */
export const BrollLetterboxedCaptions: React.FC<BrollDisplayProps> = ({ data, assets }) => {
  const src = resolveMediaSrc(data.src, assets);
  const t = data.treatment;
  const borderColor = t.borderColor || '#FFFFFF';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: borderColor }}>
      {/* Top caption area — 25% */}
      <div style={{ width: '100%', height: '25%' }} />
      {/* Clip area — 40% (wider than standard letterbox to leave more caption space) */}
      <div
        style={{
          width: '100%',
          height: '40%',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: t.borderRadius || 0,
        }}
      >
        {data.mediaType === 'video' ? (
          <Video src={src} volume={0} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        {t.filter === 'grain' && <GrainOverlay intensity={t.filterIntensity} />}
      </div>
      {/* Bottom caption area — 35% */}
      <div style={{ width: '100%', height: '35%' }} />
    </div>
  );
};
```

- [ ] **Step 4: Create BrollRoundedFloat**

```tsx
// packages/sandbox/template/src/items/broll/BrollRoundedFloat.tsx
import React from 'react';
import { Video, Img } from 'remotion';
import { resolveMediaSrc } from '../resolveMediaSrc';
import type { BrollDisplayProps } from './types';
import { GrainOverlay } from './filters/GrainOverlay';

export const BrollRoundedFloat: React.FC<BrollDisplayProps> = ({ data, assets }) => {
  const src = resolveMediaSrc(data.src, assets);
  const t = data.treatment;
  const borderColor = t.borderColor || '#FFFFFF';
  const borderWidth = t.borderWidth || 6;
  const borderRadius = t.borderRadius || 16;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: borderColor,
      }}
    >
      <div
        style={{
          width: '90%',
          height: '55%',
          position: 'relative',
          overflow: 'hidden',
          borderRadius,
          border: `${borderWidth}px solid ${borderColor}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        }}
      >
        {data.mediaType === 'video' ? (
          <Video src={src} volume={0} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        {t.filter === 'grain' && <GrainOverlay intensity={t.filterIntensity} />}
      </div>
    </div>
  );
};
```

- [ ] **Step 5: Create BrollPolaroid**

```tsx
// packages/sandbox/template/src/items/broll/BrollPolaroid.tsx
import React from 'react';
import { Video, Img } from 'remotion';
import { resolveMediaSrc } from '../resolveMediaSrc';
import type { BrollDisplayProps } from './types';
import { GrainOverlay } from './filters/GrainOverlay';

export const BrollPolaroid: React.FC<BrollDisplayProps> = ({ data, assets }) => {
  const src = resolveMediaSrc(data.src, assets);
  const t = data.treatment;
  const tilt = t.tilt || 0;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f0',
      }}
    >
      <div
        style={{
          width: '80%',
          background: '#FFFFFF',
          padding: '24px 24px 64px 24px', // Thicker bottom — polaroid signature
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          transform: `rotate(${tilt}deg)`,
        }}
      >
        <div style={{ position: 'relative', overflow: 'hidden', aspectRatio: '4/3' }}>
          {data.mediaType === 'video' ? (
            <Video src={src} volume={0} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          {t.filter === 'grain' && <GrainOverlay intensity={t.filterIntensity} />}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 6: Create BrollFilmTreatment**

```tsx
// packages/sandbox/template/src/items/broll/BrollFilmTreatment.tsx
import React from 'react';
import { Video, Img } from 'remotion';
import { resolveMediaSrc } from '../resolveMediaSrc';
import type { BrollDisplayProps } from './types';
import { GrainOverlay } from './filters/GrainOverlay';
import { VhsEffect } from './filters/VhsEffect';

export const BrollFilmTreatment: React.FC<BrollDisplayProps> = ({ data, assets }) => {
  const src = resolveMediaSrc(data.src, assets);
  const t = data.treatment;
  const filterType = t.filter || 'grain';
  const intensity = t.filterIntensity ?? 0.3;

  // CSS filter for desaturated/duotone
  let cssFilter = '';
  if (filterType === 'desaturated') cssFilter = `saturate(${1 - intensity})`;
  if (filterType === 'duotone') cssFilter = `saturate(0) sepia(${intensity}) hue-rotate(180deg)`;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <div style={{ width: '100%', height: '100%', filter: cssFilter || undefined }}>
        {data.mediaType === 'video' ? (
          <Video src={src} volume={0} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>
      {filterType === 'grain' && <GrainOverlay intensity={intensity} />}
      {filterType === 'vhs' && <VhsEffect intensity={intensity} />}
    </div>
  );
};
```

- [ ] **Step 7: Commit**

```bash
git add packages/sandbox/template/src/items/broll/
git commit -m "feat: add 6 single-clip B-roll display components"
```

---

## Task 4: Display Components — Stacked, Multi-Clip, Greenscreen

**Files:**
- Create: `packages/sandbox/template/src/items/broll/BrollStacked50.tsx`
- Create: `packages/sandbox/template/src/items/broll/BrollStacked70.tsx`
- Create: `packages/sandbox/template/src/items/broll/BrollSpeakerPip.tsx`
- Create: `packages/sandbox/template/src/items/broll/BrollTripleStack.tsx`
- Create: `packages/sandbox/template/src/items/broll/BrollGrid.tsx`
- Create: `packages/sandbox/template/src/items/broll/BrollGreenscreen.tsx`

- [ ] **Step 1: Create BrollStacked50**

```tsx
// packages/sandbox/template/src/items/broll/BrollStacked50.tsx
import React from 'react';
import { Video, Img } from 'remotion';
import { resolveMediaSrc } from '../resolveMediaSrc';
import type { BrollDisplayProps } from './types';
import { GrainOverlay } from './filters/GrainOverlay';

/** B-roll fills top 50%, speaker occupies bottom 50% (handled by Layout Editor) */
export const BrollStacked50: React.FC<BrollDisplayProps> = ({ data, assets }) => {
  const src = resolveMediaSrc(data.src, assets);
  const t = data.treatment;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {data.mediaType === 'video' ? (
        <Video src={src} volume={0} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      {t.filter === 'grain' && <GrainOverlay intensity={t.filterIntensity} />}
    </div>
  );
};
```

- [ ] **Step 2: Create BrollStacked70**

```tsx
// packages/sandbox/template/src/items/broll/BrollStacked70.tsx
import React from 'react';
import { Video, Img } from 'remotion';
import { resolveMediaSrc } from '../resolveMediaSrc';
import type { BrollDisplayProps } from './types';
import { GrainOverlay } from './filters/GrainOverlay';

/** B-roll fills top 70%, speaker occupies bottom 30% (handled by Layout Editor) */
export const BrollStacked70: React.FC<BrollDisplayProps> = ({ data, assets }) => {
  const src = resolveMediaSrc(data.src, assets);
  const t = data.treatment;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {data.mediaType === 'video' ? (
        <Video src={src} volume={0} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      {t.filter === 'grain' && <GrainOverlay intensity={t.filterIntensity} />}
    </div>
  );
};
```

- [ ] **Step 3: Create BrollSpeakerPip**

```tsx
// packages/sandbox/template/src/items/broll/BrollSpeakerPip.tsx
import React from 'react';
import { Video, Img } from 'remotion';
import { resolveMediaSrc } from '../resolveMediaSrc';
import type { BrollDisplayProps } from './types';
import { GrainOverlay } from './filters/GrainOverlay';

/**
 * Full-screen B-roll with speaker in a small PiP corner.
 * Speaker PiP positioning is handled by Layout Editor (transforms on speaker video item).
 * This component only renders the B-roll background.
 */
export const BrollSpeakerPip: React.FC<BrollDisplayProps> = ({ data, assets }) => {
  const src = resolveMediaSrc(data.src, assets);
  const t = data.treatment;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {data.mediaType === 'video' ? (
        <Video src={src} volume={0} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      {t.filter === 'grain' && <GrainOverlay intensity={t.filterIntensity} />}
    </div>
  );
};
```

- [ ] **Step 4: Create BrollTripleStack**

```tsx
// packages/sandbox/template/src/items/broll/BrollTripleStack.tsx
import React from 'react';
import { Video, Img } from 'remotion';
import { resolveMediaSrc } from '../resolveMediaSrc';
import type { BrollDisplayProps } from './types';
import { GrainOverlay } from './filters/GrainOverlay';

/** 3 clips stacked vertically, each 33% of the canvas height */
export const BrollTripleStack: React.FC<BrollDisplayProps> = ({ data, assets }) => {
  const srcs = [data.src, ...(data.additionalSrcs || [])].slice(0, 3);
  const t = data.treatment;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {srcs.map((s, i) => {
        const resolved = resolveMediaSrc(s, assets);
        return (
          <div key={i} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {data.mediaType === 'video' ? (
              <Video src={resolved} volume={0} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Img src={resolved} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </div>
        );
      })}
      {t.filter === 'grain' && <GrainOverlay intensity={t.filterIntensity} />}
    </div>
  );
};
```

- [ ] **Step 5: Create BrollGrid**

```tsx
// packages/sandbox/template/src/items/broll/BrollGrid.tsx
import React from 'react';
import { Video, Img } from 'remotion';
import { resolveMediaSrc } from '../resolveMediaSrc';
import type { BrollDisplayProps } from './types';
import { GrainOverlay } from './filters/GrainOverlay';

/** 2x2 grid of 4 clips */
export const BrollGrid: React.FC<BrollDisplayProps> = ({ data, assets }) => {
  const srcs = [data.src, ...(data.additionalSrcs || [])].slice(0, 4);
  const t = data.treatment;
  const gap = t.borderWidth || 4;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap,
        background: t.borderColor || '#FFFFFF',
      }}
    >
      {srcs.map((s, i) => {
        const resolved = resolveMediaSrc(s, assets);
        return (
          <div key={i} style={{ position: 'relative', overflow: 'hidden', borderRadius: t.borderRadius || 0 }}>
            {data.mediaType === 'video' ? (
              <Video src={resolved} volume={0} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Img src={resolved} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </div>
        );
      })}
      {t.filter === 'grain' && <GrainOverlay intensity={t.filterIntensity} />}
    </div>
  );
};
```

- [ ] **Step 6: Create BrollGreenscreen**

```tsx
// packages/sandbox/template/src/items/broll/BrollGreenscreen.tsx
import React from 'react';
import { Video, Img } from 'remotion';
import { resolveMediaSrc } from '../resolveMediaSrc';
import type { BrollDisplayProps } from './types';
import { GrainOverlay } from './filters/GrainOverlay';

/**
 * B-roll as speaker background. Speaker matte composites in front (on V3).
 * This component renders the B-roll on V1 (behind matte).
 * Layout Editor handles placing the matte item on V3.
 */
export const BrollGreenscreen: React.FC<BrollDisplayProps> = ({ data, assets }) => {
  const src = resolveMediaSrc(data.src, assets);
  const t = data.treatment;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {data.mediaType === 'video' ? (
        <Video src={src} volume={0} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      {t.filter === 'grain' && <GrainOverlay intensity={t.filterIntensity} />}
    </div>
  );
};
```

- [ ] **Step 7: Commit**

```bash
git add packages/sandbox/template/src/items/broll/
git commit -m "feat: add 6 stacked/multi-clip/greenscreen B-roll display components"
```

---

## Task 5: BrollItem Router + PlayerComposition Integration

**Files:**
- Create: `packages/sandbox/template/src/items/broll/index.ts`
- Create: `packages/sandbox/template/src/items/broll/BrollItem.tsx`
- Modify: `packages/sandbox/template/src/items/index.tsx`
- Modify: `packages/sandbox/template/src/PlayerComposition.tsx:4,143-177,195-278`

- [ ] **Step 1: Create barrel export**

```typescript
// packages/sandbox/template/src/items/broll/index.ts
export { BrollItem } from './BrollItem';
export type { BrollItemData, BrollDisplayMode, BrollTreatment } from './types';
```

- [ ] **Step 2: Create BrollItem router**

```tsx
// packages/sandbox/template/src/items/broll/BrollItem.tsx
import React from 'react';
import type { BrollItemData, BrollDisplayMode } from './types';
import { BrollFullscreen } from './BrollFullscreen';
import { BrollLetterboxed } from './BrollLetterboxed';
import { BrollLetterboxedCaptions } from './BrollLetterboxedCaptions';
import { BrollRoundedFloat } from './BrollRoundedFloat';
import { BrollPolaroid } from './BrollPolaroid';
import { BrollFilmTreatment } from './BrollFilmTreatment';
import { BrollStacked50 } from './BrollStacked50';
import { BrollStacked70 } from './BrollStacked70';
import { BrollSpeakerPip } from './BrollSpeakerPip';
import { BrollTripleStack } from './BrollTripleStack';
import { BrollGrid } from './BrollGrid';
import { BrollGreenscreen } from './BrollGreenscreen';

interface BrollItemProps {
  data: BrollItemData;
  assets: Record<string, string>;
}

const DISPLAY_COMPONENTS: Record<BrollDisplayMode, React.FC<{ data: BrollItemData; assets: Record<string, string> }>> = {
  'fullscreen-cutaway': BrollFullscreen,
  'letterboxed': BrollLetterboxed,
  'letterboxed-captions': BrollLetterboxedCaptions,
  'rounded-float': BrollRoundedFloat,
  'polaroid': BrollPolaroid,
  'film-treatment': BrollFilmTreatment,
  'stacked-50': BrollStacked50,
  'stacked-70': BrollStacked70,
  'speaker-pip': BrollSpeakerPip,
  'triple-stack': BrollTripleStack,
  'grid-2x2': BrollGrid,
  'greenscreen-bg': BrollGreenscreen,
};

export const BrollItem: React.FC<BrollItemProps> = React.memo(({ data, assets }) => {
  const Component = DISPLAY_COMPONENTS[data.displayMode] || BrollFullscreen;
  return <Component data={data} assets={assets} />;
});
```

- [ ] **Step 3: Add BrollItem to items barrel export**

In `packages/sandbox/template/src/items/index.tsx`, add after line 10:

```typescript
export { BrollItem } from './broll';
```

- [ ] **Step 4: Add broll case to PlayerComposition.tsx**

In `packages/sandbox/template/src/PlayerComposition.tsx`, update the import on line 4 to include BrollItem:

```typescript
import { VideoItem, AudioItem, TextItem, ImageItem, SceneItem as SceneItemComponent, ShapeItem, CaptionItem, CinematicSubtitle, MatteItem, KineticLuxeCaption, BrollItem } from './items';
```

In the premount logic (around line 143-177), add broll with 2s premount (same as video — needs decode time):

Find the section that computes premount and add `'broll'` alongside `'video'`:

```typescript
// broll items need decode time like video
case 'broll':
  return 2; // 2s premount for media decode
```

In the ItemRenderer switch (line 195-278), add before the `case 'matte'` line:

```tsx
    case 'broll':
      return <BrollItem data={item.data} assets={assets} />;
```

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/template/src/items/broll/ packages/sandbox/template/src/items/index.tsx packages/sandbox/template/src/PlayerComposition.tsx
git commit -m "feat: integrate BrollItem router into PlayerComposition renderer"
```

---

## Task 6: Theme DNA Files — Vox + Magazine B-Roll DNA

**Files:**
- Create: `packages/worker/src/prompts/themes/vox/broll-dna.md`
- Create: `packages/worker/src/prompts/themes/magazine/broll-dna.md`
- Modify: `packages/sandbox/src/workspace-init.ts:444`

- [ ] **Step 1: Create Vox broll-dna.md**

```markdown
# Vox B-Roll DNA

## Philosophy

B-roll is evidence, not decoration. Every clip must serve the argument. The contrast between smooth 30fps footage and stuttered 12fps graphics IS the Vox feel — B-roll grounds the viewer in reality while graphics layer the analysis on top.

## Search Guidance

- Prefer archival, documentary, or journalistic footage over generic stock
- Search queries must be specific: "1990s Tokyo subway crowd" not "city people"
- Name real subjects: "Tesla factory assembly line" not "car manufacturing"
- When the transcript cites a source, search for that specific source material
- Prefer footage with natural lighting and imperfect framing — not studio-lit stock

## Treatments

- Film grain overlay at 25-35% opacity on ALL B-roll — unifies with Vox texture
- Rough edges (feTurbulence) on bordered/framed clips — no clean rectangles
- Border animations stutter at 12fps. Footage stays smooth 30fps.
- No drop shadows, no glossy surfaces, no gradients on borders
- Desaturated filter for historical/archival footage (0.3-0.5 intensity)

## Preferred Display Modes

| Use case | Display mode |
|----------|-------------|
| Dramatic evidence, "look at this" moments | `fullscreen-cutaway` |
| Cited sources, documents, data backing a claim | `letterboxed-captions` |
| Archival photos, historical images | `polaroid` |
| Speaker in a different environment / immersion | `greenscreen-bg` |
| Montage of examples, evidence pile | `triple-stack` or `grid-2x2` |
| Lifestyle/context establishing shots | `film-treatment` (grain) |

## Anti-Patterns

- Never use B-roll as visual filler — every clip must connect to what the speaker is saying
- Never use clean white borders (that's Magazine, not Vox)
- Never use rounded corners on B-roll frames
- Never dissolve or wipe into B-roll — hard cuts only
- Never use B-roll for abstract concepts that can be animated (data, processes, systems)
```

- [ ] **Step 2: Create Magazine broll-dna.md**

```markdown
# Magazine B-Roll DNA

## Philosophy

B-roll provides lifestyle context — aspirational, clean, well-lit. It adds visual richness to the speaker's narrative with polished, editorial framing.

## Search Guidance

- Prefer high-quality, well-lit, professional stock footage
- Clean compositions with good color grading
- Product shots, lifestyle scenes, urban landscapes
- Prefer footage that feels aspirational and premium

## Treatments

- Clean white or brand-color borders
- Subtle box-shadow for depth (0 4px 24px rgba(0,0,0,0.12))
- Smooth spring animations on frame entrance (SMOOTH preset)
- Border radius: 8px default
- No film grain, no rough edges, no VHS treatments, no desaturation

## Preferred Display Modes

| Use case | Display mode |
|----------|-------------|
| Product shots, hero visuals | `rounded-float` |
| Cinematic establishing shots | `letterboxed` |
| Tutorial walkthroughs, step-by-step | `stacked-50` |
| Before/after, comparison context | `stacked-70` |
| Multiple products or examples | `grid-2x2` |

## Anti-Patterns

- Never use rough edges or film grain (that's Vox, not Magazine)
- Never use desaturated or VHS filters
- Never use tilted polaroid frames
- Never leave B-roll without border treatment (no raw full-bleed unless fullscreen-cutaway)
```

- [ ] **Step 3: Add broll-dna.md to workspace-init DNA copy list**

In `packages/sandbox/src/workspace-init.ts`, line 444, update the `dnaFileNames` array:

```typescript
// OLD:
const dnaFileNames = ['planner-dna.md', 'animator-dna.md', 'caption-dna.md', 'anti-patterns.md'];
// NEW:
const dnaFileNames = ['planner-dna.md', 'animator-dna.md', 'caption-dna.md', 'anti-patterns.md', 'broll-dna.md'];
```

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/prompts/themes/vox/broll-dna.md packages/worker/src/prompts/themes/magazine/broll-dna.md packages/sandbox/src/workspace-init.ts
git commit -m "feat: add Vox + Magazine B-roll DNA files and workspace-init copy"
```

---

## Task 7: Asset Scout Agent Prompt

**Files:**
- Create: `packages/sandbox/src/prompts/asset-scout/system.md`

- [ ] **Step 1: Write the Asset Scout system prompt**

```markdown
<!-- packages/sandbox/src/prompts/asset-scout/system.md -->

<role>
You are the Asset Scout. You read SCENE_PLAN.md, find scenes that need stock footage (visualMode: broll or hybrid), search Pexels for matching assets, download the best matches, and write ASSET_MANIFEST.md mapping scenes to downloaded files.
</role>

<rules>
## Process

1. Read `/workspace/docs/SCENE_PLAN.md`
2. Read `/workspace/docs/guidelines/broll-dna.md` if it exists — this gives you theme-specific search guidance
3. For each scene with `Visual mode: broll` or `Visual mode: hybrid`:
   a. Extract the B-roll search queries from the scene
   b. Search Pexels using `search_pexels` with the first query
   c. If no good results, try the second and third queries
   d. Pick the best match based on relevance, quality, and dimensions
   e. Download using `download_stock_asset` to a descriptive filename
   f. For hybrid scenes with Asset count > 1, repeat search/download for each needed asset
4. Write `/workspace/docs/ASSET_MANIFEST.md` with all downloaded asset mappings

## Search Strategy

**For video B-roll (scenes that call for motion — traffic, people walking, machinery):**
- Use `search_pexels` with `mediaType: "video"`
- Prefer clips 5-15 seconds long (longer than the scene duration is fine — it will be trimmed)
- Prefer landscape orientation for 16:9 letterboxed modes
- Download the HD version (use the `original` or `hd` URL from results)
- Save as `.mp4` files

**For image B-roll (scenes that call for still visuals — photos, documents, products):**
- Use `search_pexels` with `mediaType: "photo"` (default)
- Prefer high resolution (use the `original` URL from results)
- Save as `.jpg` files

**For multi-clip modes (triple-stack, grid-2x2):**
- Run separate searches for each clip
- Use varied search queries to get visual diversity
- Download 3 assets for triple-stack, 4 for grid-2x2

## Naming Convention

Files go to `public/assets/broll/` with descriptive kebab-case names:
- `scene3-city-traffic.mp4`
- `scene5-newspaper-headline.jpg`
- `scene5-protest-crowd.jpg`

## ASSET_MANIFEST.md Format

Write the manifest with this exact structure per scene:

```
## Scene N: [Scene Name]
- **Visual mode:** broll | hybrid
- **Display mode:** [from SCENE_PLAN.md]
- **File:** /assets/broll/filename.ext
- **Type:** video | image
- **Dimensions:** WxH
- **Duration:** Nms (video only)
- **Attribution:** Photographer / Pexels (URL)
```

For multi-asset scenes:
```
## Scene N: [Scene Name]
- **Visual mode:** hybrid
- **Files:**
  1. /assets/broll/filename1.jpg (WxH, Photographer / Pexels)
  2. /assets/broll/filename2.jpg (WxH, Photographer / Pexels)
```
</rules>

<task>
1. Read SCENE_PLAN.md
2. Read broll-dna.md (if exists) for theme-specific guidance
3. For each broll/hybrid scene: search → select → download
4. Write ASSET_MANIFEST.md
5. Report completion with count of downloaded assets
</task>
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/asset-scout/system.md
git commit -m "feat: add Asset Scout agent system prompt"
```

---

## Task 8: Orchestrator Integration — Asset Scout Phase 3.5

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts:103-113,330-460`
- Modify: `packages/sandbox/src/prompts/orchestrator/system.md:208-290`

- [ ] **Step 1: Add Asset Scout agent definition to orchestrator.ts**

In `packages/sandbox/src/orchestrator.ts`, after the planner agent definition (around line 375) and before the caption_agent, add the asset_scout import and agent definition.

First, load the prompt. Find where other prompts are loaded (near the top of the file) and add:

```typescript
import { readFileSync } from 'fs';
// ... (find existing prompt loading pattern and add):
const assetScoutPrompt = loadPrompt('asset-scout/system.md');
```

Then add the agent definition in the `agents` block, after `planner` and before `caption_agent`:

```typescript
      // ---- Asset Scout (Phase 3.5) ----
      asset_scout: {
        description: 'Searches Pexels for stock footage/images needed by broll and hybrid scenes in SCENE_PLAN.md, downloads assets to workspace.',
        prompt: assetScoutPrompt,
        tools: [
          'Read', 'Write', 'Glob', 'Grep',
          'mcp__assets__search_pexels',
          'mcp__assets__download_stock_asset',
        ],
        model: 'opus',
        maxTurns: 30,
      },
```

- [ ] **Step 2: Update ASSET_TOOL_NAMES**

In `packages/sandbox/src/orchestrator.ts` line 107, replace `download_stock_photo` with `download_stock_asset`:

```typescript
const ASSET_TOOL_NAMES = [
  'mcp__assets__download_file',
  'mcp__assets__search_unsplash',
  'mcp__assets__search_pexels',
  'mcp__assets__download_stock_asset',  // was download_stock_photo
  'mcp__assets__get_speaker_position',
  'mcp__assets__auto_center_speaker',
  'mcp__assets__request_segmentation',
  'mcp__assets__check_segmentation_status',
  'mcp__assets__get_depth_compositing_info',
];
```

Also update the MCP server labels map if `download_stock_photo` appears there:

```typescript
// in MCP_SERVER_LABELS or tool-name-to-label maps
download_stock_asset: 'Downloading asset',
```

- [ ] **Step 3: Add Phase 3.5 dispatch to orchestrator system prompt**

In `packages/sandbox/src/prompts/orchestrator/system.md`, find the section between Phase 3 (Planning) completion and Phase 4 (Setup). Insert the Asset Scout phase:

After the planner completion / scene plan approval section (around line 262), add:

```markdown
### Phase 3.5: Asset Scout (CONDITIONAL)

After the scene plan is approved, check if ANY scene has `Visual mode: broll` or `Visual mode: hybrid`. If yes:

1. Output: "Finding footage..."
2. Dispatch `asset_scout` with:
   ```
   "Download stock footage for the broll and hybrid scenes in SCENE_PLAN.md.
    Theme: {theme_slug}. Read /workspace/docs/guidelines/broll-dna.md for search guidance."
   ```
3. After it returns, read `/workspace/docs/ASSET_MANIFEST.md` to verify assets were downloaded
4. Write: `echo "phase3.5-complete" > /workspace/.pipeline-phase`

If NO scenes have broll or hybrid visual mode, skip this phase entirely.
```

- [ ] **Step 4: Add Phase 3.5 to resume protocol**

In the phase tracking section of `orchestrator/system.md` (around line 143-159), add the phase3.5 check:

```markdown
- If `.pipeline-phase` contains `phase3-complete` but not `phase3.5-complete`: check for broll scenes → dispatch asset_scout if needed, or skip
- If `.pipeline-phase` contains `phase3.5-complete` but not `phase4-complete`: dispatch setup_agent
```

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/orchestrator.ts packages/sandbox/src/prompts/orchestrator/system.md
git commit -m "feat: add Asset Scout phase 3.5 to orchestrator pipeline"
```

---

## Task 9: Planner Prompt — visualMode Field

**Files:**
- Modify: `packages/sandbox/src/prompts/planner/system.md:156-242,312-339`
- Modify: `packages/sandbox/src/prompts/planner/examples/good-plan.md`

- [ ] **Step 1: Add visualMode to per-scene schema**

In `packages/sandbox/src/prompts/planner/system.md`, find the per-scene schema section (line 156). Add the `Visual mode` field after `Display mode`:

```markdown
**Display mode:** Fullscreen | Stacked [top%/bottom%] | Overlay
**Visual mode:** animation | broll | hybrid
```

Then add the conditional sections. After the `**Fork reason:**` line:

```markdown
**Fork reason:** [why this template fits — only if template is not "none"]

#### If Visual mode is `broll`:

Replace Template, Fork reason, Visual concept, Key data, Must show, and Animation brief with:

### B-roll search
[1-3 Pexels search queries ranked by priority. Be specific and descriptive — "1990s Tokyo subway crowd" not "city people".]

### B-roll display
[One of: fullscreen-cutaway | letterboxed | letterboxed-captions | rounded-float | polaroid | film-treatment | stacked-50 | stacked-70 | speaker-pip | triple-stack | grid-2x2 | greenscreen-bg]

### B-roll treatment
[Styling: border color/width, frame tilt, filter type (grain/vhs/desaturated/duotone), rough edges.
 Leave empty for theme defaults.]

#### If Visual mode is `hybrid`:

Keep Template, Visual concept, Animation brief as normal. Additionally add:

### B-roll search
[1-3 Pexels search queries for the assets the template needs]

### Asset count
[How many images/videos — e.g., "4 images" for a collage, "1 image" for spotlight]
```

- [ ] **Step 2: Add decision logic guidance**

After the per-scene schema section, add:

```markdown
### Choosing Visual Mode

**Can this concept be beautifully represented with animation?**

| Content type | Visual mode | Why |
|---|---|---|
| Abstract concepts, data viz, processes, metaphors | `animation` | Better as generated motion graphics |
| Concrete real-world subjects (places, objects, people) | `broll` | Better shown as real footage |
| Evidence/archival that needs annotation or arrangement | `hybrid` | Photo inside a template (collage, spotlight, filmstrip) |

When in doubt, prefer animation. B-roll is for moments where real-world footage genuinely adds credibility or visual grounding that animation cannot provide.
```

- [ ] **Step 3: Update self-verification checklist**

In the self-verification checklist section (line 312-339), add these items:

```markdown
- [ ] Every scene has a **Visual mode** field (animation, broll, or hybrid)
- [ ] Every broll scene has **B-roll search**, **B-roll display**, and **B-roll treatment** (no Template/Animation brief)
- [ ] Every hybrid scene has **B-roll search**, **Asset count**, AND a Template + Animation brief
- [ ] B-roll search queries are specific and descriptive (not generic like "city" or "people")
- [ ] No broll scene uses overlay placement vocabulary (overlay-large, center-card, etc.)
- [ ] Visual mode choices follow decision logic: abstract → animation, concrete → broll
- [ ] B-roll display modes match the scene's display mode logic (stacked broll uses stacked-50/stacked-70)
```

- [ ] **Step 4: Add broll examples to good-plan.md**

In `packages/sandbox/src/prompts/planner/examples/good-plan.md`, replace one of the middle scenes (e.g., Scene 3) with a broll example, and add a hybrid example. Insert after Scene 2:

```markdown
## Scene 3: Real-World Impact
**File:** (none — broll)
**Time:** 24000 – 34000ms
**Transcript:** "and you can see it everywhere — in gyms, in meal prep kitchens, in supplement stores"
**Display mode:** Fullscreen
**Visual mode:** broll

### Speaker layout
- Speaker: "opacity: 0" (fullscreen)

### Scene dimensions
- Width: 1080 Height: 1920

### Scene placement
- Placement: full-canvas

### Transition IN
- From: Stacked
- Transition: Stacked → Fullscreen

### Transition OUT
- To: Overlay
- Transition: Fullscreen → Overlay

### B-roll search
1. "gym workout fitness equipment close up"
2. "meal prep kitchen cooking healthy food"
3. "supplement store shelves protein"

### B-roll display
fullscreen-cutaway

### B-roll treatment
filter: grain, filterIntensity: 0.25
```

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/prompts/planner/system.md packages/sandbox/src/prompts/planner/examples/good-plan.md
git commit -m "feat: add visualMode field to planner per-scene schema"
```

---

## Task 10: Setup Agent + Layout Editor Prompt Updates

**Files:**
- Modify: `packages/sandbox/src/prompts/setup-agent/system.md`
- Modify: `packages/sandbox/src/prompts/layout-editor/system.md`

- [ ] **Step 1: Update Setup Agent for broll scenes**

In `packages/sandbox/src/prompts/setup-agent/system.md`, find the task workflow section (around line 379). Add handling for broll scenes:

```markdown
### Handling Visual Modes

When reading SCENE_PLAN.md, check each scene's **Visual mode**:

- **`animation`:** Create scene skeleton .tsx file as normal (current behavior)
- **`broll`:** Do NOT create a .tsx skeleton. Instead, add a broll manifest item using `add_item`:
  ```json
  {
    "type": "broll",
    "trackId": "overlay-track-id",
    "startMs": sceneStartMs,
    "endMs": sceneEndMs,
    "data": {
      "src": "/assets/broll/scene-name.ext",
      "mediaType": "video or image",
      "displayMode": "from SCENE_PLAN.md",
      "treatment": { from SCENE_PLAN.md or theme defaults }
    }
  }
  ```
  Read ASSET_MANIFEST.md first to get the actual file paths and metadata for each broll scene.
- **`hybrid`:** Create scene skeleton .tsx file as normal, but include downloaded asset paths in the DATA object:
  ```typescript
  const DATA = {
    photos: ['/assets/broll/scene5-photo1.jpg', '/assets/broll/scene5-photo2.jpg'],
    // ... other template data
  };
  ```
  Read ASSET_MANIFEST.md to get the file paths.
```

- [ ] **Step 2: Update Layout Editor for broll items**

In `packages/sandbox/src/prompts/layout-editor/system.md`, add a section for B-roll placement. Find the scene placement section (around line 144) and add:

```markdown
### B-Roll Item Placement

Broll items are already added to the manifest by the Setup Agent. The Layout Editor must:

1. Read `ASSET_MANIFEST.md` to verify assets exist
2. For broll items already in the manifest, apply the correct **transform** based on display mode:
   - `fullscreen-cutaway`: `{ x: 0, y: 0, width: CANVAS_W, height: CANVAS_H }`
   - `letterboxed` / `letterboxed-captions`: `{ x: 0, y: 0, width: CANVAS_W, height: CANVAS_H }` (component handles internal layout)
   - `rounded-float` / `polaroid` / `film-treatment`: `{ x: 0, y: 0, width: CANVAS_W, height: CANVAS_H }`
   - `stacked-50`: broll item gets `{ x: 0, y: 0, width: CANVAS_W, height: 960 }`, speaker video gets `{ y: 960, height: 960 }`
   - `stacked-70`: broll item gets `{ x: 0, y: 0, width: CANVAS_W, height: 1344 }`, speaker video gets `{ y: 1344, height: 576 }`
   - `speaker-pip`: broll item gets `{ x: 0, y: 0, width: CANVAS_W, height: CANVAS_H }`, speaker video gets `{ x: 780, y: 1560, width: 240, height: 320 }` with borderRadius
   - `greenscreen-bg`: broll item goes on V1 (background layer), matte on V3, same as depth overlay handling
   - `triple-stack` / `grid-2x2`: `{ x: 0, y: 0, width: CANVAS_W, height: CANVAS_H }` (component handles internal grid)

3. **Video cutting for broll scenes:** Same rules as animation scenes:
   - `fullscreen-cutaway` / `film-treatment`: CUT source video (same as fullscreen animation)
   - `stacked-50` / `stacked-70`: KEEP source video, reposition to bottom
   - `speaker-pip`: KEEP source video, resize to PiP dimensions
   - `greenscreen-bg`: CUT source video, use matte system
   - `letterboxed` / `letterboxed-captions` / `rounded-float` / `polaroid`: CUT source video (broll replaces the visual)
   - `triple-stack` / `grid-2x2`: CUT source video (full-screen multi-clip)

4. Broll items go on **V4** track (same as non-depth scene items), EXCEPT `greenscreen-bg` which goes on **V1**.
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/setup-agent/system.md packages/sandbox/src/prompts/layout-editor/system.md
git commit -m "feat: update Setup Agent and Layout Editor prompts for broll scenes"
```

---

## Task 11: Editor Store Types Update

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/types.ts:532-540`

- [ ] **Step 1: Extend BrollItemData interface**

In `apps/web/src/features/editor-v2/store/types.ts`, replace the existing `BrollItemData` interface (lines 532-540) with the expanded version:

```typescript
export type BrollDisplayMode =
  | 'fullscreen-cutaway'
  | 'letterboxed'
  | 'letterboxed-captions'
  | 'rounded-float'
  | 'polaroid'
  | 'film-treatment'
  | 'stacked-50'
  | 'stacked-70'
  | 'speaker-pip'
  | 'triple-stack'
  | 'grid-2x2'
  | 'greenscreen-bg';

export interface BrollTreatment {
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  tilt?: number;
  filter?: 'none' | 'grain' | 'vhs' | 'desaturated' | 'duotone';
  filterIntensity?: number;
  roughEdges?: boolean;
}

export interface BrollAttribution {
  photographer: string;
  source: 'pexels';
  url: string;
}

export interface BrollItemData {
  src: string;
  mediaType: 'image' | 'video';
  displayMode: BrollDisplayMode;
  treatment: BrollTreatment;
  attribution?: BrollAttribution;
  additionalSrcs?: string[];
  // Legacy fields (kept for backward compat with existing broll items)
  sourceType?: 'upload' | 'pexels';
  filename?: string;
  photographer?: string;
  previewUrl?: string;
  volume?: number;
  fileSize?: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/store/types.ts
git commit -m "feat: extend BrollItemData with displayMode, treatment, attribution"
```

---

## Task 12: Planner DNA Extensions — B-Roll Scene Vocabulary

**Files:**
- Modify: `packages/worker/src/prompts/themes/vox/planner-dna.md`
- Create or modify: `packages/worker/src/prompts/themes/magazine/planner-dna.md` (if it exists)

- [ ] **Step 1: Add B-roll scene vocabulary to Vox planner-dna.md**

In `packages/worker/src/prompts/themes/vox/planner-dna.md`, append at the end:

```markdown

## B-Roll Scene Vocabulary

When the transcript references concrete real-world subjects, use `broll` visual mode instead of animation. The contrast between smooth footage and stuttered graphics IS the Vox feel.

| Signal in transcript | Visual mode | Display mode |
|---|---|---|
| Speaker references a real place or object | broll | fullscreen-cutaway or letterboxed |
| "Look at this" / evidence citation / source document | broll | letterboxed-captions |
| Montage of real-world examples | broll | triple-stack or grid-2x2 |
| Photo that needs annotation, circling, highlighting | hybrid | vox-spotlight or vox-annotation template |
| Collage of people, products, or evidence | hybrid | vox-collage or vox-filmstrip template |
| Speaker should feel "on location" | broll | greenscreen-bg |
| Abstract concept, data, process, system | animation | (current behavior — never use broll for abstractions) |

Read `/workspace/docs/guidelines/broll-dna.md` for treatment and search guidance.
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/src/prompts/themes/vox/planner-dna.md
git commit -m "feat: add B-roll scene vocabulary to Vox planner DNA"
```

---

## Dependency Graph

```
Task 1 (Pexels API)  ──┐
Task 2 (Types+Filters) ─┤
                         ├─→ Task 5 (BrollItem Router + PlayerComposition)
Task 3 (Single Clips) ──┤
Task 4 (Stacked+Multi) ─┘

Task 6 (Theme DNA) ─────→ Task 7 (Asset Scout Prompt) ──→ Task 8 (Orchestrator Integration)

Task 9 (Planner Prompt) ─→ Task 10 (Setup + Layout Prompts)

Task 11 (Editor Types) — independent
Task 12 (Planner DNA) — independent, after Task 9
```

**Parallel groups:**
- Tasks 1, 2, 6, 9, 11 can all start in parallel
- Tasks 3, 4 depend on Task 2
- Task 5 depends on Tasks 2, 3, 4
- Task 7 depends on Task 6
- Task 8 depends on Tasks 1, 7
- Task 10 depends on Tasks 8, 9
- Task 12 depends on Task 9
