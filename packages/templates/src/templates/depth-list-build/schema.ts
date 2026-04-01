import { z } from 'zod';

const speakerBboxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

export const schema = z.object({
  items: z.array(z.string()).min(2).max(8).default([
    'Exercise regularly',
    'Eat whole foods',
    'Sleep 8 hours',
    'Drink water',
    'Manage stress',
  ]),
  speakerBbox: speakerBboxSchema.default({ x: 0.28, y: 0.10, w: 0.44, h: 0.75 }),
  speakerCenter: z.object({
    x: z.number(),
    y: z.number(),
  }).default({ x: 0.50, y: 0.45 }),
});

export type DepthListBuildProps = z.infer<typeof schema>;
export const defaultProps: DepthListBuildProps = schema.parse({});
