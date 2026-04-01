import { z } from 'zod';

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

export type ExplainerProcessProps = z.infer<typeof schema>;
export const defaultProps: ExplainerProcessProps = schema.parse({});
