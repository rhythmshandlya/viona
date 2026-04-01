import { z } from 'zod';

const speakerBboxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

export const schema = z.object({
  items: z.array(z.object({
    icon: z.string().default('\ud83d\udcca'),
    label: z.string(),
  })).min(2).max(4).default([
    { icon: '\ud83d\udcca', label: 'Research Data' },
    { icon: '\ud83d\udd2c', label: 'Lab Results' },
    { icon: '\ud83d\udcc8', label: 'Growth Metrics' },
  ]),
  speakerBbox: speakerBboxSchema.default({ x: 0.28, y: 0.10, w: 0.44, h: 0.75 }),
  speakerCenter: z.object({
    x: z.number(),
    y: z.number(),
  }).default({ x: 0.50, y: 0.45 }),
});

export type DepthEvidenceFrameProps = z.infer<typeof schema>;
export const defaultProps: DepthEvidenceFrameProps = schema.parse({});
