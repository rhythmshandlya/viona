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
