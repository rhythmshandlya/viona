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

export type MagazineStatsProps = z.infer<typeof schema>;
export const defaultProps: MagazineStatsProps = schema.parse({});
