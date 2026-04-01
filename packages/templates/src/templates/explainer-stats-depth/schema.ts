import { z } from 'zod';

const speakerBboxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

export const schema = z.object({
  title: z.string().default('The Internet in Numbers'),
  stats: z
    .array(
      z.object({
        value: z.number().min(0),
        label: z.string(),
        prefix: z.string().optional(),
        suffix: z.string().optional(),
      }),
    )
    .min(2)
    .max(4)
    .default([
      { value: 5.3, label: 'Billion Users', suffix: 'B' },
      { value: 1.13, label: 'Billion Websites', suffix: 'B' },
      { value: 333, label: 'Million Terabytes Daily', suffix: 'M' },
    ]),
  speakerBbox: speakerBboxSchema.default({ x: 0.28, y: 0.10, w: 0.44, h: 0.75 }),
  speakerCenter: z.object({
    x: z.number(),
    y: z.number(),
  }).default({ x: 0.50, y: 0.45 }),
});

export type ExplainerStatsDepthProps = z.infer<typeof schema>;
export const defaultProps: ExplainerStatsDepthProps = schema.parse({});
