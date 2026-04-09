import { z } from 'zod';

export const schema = z.object({
  segments: z.array(z.object({
    label: z.string(),
    value: z.number(),
    color: z.string().optional(),
  })).min(2).max(5).default([
    { label: 'Renewable', value: 35 },
    { label: 'Nuclear', value: 20 },
    { label: 'Gas', value: 30 },
    { label: 'Coal', value: 15 },
  ]),
  title: z.string().optional().default('Energy Sources'),
});

export type VoxDonutProps = z.infer<typeof schema>;
export const defaultProps: VoxDonutProps = schema.parse({});
