import { z } from 'zod';

const speakerBboxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

export const schema = z.object({
  colors: z.array(z.string()).min(2).max(4).default(['#1e3a5f', '#5f1e3a', '#3a5f1e']),
  direction: z.enum(['horizontal', 'radial']).default('radial'),
  opacity: z.number().min(0.1).max(0.6).default(0.35),
  speakerBbox: speakerBboxSchema.default({ x: 0.28, y: 0.10, w: 0.44, h: 0.75 }),
  speakerCenter: z.object({
    x: z.number(),
    y: z.number(),
  }).default({ x: 0.50, y: 0.45 }),
});

export type DepthContextShiftProps = z.infer<typeof schema>;
export const defaultProps: DepthContextShiftProps = schema.parse({});
