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
});

export type ExplainerProcessProps = z.infer<typeof schema>;
export const defaultProps: ExplainerProcessProps = schema.parse({});
