import { z } from 'zod';

export const schema = z.object({
  bars: z.array(z.object({
    label: z.string(),
    value: z.number(),
    highlight: z.boolean().optional(),
  })).min(2).max(6).default([
    { label: 'United States', value: 85, highlight: true },
    { label: 'China', value: 72 },
    { label: 'Germany', value: 65 },
    { label: 'Japan', value: 58 },
    { label: 'India', value: 34 },
  ]),
  title: z.string().optional().default('Renewable Energy Adoption (%)'),
  unit: z.string().optional().default('%'),
});

export type VoxBarchartProps = z.infer<typeof schema>;
export const defaultProps: VoxBarchartProps = schema.parse({});
