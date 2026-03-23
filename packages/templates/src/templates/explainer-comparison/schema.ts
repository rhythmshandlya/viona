import { z } from 'zod';

export const schema = z.object({
  heading: z.string().optional().default('Cloud vs On-Premise'),
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
});

export type ExplainerComparisonProps = z.infer<typeof schema>;
export const defaultProps: ExplainerComparisonProps = schema.parse({});
