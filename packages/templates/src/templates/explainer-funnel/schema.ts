import { z } from 'zod';

export const schema = z.object({
  showBackground: z.boolean().default(false),
  title: z.string().default('Sales Funnel'),
  stages: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
      }),
    )
    .min(3)
    .max(6)
    .default([
      { label: 'Awareness', value: '10,000' },
      { label: 'Interest', value: '5,200' },
      { label: 'Evaluation', value: '2,800' },
      { label: 'Decision', value: '1,100' },
      { label: 'Purchase', value: '450' },
    ]),
});

export type ExplainerFunnelProps = z.infer<typeof schema>;
export const defaultProps: ExplainerFunnelProps = schema.parse({});
