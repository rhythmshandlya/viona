import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('Top 5 Developments'),
  items: z.array(z.object({
    text: z.string(),
    detail: z.string().optional(),
  })).min(2).max(5).default([
    { text: 'Peace talks resume in Geneva', detail: 'After 18 months of stalemate' },
    { text: 'Humanitarian corridor expanded', detail: 'Now covers 3 provinces' },
    { text: 'Ceasefire holds for 30 days', detail: 'Longest since 2022' },
    { text: 'Aid reaches eastern regions' },
    { text: 'Refugee returns begin' },
  ]),
});

export type MagazineRankingProps = z.infer<typeof schema>;
export const defaultProps: MagazineRankingProps = schema.parse({});
