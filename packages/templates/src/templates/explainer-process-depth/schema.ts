import { z } from 'zod';

const speakerBboxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

export const schema = z.object({
  title: z.string().default('How Data Travels'),
  steps: z
    .array(
      z.object({
        label: z.string(),
        description: z.string(),
      }),
    )
    .min(3)
    .max(6)
    .default([
      { label: 'Request', description: 'Browser sends HTTP request' },
      { label: 'Server', description: 'Server processes the query' },
      { label: 'Database', description: 'Data is retrieved from storage' },
      { label: 'Response', description: 'Results sent back to browser' },
    ]),
  speakerBbox: speakerBboxSchema.default({ x: 0.28, y: 0.10, w: 0.44, h: 0.75 }),
  speakerCenter: z.object({
    x: z.number(),
    y: z.number(),
  }).default({ x: 0.50, y: 0.45 }),
});

export type ExplainerProcessDepthProps = z.infer<typeof schema>;
export const defaultProps: ExplainerProcessDepthProps = schema.parse({});
