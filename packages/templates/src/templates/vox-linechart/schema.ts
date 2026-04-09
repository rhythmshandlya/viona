import { z } from 'zod';

export const schema = z.object({
  points: z.array(z.object({
    x: z.string(),
    y: z.number(),
  })).min(3).max(10).default([
    { x: '2018', y: 20 },
    { x: '2019', y: 28 },
    { x: '2020', y: 35 },
    { x: '2021', y: 52 },
    { x: '2022', y: 61 },
    { x: '2023', y: 78 },
  ]),
  title: z.string().optional().default('Growth Over Time'),
  annotation: z.string().optional(),
  yUnit: z.string().optional().default('%'),
});

export type VoxLinechartProps = z.infer<typeof schema>;
export const defaultProps: VoxLinechartProps = schema.parse({});
