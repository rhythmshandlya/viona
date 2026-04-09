# Vox Document Template — PDF Animation System

## Problem

Explainer videos frequently reference research papers, legal documents, and reports. The current vox-document template requires pixel-coordinate highlights and can't parse PDF structure, making it unusable for real production. Creators need a template that takes a PDF + text instructions and produces cinematic document animations automatically.

## Solution

A single `vox-document` template with 4 modes that internally parses PDF text layout via pdfjs-dist, fuzzy-matches text snippets to find positions, and renders animated camera movements with HighlighterMark sweeps. The agent provides text strings, not coordinates.

## Props Schema

```typescript
{
  pdfFile: string,              // path to PDF (local or URL)
  page: number,                 // 1-indexed page number
  mode: 'overview' | 'zoom' | 'figure' | 'paragraph',

  focusText?: string,           // text snippet the camera zooms to (fuzzy matched)
  highlights?: string[],        // text snippets to highlight yellow (fuzzy matched)

  zoomLevel?: number,           // override zoom (defaults per mode)
  tilt?: number,                // paper rotation degrees (default 1.2)
  source?: string,              // citation badge text
  renderScale?: number,         // PDF canvas resolution (default 2)
}
```

## Mode Defaults

| Mode | Zoom | Camera Behavior | Highlights |
|------|------|----------------|------------|
| overview | 1.0 | Static with slow drift | Sweep across focusText area (title) |
| zoom | 2.2 | Full page → zoom to focusText region | Key phrases highlighted after zoom settles |
| figure | 2.8 | Full page → tight crop on focusText | None (figure area, no text) |
| paragraph | 2.0 | Full page → zoom to paragraph | Line-by-line sequential sweep |

## Component Architecture

```
VoxDocument (index.tsx)
├── VoxGrid (background grid, warmBlack)
├── CameraContainer (scale + translate + drift)
│   └── PaperContainer (85% width, A4, aged texture, tilt, shadow)
│       ├── PdfPage (react-pdf canvas, renderScale 2-3x)
│       └── HighlightLayer (HighlighterMark components, z-index above PDF)
├── VoxSourceBadge (bottom-left citation)
└── FilmGrain (0.18 opacity overlay)
```

### Files

- `index.tsx` — main template component, camera system, mode logic
- `schema.ts` — Zod prop schema
- `components/PdfPage.tsx` — react-pdf wrapper with delayRender (exists, keep)
- `components/usePdfTextMap.ts` — NEW: hook that extracts text positions from PDF
- `components/HighlightLayer.tsx` — NEW: renders positioned HighlighterMarks from matched text
- `components/fuzzy-match.ts` — NEW: fuzzy substring matching utility

## Text Extraction: `usePdfTextMap` Hook

Uses pdfjs-dist's `page.getTextContent()` to extract text items with positions.

```typescript
interface TextItem {
  text: string;
  x: number;   // percentage of page width (0-100)
  y: number;   // percentage of page height (0-100)
  w: number;   // width as percentage
  h: number;   // height as percentage
}

interface PdfTextMap {
  items: TextItem[];
  ready: boolean;
  pageWidth: number;   // PDF page dimensions in points
  pageHeight: number;
  findText(query: string): BBox[];
}
```

### How it works

1. Load PDF via `pdfjs.getDocument()`
2. Get page via `pdf.getPage(pageNumber)`
3. Call `page.getTextContent()` → returns `TextContent` with items array
4. Each item has `str` (text), `transform` (6-element matrix with x, y), `width`, `height`
5. Convert absolute positions to percentages of page dimensions
6. Store as searchable array
7. Uses Remotion's `delayRender`/`continueRender` to sync with frame capture

### `findText(query)` Algorithm

1. Concatenate all text items into a single string, maintaining a position map (character index → TextItem index)
2. Normalize both query and full text: lowercase, collapse whitespace
3. Sliding window search: for each possible start position in the full text, compute character overlap with the query
4. If best match score > 60% overlap, consider it found
5. Map the matched character range back to TextItem indices → get their bounding boxes
6. Merge adjacent boxes on the same line into continuous highlight bars (so a sentence spanning 10 words becomes 1-2 bars, not 10 tiny rectangles)
7. For multi-line matches, return one BBox per line

### Camera Target from `focusText`

- Run `findText(focusText)` to get matched bounding boxes
- Compute the enclosing bounding box of ALL matched items
- Add padding (10% on each side)
- This becomes the camera zoom target center point

## Highlight Rendering: `HighlightLayer`

For each string in `highlights[]`:
1. Call `findText(highlightString)` → get BBox array (one per line of matched text)
2. Render a `HighlighterMark` at each BBox position
3. Each mark has:
   - Position: absolute, converted from percentage to pixel coords on the paper
   - Width: animated via `highlighterSweep` (0% → 100%)
   - Height: from the BBox height + small padding
   - Rotation: 0.4-0.8 degrees (from HighlighterMark defaults)
   - Color: VOX_COLORS.highlight (#FFEB00)
   - Opacity: 0.85
4. Stagger: marks within one highlight string are staggered 3 frames apart (line-by-line feel). Different highlight strings are staggered 10 frames apart.

## Animation Timing

### Overview Mode
| Frames | Action |
|--------|--------|
| 0-20 | Fade in (voxEaseOut) |
| 20-40 | Highlight sweeps across focusText |
| 40-end | Slow Ken Burns drift (subtle Y drift) |
| last 25 | Fade out (voxEaseIn) |

### Zoom Mode
| Frames | Action |
|--------|--------|
| 0-20 | Fade in, full page visible |
| 25-80 | Smooth zoom + pan to focusText center (voxEaseOut) |
| 85+ | Highlights sweep in (staggered 10 frames per string, 3 frames per line within) |
| hold | Ken Burns drift |
| last 25 | Fade out |

### Figure Mode
| Frames | Action |
|--------|--------|
| 0-20 | Fade in |
| 20-70 | Zoom to figure area (slower, tighter) |
| hold | Ken Burns drift |
| last 25 | Fade out |

### Paragraph Mode
| Frames | Action |
|--------|--------|
| 0-20 | Fade in |
| 20-65 | Zoom to paragraph |
| 70+ | Highlights sweep LINE BY LINE (staggered 8 frames per line) |
| hold | Ken Burns drift |
| last 25 | Fade out |

## Visual Specifications

### Paper
- Width: 85% of canvas width
- Aspect ratio: match PDF page ratio (extracted from pdfjs, not hardcoded A4)
- Position: centered in canvas
- Rotation: `tilt` degrees (default 1.2)
- Texture: `ConstructionPaper` (color #EDE8DC, opacity 0.5)
- Edge vignette: radial gradient (transparent center → rgba(160,130,90,0.15) edges)
- Shadow: `0 8px 40px rgba(0,0,0,0.5)`

### Background
- Color: VOX_COLORS.warmBlack (#1A1A2E)
- Grid: white lines at 40px spacing, opacity 0.06

### Highlights
- Component: `HighlighterMark` from vox/effects.tsx
- Color: #FFEB00 (VOX_COLORS.highlight)
- Rotation: 0.4-0.8 degrees
- Opacity: 0.85
- Animation: `highlighterSweep` from vox/animations.ts

### Overlays
- Film grain: `FilmGrain` at 0.18 opacity
- Source badge: `VoxSourceBadge` bottom-left

## Edge Cases

- **PDF load failure**: Show aged paper with centered text "Document unavailable" in VoxBody style
- **Text not found**: Skip that highlight, log warning. Camera falls back to center of page if focusText not found.
- **Multiple fuzzy matches**: Use the first match (highest score)
- **focusText not provided**: Behave as overview mode regardless of mode prop
- **Empty highlights array**: Just camera movement, no highlights
- **Non-text PDF pages** (scanned images): Text extraction returns empty. Highlights won't match. Camera still works with focusText falling back to center.
- **PDF page ratio not A4**: Paper container adapts to actual page ratio (letter, legal, etc.)

## Agent Usage Example

```json
{
  "pdfFile": "paper.pdf",
  "page": 1,
  "mode": "overview",
  "focusText": "Nemotron 3 Super: Open, Efficient",
  "highlights": ["Nemotron 3 Super: Open, Efficient"],
  "source": "NVIDIA Nemotron Technical Report, 2024"
}
```

```json
{
  "pdfFile": "paper.pdf",
  "page": 1,
  "mode": "paragraph",
  "focusText": "We describe the pre-training, post-training, and quantization",
  "highlights": [
    "120 billion parameter hybrid Mamba-Attention Mixture-of-Experts model",
    "comparable accuracy on common benchmarks, while also achieving up to 2.2x"
  ],
  "source": "NVIDIA Nemotron Technical Report, 2024"
}
```

```json
{
  "pdfFile": "paper.pdf",
  "page": 5,
  "mode": "figure",
  "focusText": "Figure 3: Architecture Overview",
  "source": "NVIDIA Nemotron Technical Report, 2024"
}
```

## Dependencies

- `react-pdf` — PDF canvas rendering (already installed)
- `pdfjs-dist` — text extraction API (already installed, used by react-pdf)
- Vox shared library — HighlighterMark, ConstructionPaper, FilmGrain, VoxSourceBadge, highlighterSweep, voxEaseOut/In
