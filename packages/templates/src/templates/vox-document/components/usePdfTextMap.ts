import { useState, useEffect } from 'react';
import { pdfjs } from 'react-pdf';
import { fuzzyFind } from './fuzzy-match';

// Ensure worker is configured
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
      const right = Math.max(currentLine.x + currentLine.w, item.x + item.w);
      currentLine.x = Math.min(currentLine.x, item.x);
      currentLine.w = right - currentLine.x;
      currentLine.h = Math.max(currentLine.h, item.h);
    } else {
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

    const fullText = state.items.map((it) => it.text).join(' ');
    const match = fuzzyFind(query, fullText);
    if (!match) return [];

    let charIdx = 0;
    const matchedItems: TextItem[] = [];
    for (const item of state.items) {
      const itemEnd = charIdx + item.text.length;
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
