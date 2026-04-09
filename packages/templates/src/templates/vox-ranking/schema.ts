import { z } from 'zod';

export const schema = z.object({
  items: z.array(z.object({
    rank: z.number(),
    label: z.string(),
    value: z.string().optional(),
  })).min(3).max(8).default([
    { rank: 1, label: 'Norway', value: '98%' },
    { rank: 2, label: 'Iceland', value: '85%' },
    { rank: 3, label: 'Sweden', value: '75%' },
    { rank: 4, label: 'Denmark', value: '67%' },
    { rank: 5, label: 'Finland', value: '52%' },
  ]),
  title: z.string().optional().default('Top 5 by Renewable Energy'),
});

export type VoxRankingProps = z.infer<typeof schema>;
export const defaultProps: VoxRankingProps = schema.parse({});
