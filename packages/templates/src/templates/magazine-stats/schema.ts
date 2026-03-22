import { z } from 'zod';

export const schema = z.object({
  stats: z.array(z.object({
    value: z.string(),
    label: z.string(),
    unit: z.string().optional(),
  })).min(2).max(6).default([
    { value: '44.1M', label: 'Population' },
    { value: '$200B', label: 'GDP' },
    { value: '603,628', label: 'Area (km\u00B2)' },
    { value: '24', label: 'Regions' },
  ]),
  title: z.string().default('Ukraine at a Glance'),
});

export type MagazineStatsProps = z.infer<typeof schema>;
export const defaultProps: MagazineStatsProps = schema.parse({});
