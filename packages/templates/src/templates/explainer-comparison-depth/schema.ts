import { z } from 'zod';

const speakerBboxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

export const schema = z.object({
  heading: z.string().default('Cloud vs On-Premise'),
  titleA: z.string().default('Cloud'),
  titleB: z.string().default('On-Premise'),
  pointsA: z.array(z.string()).min(2).max(5).default([
    'Scales instantly',
    'Pay per use',
    'Managed updates',
  ]),
  pointsB: z.array(z.string()).min(2).max(5).default([
    'Full control',
    'One-time cost',
    'Data stays local',
  ]),
  speakerBbox: speakerBboxSchema.default({ x: 0.28, y: 0.10, w: 0.44, h: 0.75 }),
  speakerCenter: z.object({
    x: z.number(),
    y: z.number(),
  }).default({ x: 0.50, y: 0.45 }),
});

export type ExplainerComparisonDepthProps = z.infer<typeof schema>;
export const defaultProps: ExplainerComparisonDepthProps = schema.parse({});
