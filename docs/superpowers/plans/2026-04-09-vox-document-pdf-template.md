# Vox Document PDF Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the vox-document template to render real PDFs with text-based fuzzy highlight matching and cinematic camera modes — no pixel coordinates needed from the agent.

**Architecture:** The template uses `pdfjs-dist` to extract text positions from the PDF at render time, fuzzy-matches agent-provided text snippets to find their bounding boxes, then renders `HighlighterMark` sweeps at those positions with mode-specific camera animations (overview, zoom, figure, paragraph).

**Tech Stack:** react-pdf, pdfjs-dist, Remotion (delayRender/continueRender), Vox shared library (HighlighterMark, ConstructionPaper, FilmGrain, highlighterSweep)

---

### Task 1: Fuzzy Match Utility

**Files:**
- Create: `packages/templates/src/templates/vox-document/components/fuzzy-match.ts`

- [ ] **Step 1: Create the fuzzy substring matcher**

```typescript
// packages/templates/src/templates/vox-document/components/fuzzy-match.ts

/**
 * Normalizes text for fuzzy comparison: lowercase, collapse whitespace, trim.
 */
export function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Computes character overlap ratio between two strings.
 * Returns 0-1 where 1 is perfect match.
 */
function overlapScore(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;
  let matches = 0;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  for (let i = 0; i < shorter.length; i++) {
    if (shorter[i] === longer[i]) matches++;
  }
  return matches / shorter.length;
}

/**
 * Finds the best fuzzy substring match of `query` within `fullText`.
 * Returns the start and end character indices in fullText, or null if no match above threshold.
 */
export function fuzzyFind(
  query: string,
  fullText: string,
  threshold = 0.6,
): { start: number; end: number; score: number } | null {
  const normQuery = normalize(query);
  const normFull = normalize(fullText);

  if (normQuery.length === 0 || normFull.length === 0) return null;

  // Try exact substring first
  const exactIdx = normFull.indexOf(normQuery);
  if (exactIdx !== -1) {
    return { start: exactIdx, end: exactIdx + normQuery.length, score: 1.0 };
  }

  // Sliding window fuzzy match
  const windowSize = normQuery.length;
  let bestScore = 0;
  let bestStart = 0;

  for (let i = 0; i <= normFull.length - windowSize; i++) {
    const window = normFull.substring(i, i + windowSize);
    const score = overlapScore(normQuery, window);
    if (score > bestScore) {
      bestScore = score;
      bestStart = i;
    }
  }

  // Also try windows slightly shorter/longer to handle length mismatches
  for (const delta of [-3, -2, -1, 1, 2, 3]) {
    const altSize = windowSize + delta;
    if (altSize <= 0 || altSize > normFull.length) continue;
    for (let i = 0; i <= normFull.length - altSize; i++) {
      const window = normFull.substring(i, i + altSize);
      const score = overlapScore(normQuery, window);
      if (score > bestScore) {
        bestScore = score;
        bestStart = i;
      }
    }
  }

  if (bestScore < threshold) return null;

  return {
    start: bestStart,
    end: bestStart + normQuery.length,
    score: bestScore,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/templates/src/templates/vox-document/components/fuzzy-match.ts
git commit -m "feat(vox-document): add fuzzy substring match utility"
```

---

### Task 2: PDF Text Map Hook

**Files:**
- Create: `packages/templates/src/templates/vox-document/components/usePdfTextMap.ts`

- [ ] **Step 1: Create the text extraction hook**

This hook uses pdfjs-dist directly (not react-pdf) to extract text content with positions from a PDF page. It integrates with Remotion's `delayRender`/`continueRender`.

```typescript
// packages/templates/src/templates/vox-document/components/usePdfTextMap.ts

import { useState, useEffect } from 'react';
import { pdfjs } from 'react-pdf';
import { fuzzyFind, normalize } from './fuzzy-match';

// Ensure worker is configured (PdfPage.tsx also does this, but hooks may run first)
if (!pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

// Remotion imports — safe for non-Remotion envs
let delayRender: (label: string) => number = () => 0;
let continueRender: (handle: number) => void = () => {};
try {
  const remotion = require('remotion');
  delayRender = remotion.delayRender;
  continueRender = remotion.continueRender;
} catch {}

export interface BBox {
  x: number;  // percentage of page width (0-100)
  y: number;  // percentage of page height (0-100)
  w: number;
  h: number;
}

interface TextItem {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PdfTextMap {
  items: TextItem[];
  ready: boolean;
  pageWidth: number;
  pageHeight: number;
  pageRatio: number;
  findText(query: string): BBox[];
  findBounds(query: string): BBox | null;
}

/**
 * Merges text items that matched a query into line-grouped BBoxes.
 * Items on the same Y line (within tolerance) are merged into one bar.
 */
function mergeIntoLines(items: TextItem[], tolerance = 1.5): BBox[] {
  if (items.length === 0) return [];

  // Sort by Y then X
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: BBox[] = [];
  let currentLine: BBox = {
    x: sorted[0].x,
    y: sorted[0].y,
    w: sorted[0].w,
    h: sorted[0].h,
  };

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (Math.abs(item.y - currentLine.y) <= tolerance) {
      // Same line — extend width
      const right = Math.max(currentLine.x + currentLine.w, item.x + item.w);
      currentLine.x = Math.min(currentLine.x, item.x);
      currentLine.w = right - currentLine.x;
      currentLine.h = Math.max(currentLine.h, item.h);
    } else {
      // New line
      lines.push(currentLine);
      currentLine = { x: item.x, y: item.y, w: item.w, h: item.h };
    }
  }
  lines.push(currentLine);
  return lines;
}

export function usePdfTextMap(pdfFile: string, pageNumber: number): PdfTextMap {
  const [state, setState] = useState<{
    items: TextItem[];
    ready: boolean;
    pageWidth: number;
    pageHeight: number;
  }>({ items: [], ready: false, pageWidth: 612, pageHeight: 792 });

  useEffect(() => {
    const handle = delayRender('Extracting PDF text map');
    const filePath = pdfFile.startsWith('http') ? pdfFile : `/${pdfFile.replace(/^\//, '')}`;

    const loadDoc = pdfjs.getDocument(filePath);
    loadDoc.promise
      .then((pdf) => pdf.getPage(pageNumber))
      .then((page) => {
        const viewport = page.getViewport({ scale: 1.0 });
        const pw = viewport.width;
        const ph = viewport.height;

        return page.getTextContent().then((content) => {
          const items: TextItem[] = [];
          for (const item of content.items) {
            if (!('str' in item) || !item.str.trim()) continue;
            const tx = item.transform;
            // transform is [scaleX, skewY, skewX, scaleY, translateX, translateY]
            const x = tx[4];
            const y = ph - tx[5]; // PDF Y is bottom-up, flip to top-down
            const w = item.width ?? (item.str.length * tx[0] * 0.5);
            const h = Math.abs(tx[3]);

            items.push({
              text: item.str,
              x: (x / pw) * 100,
              y: (y / ph) * 100,
              w: (w / pw) * 100,
              h: (h / ph) * 100,
            });
          }
          setState({ items, ready: true, pageWidth: pw, pageHeight: ph });
          continueRender(handle);
        });
      })
      .catch((err) => {
        console.warn('PDF text extraction failed:', err);
        setState((s) => ({ ...s, ready: true }));
        continueRender(handle);
      });

    return () => {
      loadDoc.destroy();
    };
  }, [pdfFile, pageNumber]);

  const findText = (query: string): BBox[] => {
    if (!state.ready || state.items.length === 0) return [];

    // Build full text with position map
    const fullText = state.items.map((it) => it.text).join(' ');
    const match = fuzzyFind(query, fullText);
    if (!match) return [];

    // Map matched character range back to text items
    let charIdx = 0;
    const matchedItems: TextItem[] = [];
    for (const item of state.items) {
      const itemEnd = charIdx + item.text.length;
      // Check if this item overlaps the matched range
      if (itemEnd > match.start && charIdx < match.end) {
        matchedItems.push(item);
      }
      charIdx = itemEnd + 1; // +1 for the space we joined with
    }

    return mergeIntoLines(matchedItems);
  };

  const findBounds = (query: string): BBox | null => {
    const lines = findText(query);
    if (lines.length === 0) return null;
    const minX = Math.max(0, Math.min(...lines.map((l) => l.x)) - 5);
    const minY = Math.max(0, Math.min(...lines.map((l) => l.y)) - 5);
    const maxX = Math.min(100, Math.max(...lines.map((l) => l.x + l.w)) + 5);
    const maxY = Math.min(100, Math.max(...lines.map((l) => l.y + l.h)) + 5);
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  };

  return {
    items: state.items,
    ready: state.ready,
    pageWidth: state.pageWidth,
    pageHeight: state.pageHeight,
    pageRatio: state.pageHeight / state.pageWidth,
    findText,
    findBounds,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/templates/src/templates/vox-document/components/usePdfTextMap.ts
git commit -m "feat(vox-document): add usePdfTextMap hook for PDF text extraction"
```

---

### Task 3: Highlight Layer Component

**Files:**
- Create: `packages/templates/src/templates/vox-document/components/HighlightLayer.tsx`

- [ ] **Step 1: Create the highlight layer**

This component takes matched BBoxes and renders animated `HighlighterMark` components at the correct positions on the paper.

```typescript
// packages/templates/src/templates/vox-document/components/HighlightLayer.tsx

import React from 'react';
import { useCurrentFrame } from 'remotion';
import { HighlighterMark } from '../../../vox/effects';
import { highlighterSweep } from '../../../vox/animations';
import { VOX_COLORS } from '../../../vox/constants';
import type { BBox } from './usePdfTextMap';

interface HighlightLayerProps {
  /** Array of highlight groups — each group is an array of BBoxes (one per line) */
  highlightGroups: BBox[][];
  /** Frame at which the first highlight starts sweeping */
  startFrame: number;
  /** Frames between each highlight group */
  groupStagger: number;
  /** Frames between lines within a group */
  lineStagger: number;
  /** Paper dimensions in pixels (for converting percentage BBoxes to px) */
  paperWidth: number;
  paperHeight: number;
}

export const HighlightLayer: React.FC<HighlightLayerProps> = ({
  highlightGroups,
  startFrame,
  groupStagger,
  lineStagger,
  paperWidth,
  paperHeight,
}) => {
  const frame = useCurrentFrame();

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}>
      {highlightGroups.map((lines, groupIdx) =>
        lines.map((bbox, lineIdx) => {
          const sweepStart = startFrame + groupIdx * groupStagger + lineIdx * lineStagger;
          const sweep = highlighterSweep(frame, sweepStart);

          if (sweep.widthPercent <= 0) return null;

          const left = (bbox.x / 100) * paperWidth;
          const top = (bbox.y / 100) * paperHeight;
          const width = (bbox.w / 100) * paperWidth;
          const height = (bbox.h / 100) * paperHeight;

          return (
            <div
              key={`${groupIdx}-${lineIdx}`}
              style={{
                position: 'absolute',
                left,
                top: top - height * 0.15,
                width,
                height: height * 1.3,
              }}
            >
              <HighlighterMark
                widthPercent={sweep.widthPercent}
                height={height * 1.3}
                rotation={0.4 + groupIdx * 0.15}
                yOffset={0}
                color={VOX_COLORS.highlight}
                opacity={0.85}
              />
            </div>
          );
        }),
      )}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/templates/src/templates/vox-document/components/HighlightLayer.tsx
git commit -m "feat(vox-document): add HighlightLayer component"
```

---

### Task 4: Update Schema

**Files:**
- Modify: `packages/templates/src/templates/vox-document/schema.ts`

- [ ] **Step 1: Rewrite the schema with text-based props and modes**

```typescript
// packages/templates/src/templates/vox-document/schema.ts

import { z } from 'zod';

export const schema = z.object({
  /** PDF file path (relative to public/) or URL */
  pdfFile: z.string().default('/proxy-pdf/labs/nemotron/files/NVIDIA-Nemotron-3-Super-Technical-Report.pdf'),
  /** Which page to show (1-indexed) */
  page: z.number().min(1).default(1),
  /** Scene mode */
  mode: z.enum(['overview', 'zoom', 'figure', 'paragraph']).default('zoom'),
  /** Text snippet the camera zooms to (fuzzy matched against PDF text) */
  focusText: z.string().optional().default('We describe the pre-training, post-training, and quantization of Nemotron 3 Super'),
  /** Text snippets to highlight yellow (each fuzzy matched) */
  highlights: z.array(z.string()).default([
    '120 billion parameter hybrid Mamba-Attention Mixture-of-Experts model',
    'comparable accuracy on common benchmarks',
  ]),
  /** Override zoom level (defaults per mode: overview=1, zoom=2.2, figure=2.8, paragraph=2) */
  zoomLevel: z.number().min(1).max(4).optional(),
  /** Paper tilt in degrees */
  tilt: z.number().default(1.2),
  /** PDF canvas resolution multiplier */
  renderScale: z.number().min(1).max(4).default(2),
  /** Source citation badge */
  source: z.string().optional().default('NVIDIA Nemotron Technical Report, 2024'),
});

export type VoxDocumentProps = z.infer<typeof schema>;
export const defaultProps: VoxDocumentProps = schema.parse({});
```

- [ ] **Step 2: Commit**

```bash
git add packages/templates/src/templates/vox-document/schema.ts
git commit -m "feat(vox-document): update schema with text-based props and modes"
```

---

### Task 5: Rebuild Main Component

**Files:**
- Modify: `packages/templates/src/templates/vox-document/index.tsx`

- [ ] **Step 1: Rewrite index.tsx with mode-based camera and text-matched highlights**

```typescript
// packages/templates/src/templates/vox-document/index.tsx

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { VoxDocumentProps } from './schema';
import { VOX_COLORS, voxEaseOut, voxEaseIn } from '../../vox/constants';
import { FilmGrain } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { VoxSourceBadge } from '../../vox/typography';
import { useScale } from '../../use-scale';
import { PdfPage } from './components/PdfPage';
import { usePdfTextMap } from './components/usePdfTextMap';
import { HighlightLayer } from './components/HighlightLayer';

// ── Background grid ──────────────────────────────────────────────────
const VoxGrid: React.FC<{ width: number; height: number; s: (px: number) => number }> = ({
  width, height, s,
}) => {
  const spacing = s(40);
  const cols = Math.ceil(width / spacing);
  const rows = Math.ceil(height / spacing);
  return (
    <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
      {Array.from({ length: cols + 1 }, (_, i) => (
        <line key={`v${i}`} x1={i * spacing} y1={0} x2={i * spacing} y2={height} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      ))}
      {Array.from({ length: rows + 1 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={i * spacing} x2={width} y2={i * spacing} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      ))}
    </svg>
  );
};

// ── Mode-specific timing constants ───────────────────────────────────
const MODE_DEFAULTS = {
  overview:  { zoom: 1.0, zoomStart: 0,  zoomEnd: 0,   hlStart: 20, groupStagger: 10, lineStagger: 3 },
  zoom:      { zoom: 2.2, zoomStart: 25, zoomEnd: 80,  hlStart: 85, groupStagger: 10, lineStagger: 3 },
  figure:    { zoom: 2.8, zoomStart: 20, zoomEnd: 70,  hlStart: 999, groupStagger: 0, lineStagger: 0 },
  paragraph: { zoom: 2.0, zoomStart: 20, zoomEnd: 65,  hlStart: 70, groupStagger: 10, lineStagger: 8 },
} as const;

// ── Main component ───────────────────────────────────────────────────
const VoxDocument: React.FC<VoxDocumentProps> = ({
  pdfFile,
  page,
  mode,
  focusText,
  highlights,
  zoomLevel: zoomOverride,
  tilt,
  renderScale,
  source,
}) => {
  const frame = useCurrentFrame();
  const { width: W, height: H, durationInFrames } = useVideoConfig();
  const s = useScale();
  const textMap = usePdfTextMap(pdfFile, page);

  // ── Resolve mode timing ──
  const timing = MODE_DEFAULTS[mode];
  const targetZoom = zoomOverride ?? timing.zoom;

  // ── Paper dimensions (85% canvas width, PDF aspect ratio) ──
  const paperW = W * 0.85;
  const paperH = paperW * textMap.pageRatio;
  const paperX = (W - paperW) / 2;
  const paperY = (H - paperH) / 2;

  // ── Find focus region from text ──
  const focusBounds = focusText ? textMap.findBounds(focusText) : null;
  const focusCenterX = focusBounds
    ? paperX + ((focusBounds.x + focusBounds.w / 2) / 100) * paperW
    : W / 2;
  const focusCenterY = focusBounds
    ? paperY + ((focusBounds.y + focusBounds.h / 2) / 100) * paperH
    : H / 2;

  // ── Find highlight regions from text ──
  const highlightGroups = textMap.ready
    ? (highlights || []).map((q) => textMap.findText(q))
    : [];

  // ── Animation phases ──
  const exitStart = durationInFrames - 25;

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: voxEaseOut,
  });
  const fadeOut = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: voxEaseIn,
  });

  // Camera zoom
  const zoom = timing.zoomEnd > timing.zoomStart
    ? interpolate(frame, [timing.zoomStart, timing.zoomEnd], [1, targetZoom], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: voxEaseOut,
      })
    : targetZoom;

  // Camera pan to focus region
  const panX = timing.zoomEnd > timing.zoomStart
    ? interpolate(frame, [timing.zoomStart, timing.zoomEnd], [0, W / 2 - focusCenterX], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: voxEaseOut,
      })
    : 0;
  const panY = timing.zoomEnd > timing.zoomStart
    ? interpolate(frame, [timing.zoomStart, timing.zoomEnd], [0, H / 2 - focusCenterY], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: voxEaseOut,
      })
    : 0;

  // Ken Burns drift
  const driftStart = timing.zoomEnd > 0 ? timing.zoomEnd : 40;
  const driftY = interpolate(frame, [driftStart, durationInFrames - 30], [0, -s(12)], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.warmBlack, overflow: 'hidden' }}>
      {/* Background grid */}
      <div style={{ position: 'absolute', inset: 0, opacity: fadeIn }}>
        <VoxGrid width={W} height={H} s={s} />
      </div>

      {/* Camera container */}
      <div style={{
        position: 'absolute', width: W, height: H,
        transform: `scale(${zoom})`,
        transformOrigin: `${focusCenterX}px ${focusCenterY}px`,
        opacity: fadeIn * fadeOut,
      }}>
        <div style={{
          position: 'absolute', width: W, height: H,
          transform: `translate(${panX}px, ${panY + driftY}px)`,
        }}>
          {/* Paper */}
          <div style={{
            position: 'absolute',
            left: paperX, top: paperY,
            width: paperW, height: paperH,
            transform: `rotate(${tilt}deg)`,
            transformOrigin: 'center center',
            borderRadius: s(4),
            overflow: 'hidden',
            boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          }}>
            {/* Aged paper texture */}
            <div style={{ position: 'absolute', inset: 0, backgroundColor: '#F5F0E8' }}>
              <ConstructionPaper color="#EDE8DC" opacity={0.5} seed={3} />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(ellipse at center, transparent 50%, rgba(160,130,90,0.15) 100%)',
                pointerEvents: 'none',
              }} />
            </div>

            {/* PDF canvas */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
              <PdfPage
                src={pdfFile}
                pageNumber={page}
                width={paperW}
                renderScale={renderScale}
              />
            </div>

            {/* Highlights */}
            <HighlightLayer
              highlightGroups={highlightGroups}
              startFrame={timing.hlStart}
              groupStagger={timing.groupStagger}
              lineStagger={timing.lineStagger}
              paperWidth={paperW}
              paperHeight={paperH}
            />
          </div>
        </div>
      </div>

      {/* Source badge */}
      {source && <VoxSourceBadge source={source} position="bottom-left" />}

      {/* Film grain */}
      <FilmGrain opacity={0.18} />
    </AbsoluteFill>
  );
};

export default VoxDocument;
```

- [ ] **Step 2: Commit**

```bash
git add packages/templates/src/templates/vox-document/index.tsx
git commit -m "feat(vox-document): rebuild with mode-based camera and text-matched highlights"
```

---

### Task 6: Update Register and Meta

**Files:**
- Modify: `packages/templates/src/templates/vox-document/register.ts`
- Modify: `packages/templates/src/templates/vox-document/meta.json`

- [ ] **Step 1: Update register.ts to include new component files**

```typescript
// packages/templates/src/templates/vox-document/register.ts

import { registerTemplate } from '../../registry';
import type { TemplateMeta, CompositionMeta } from '../../types';
import { schema, defaultProps } from './schema';
import meta from './meta.json';
import compositionMeta from './metadata.json';

registerTemplate({
  meta: meta as TemplateMeta,
  compositionMeta: compositionMeta as CompositionMeta,
  schema,
  defaultProps,
  getComponent: async () => import('./index'),
  getFiles: async () => {
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.dirname(new URL(import.meta.url).pathname);
    const voxDir = path.join(dir, '../../vox');

    const ownFileNames = [
      'meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts',
      'components/PdfPage.tsx', 'components/usePdfTextMap.ts',
      'components/HighlightLayer.tsx', 'components/fuzzy-match.ts',
    ];
    const sharedFileNames = [
      'constants.ts', 'textures.tsx', 'effects.tsx', 'typography.tsx',
      'animations.ts', 'decorations.tsx',
    ];

    const ownFiles = ownFileNames.map((f) => ({
      path: f,
      content: fs.readFileSync(path.join(dir, f), 'utf-8'),
    }));
    const sharedFiles = sharedFileNames.map((f) => ({
      path: `../../vox/${f}`,
      content: fs.readFileSync(path.join(voxDir, f), 'utf-8'),
    }));

    return [...ownFiles, ...sharedFiles];
  },
});
```

- [ ] **Step 2: Update meta.json description**

```json
{
  "slug": "vox-document",
  "name": "Vox Document",
  "description": "Renders a real PDF page with cinematic camera zoom/pan and animated yellow highlight sweeps matched by text — for citing research papers, legal documents, reports, and source material",
  "category": "overlay",
  "tags": ["vox-theme", "overlay", "narrative", "document", "pdf", "research", "legal", "source", "highlight", "evidence", "paper"],
  "stylePreset": "voxDocumentary",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "6s",
  "thumbnail": "",
  "type": "scene",
  "themes": ["vox"]
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/templates/src/templates/vox-document/register.ts
git add packages/templates/src/templates/vox-document/meta.json
git commit -m "feat(vox-document): update register and meta for new component structure"
```

---

### Task 7: Visual Verification

**Files:** None (testing only)

- [ ] **Step 1: Start playground and navigate to vox-document**

```bash
cd packages/templates && pnpm playground
```

Open `http://localhost:3200/#/template/vox-document` in browser.

- [ ] **Step 2: Verify overview mode**

Set props: `mode: "overview"`, `focusText: "Nemotron 3 Super"`, `highlights: ["Nemotron 3 Super"]`. Play the animation. Verify:
- Full page visible with no zoom
- Highlights sweep across the title area
- Slow drift during hold
- Paper at 85% width, grid visible at edges

- [ ] **Step 3: Verify zoom mode (default)**

Reset to defaults. Play. Verify:
- Full page visible initially
- Camera smoothly zooms to the abstract paragraph
- Highlights sweep after zoom settles
- Ken Burns drift during hold

- [ ] **Step 4: Verify paragraph mode**

Set `mode: "paragraph"`. Play. Verify:
- Zooms to focusText
- Highlights sweep LINE BY LINE (not all at once)

- [ ] **Step 5: Verify figure mode**

Set `mode: "figure"`, `focusText: "Figure"`, clear highlights. Play. Verify:
- Tight zoom to figure area
- No highlights
- Ken Burns drift

- [ ] **Step 6: Verify edge cases**

- Set `focusText` to gibberish — camera should stay centered
- Set `highlights` to `[]` — just camera, no highlights
- Set `highlights` to text not in the PDF — should skip gracefully

- [ ] **Step 7: Commit if all passes**

```bash
git add -A packages/templates/src/templates/vox-document/
git commit -m "feat(vox-document): complete PDF animation template with text-based highlights"
```
