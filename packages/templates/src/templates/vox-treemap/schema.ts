import { z } from 'zod';

export const schema = z.object({
  blocks: z.array(z.object({
    label: z.string(),
    value: z.number(),
  })).min(2).max(6).default([
    { label: 'China', value: 30 },
    { label: 'USA', value: 14 },
    { label: 'EU', value: 8 },
    { label: 'India', value: 7 },
    { label: 'Others', value: 41 },
  ]),
  title: z.string().optional().default('Global CO2 Emissions (%)'),
});

export type VoxTreemapProps = z.infer<typeof schema>;
export const defaultProps: VoxTreemapProps = schema.parse({});
