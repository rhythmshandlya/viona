import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('Top 5 Renewable Energy Sources'),
  items: z
    .array(
      z.object({
        rank: z.number(),
        label: z.string(),
        detail: z.string().optional(),
      }),
    )
    .min(3)
    .max(7)
    .default([
      { rank: 1, label: 'Solar', detail: 'Most widely adopted' },
      { rank: 2, label: 'Wind', detail: 'Fastest growing' },
      { rank: 3, label: 'Hydroelectric', detail: 'Most reliable' },
      { rank: 4, label: 'Geothermal' },
      { rank: 5, label: 'Biomass' },
    ]),
  ascending: z.boolean().default(false),
});

export type ExplainerRankingProps = z.infer<typeof schema>;
export const defaultProps: ExplainerRankingProps = schema.parse({});
