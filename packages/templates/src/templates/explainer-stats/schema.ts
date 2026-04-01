import { z } from 'zod';

export const schema = z.object({
  title: z.string().optional().default('The Internet in Numbers'),
  stats: z
    .array(
      z.object({
        value: z.number(),
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
  speakerBbox: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  }).optional(),
  speakerCenter: z.object({
    x: z.number(),
    y: z.number(),
  }).optional(),
});

export type ExplainerStatsProps = z.infer<typeof schema>;
export const defaultProps: ExplainerStatsProps = schema.parse({});
