import { z } from 'zod';

export const schema = z.object({
  /** PDF file path (relative to public/) or URL */
  pdfFile: z.string().default('/proxy-pdf/labs/nemotron/files/NVIDIA-Nemotron-3-Super-Technical-Report.pdf'),
  /** Which page to show (1-indexed) */
  page: z.number().min(1).default(1),
  /** Scene mode */
  mode: z.enum(['overview', 'zoom', 'figure', 'paragraph']).default('overview'),
  /** Text snippet the camera zooms to (fuzzy matched against PDF text) */
  focusText: z.string().optional().default('Nemotron 3 Super: Open, Efficient Mixture-of-Experts'),
  /** Text snippets to highlight yellow (each fuzzy matched) */
  highlights: z.array(z.string()).default([
    'Nemotron 3 Super: Open, Efficient Mixture-of-Experts Hybrid Mamba-Transformer Model for Agentic Reasoning',
  ]),
  /** Override zoom level (defaults per mode: overview=1, zoom=1.3, figure=1.6, paragraph=1.25) */
  zoomLevel: z.number().min(1).max(4).optional(),
  /** Source citation badge */
  source: z.string().optional().default('NVIDIA Nemotron Technical Report, 2024'),
});

export type VoxDocumentProps = z.infer<typeof schema>;
export const defaultProps: VoxDocumentProps = schema.parse({});
