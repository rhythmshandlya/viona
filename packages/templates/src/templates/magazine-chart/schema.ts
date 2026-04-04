import { z } from 'zod';

const barSchema = z.object({
  label: z.string(),
  value: z.number().min(0).max(100),
});

export const schema = z.object({
  title: z.string().default('Global Energy Mix (2026)'),
  bars: z.array(barSchema).min(2).max(6).default([
    { label: 'Renewables', value: 38 },
    { label: 'Natural Gas', value: 24 },
    { label: 'Coal', value: 18 },
    { label: 'Nuclear', value: 12 },
    { label: 'Oil', value: 8 },
  ]),
  unit: z.string().optional().default('%'),
});

export type MagazineChartProps = z.infer<typeof schema>;
export const defaultProps: MagazineChartProps = schema.parse({});
