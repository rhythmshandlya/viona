// packages/templates/src/templates/magazine-quote-depth/schema.ts
import { z } from 'zod';

const speakerBboxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

export const schema = z.object({
  quote: z.string().default('This agreement represents the most significant diplomatic breakthrough of the century.'),
  author: z.string().default('Dr. Elena Vasquez'),
  role: z.string().optional().default('Chief Diplomatic Correspondent'),
  context: z.string().optional(),
  speakerBbox: speakerBboxSchema.default({ x: 0.28, y: 0.10, w: 0.44, h: 0.75 }),
  speakerCenter: z.object({
    x: z.number(),
    y: z.number(),
  }).default({ x: 0.50, y: 0.45 }),
});

export type MagazineQuoteDepthProps = z.infer<typeof schema>;
export const defaultProps: MagazineQuoteDepthProps = schema.parse({});
