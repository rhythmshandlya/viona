import { z } from 'zod';

const highlightRegion = z.object({
  /** X position as percentage of page width (0-100) */
  x: z.number().min(0).max(100),
  /** Y position as percentage of page height (0-100) */
  y: z.number().min(0).max(100),
  /** Width as percentage of page width */
  w: z.number().min(0).max(100),
  /** Height as percentage of page height */
  h: z.number().min(0).max(100),
  /** Highlight color */
  color: z.string().optional(),
});

export const schema = z.object({
  /** PDF file path (relative to public/ folder, loaded via staticFile) */
  pdfFile: z.string().default('document.pdf'),
  /** Which page to show (1-indexed) */
  page: z.number().min(1).default(1),
  /** Regions to highlight with yellow marker sweep */
  highlights: z.array(highlightRegion).default([
    { x: 5, y: 28, w: 90, h: 4 },
    { x: 5, y: 44, w: 90, h: 8 },
  ]),
  /** Camera zoom target — region to zoom into (percentage coords) */
  zoomRegion: z.object({
    x: z.number().default(0),
    y: z.number().default(20),
    w: z.number().default(100),
    h: z.number().default(40),
  }).default({ x: 0, y: 20, w: 100, h: 40 }),
  /** Max zoom level */
  zoomLevel: z.number().min(1).max(4).default(1.8),
  /** Paper tilt in degrees */
  tilt: z.number().default(1.2),
  /** Render scale for PDF canvas (higher = sharper at zoom) */
  renderScale: z.number().min(1).max(4).default(3),
  /** Source citation badge */
  source: z.string().optional().default('NVIDIA Nemotron Technical Report, 2024'),
});

export type VoxDocumentProps = z.infer<typeof schema>;
export const defaultProps: VoxDocumentProps = schema.parse({});
