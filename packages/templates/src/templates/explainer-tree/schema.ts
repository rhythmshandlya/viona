import { z } from 'zod';

export const schema = z.object({
  showBackground: z.boolean().default(false),
  title: z.string().default('Machine Learning'),
  root: z.string().default('ML'),
  children: z.array(z.object({
    label: z.string(),
    children: z.array(z.string()).max(4).default([]),
  })).min(2).max(5).default([
    { label: 'Supervised', children: ['Classification', 'Regression'] },
    { label: 'Unsupervised', children: ['Clustering', 'Reduction'] },
    { label: 'Reinforcement', children: ['Policy', 'Value'] },
  ]),
});

export type ExplainerTreeProps = z.infer<typeof schema>;
export const defaultProps: ExplainerTreeProps = schema.parse({});
