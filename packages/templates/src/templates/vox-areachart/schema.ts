import { z } from 'zod';

export const schema = z.object({
  layers: z.array(z.object({
    label: z.string(),
    color: z.string().optional(),
  })).min(2).max(4).default([
    { label: 'Solar' },
    { label: 'Wind' },
    { label: 'Hydro' },
  ]),
  title: z.string().optional().default('Energy Mix Over Time'),
  xLabel: z.string().optional().default('2010 → 2024'),
});

export type VoxAreachartProps = z.infer<typeof schema>;
export const defaultProps: VoxAreachartProps = schema.parse({});
